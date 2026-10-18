//! Endpoints de artigos: /api/articles

use axum::{
    body::Bytes,
    extract::{Path, State},
    Json,
};
use serde::{de::DeserializeOwned, Deserialize};
use sqlx::{QueryBuilder, Sqlite};

use crate::{
    error::{AppError, AppQuery, AppResult},
    models::{Article, ArticleQuery, Paginated},
    repository::{self, ARTICLE_SELECT},
    state::AppState,
};

const DEFAULT_LIMIT: u32 = 24;
const MAX_LIMIT: u32 = 100;

/// GET /api/articles?category=&feedId=&period=24h|7d|30d|all&q=&favorite=true&unread=true&page=1&limit=24
pub async fn list_articles(
    State(state): State<AppState>,
    AppQuery(params): AppQuery<ArticleQuery>,
) -> AppResult<Json<Paginated<Article>>> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let offset = i64::from(page - 1) * i64::from(limit);

    // Total de resultados (para a paginação do frontend).
    let mut count_query = QueryBuilder::<Sqlite>::new(
        "SELECT COUNT(*) FROM articles a JOIN feeds f ON f.id = a.feed_id",
    );
    apply_filters(&mut count_query, &params);
    let total: i64 = count_query.build_query_scalar().fetch_one(&state.db).await?;

    // Página de resultados.
    let mut list_query = QueryBuilder::<Sqlite>::new(ARTICLE_SELECT);
    apply_filters(&mut list_query, &params);
    list_query
        .push(" ORDER BY a.published_at DESC, a.id LIMIT ")
        .push_bind(i64::from(limit))
        .push(" OFFSET ")
        .push_bind(offset);
    let items = list_query
        .build_query_as::<Article>()
        .fetch_all(&state.db)
        .await?;

    let total_pages = ((total as f64) / f64::from(limit)).ceil() as u32;
    Ok(Json(Paginated {
        items,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Acrescenta o `WHERE` dinâmico. Os valores sempre entram via `push_bind`
/// (parâmetros preparados), nunca concatenados: isso evita SQL injection.
fn apply_filters<'a>(qb: &mut QueryBuilder<'a, Sqlite>, p: &'a ArticleQuery) {
    qb.push(" WHERE 1 = 1");

    if let Some(category) = non_empty(&p.category) {
        qb.push(" AND f.category = ").push_bind(category);
    }
    if let Some(feed_id) = non_empty(&p.feed_id) {
        qb.push(" AND a.feed_id = ").push_bind(feed_id);
    }
    if let Some(since) = p.period.and_then(|period| period.since()) {
        qb.push(" AND a.published_at >= ").push_bind(since);
    }
    if let Some(text) = non_empty(&p.q) {
        let pattern = format!("%{}%", escape_like(text));
        qb.push(" AND (a.title LIKE ")
            .push_bind(pattern.clone())
            .push(" ESCAPE '\\' OR a.description LIKE ")
            .push_bind(pattern)
            .push(" ESCAPE '\\' OR f.title LIKE ")
            .push_bind(format!("%{}%", escape_like(text)))
            .push(" ESCAPE '\\')");
    }
    if p.favorite == Some(true) {
        qb.push(" AND a.is_favorite = 1");
    }
    if p.unread == Some(true) {
        qb.push(" AND a.is_read = 0");
    }
}

fn non_empty(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

/// Escapa `%`, `_` e `\` para que o texto digitado seja buscado literalmente no LIKE.
fn escape_like(text: &str) -> String {
    text.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

/// GET /api/articles/:id
pub async fn get_article(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Article>> {
    Ok(Json(repository::get_article(&state.db, &id).await?))
}

/// Corpo de `POST /api/articles/:id/favorite`: `{ "favorite": true }`.
#[derive(Deserialize)]
struct FavoriteBody {
    favorite: bool,
}

/// Corpo de `POST /api/articles/:id/read`: `{ "read": false }`.
#[derive(Deserialize)]
struct ReadBody {
    read: bool,
}

/// POST /api/articles/:id/favorite
///
/// Com corpo `{ "favorite": true|false }` define o valor exato (idempotente: clicar duas vezes
/// não desfaz a ação). Sem corpo, alterna o estado atual.
pub async fn set_favorite(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Bytes,
) -> AppResult<Json<Article>> {
    let value = parse_optional_body::<FavoriteBody>(&body)?.map(|b| b.favorite);
    update_flag(&state, Flag::Favorite, &id, value).await
}

/// POST /api/articles/:id/read
///
/// Com corpo `{ "read": true|false }` define o valor exato. Sem corpo, marca como lido.
pub async fn set_read(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Bytes,
) -> AppResult<Json<Article>> {
    let value = parse_optional_body::<ReadBody>(&body)?
        .map(|b| b.read)
        .unwrap_or(true);
    update_flag(&state, Flag::Read, &id, Some(value)).await
}

/// Lê um corpo JSON opcional: vazio -> `None`; inválido -> 400 no formato padrão de erro.
fn parse_optional_body<T: DeserializeOwned>(body: &Bytes) -> AppResult<Option<T>> {
    if body.iter().all(u8::is_ascii_whitespace) {
        return Ok(None);
    }
    serde_json::from_slice(body)
        .map(Some)
        .map_err(|e| AppError::BadRequest(format!("corpo JSON inválido: {e}")))
}

#[derive(Clone, Copy)]
enum Flag {
    Favorite,
    Read,
}

impl Flag {
    /// Nome da coluna. Vem sempre de constantes do código, nunca do usuário,
    /// por isso é seguro interpolar no SQL (valores continuam como parâmetros).
    fn column(self) -> &'static str {
        match self {
            Flag::Favorite => "is_favorite",
            Flag::Read => "is_read",
        }
    }
}

/// Atualiza uma flag (`Some(valor)` define, `None` alterna) e devolve o artigo atualizado.
async fn update_flag(
    state: &AppState,
    flag: Flag,
    id: &str,
    value: Option<bool>,
) -> AppResult<Json<Article>> {
    let column = flag.column();
    let result = match value {
        Some(v) => {
            sqlx::query(&format!("UPDATE articles SET {column} = ? WHERE id = ?"))
                .bind(v)
                .bind(id)
                .execute(&state.db)
                .await?
        }
        None => {
            sqlx::query(&format!("UPDATE articles SET {column} = 1 - {column} WHERE id = ?"))
                .bind(id)
                .execute(&state.db)
                .await?
        }
    };
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("artigo não encontrado".into()));
    }
    Ok(Json(repository::get_article(&state.db, id).await?))
}
