//! Endpoints de fontes RSS: /api/feeds

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::{
    error::{AppError, AppJson, AppResult},
    models::{CreateFeedRequest, Feed},
    repository::{self, FEED_SELECT},
    services::{refresh, rss},
    state::AppState,
};

/// GET /api/feeds
pub async fn list_feeds(State(state): State<AppState>) -> AppResult<Json<Vec<Feed>>> {
    let feeds = sqlx::query_as::<_, Feed>(&format!("{FEED_SELECT} ORDER BY f.title COLLATE NOCASE"))
        .fetch_all(&state.db)
        .await?;
    Ok(Json(feeds))
}

/// POST /api/feeds  — corpo: `{ "url": "https://...", "category": "Tecnologia" }`
///
/// A `url` pode ser o endereço do **feed** ou do **site**: se for um site, a API procura o feed
/// sozinha (tags `<link rel="alternate">` e caminhos comuns como `/feed`). Tudo é validado
/// (baixa e interpreta o XML) ANTES de salvar. Se nenhum feed for encontrado, responde 422 com
/// uma mensagem que o modal do frontend exibe. Em caso de sucesso devolve a fonte criada (201),
/// com `url` apontando para o feed encontrado e `articleCount` preenchido.
pub async fn create_feed(
    State(state): State<AppState>,
    AppJson(body): AppJson<CreateFeedRequest>,
) -> AppResult<(StatusCode, Json<Feed>)> {
    let allow_private = state.config.allow_private_urls;
    let url = rss::ensure_public_url(&body.url, allow_private)
        .await
        .map_err(|e| AppError::InvalidFeed(e.to_string()))?;

    // Resposta rápida (sem rede) quando o usuário cola exatamente um feed já cadastrado.
    if feed_exists(&state, url.as_str()).await? {
        return Err(AppError::Conflict("essa fonte já está cadastrada".into()));
    }

    let found = rss::discover_feed(&state.http, &url, allow_private)
        .await
        .map_err(|e| AppError::InvalidFeed(e.to_string()))?;
    let feed_url = found.url.to_string();
    let parsed = found.feed;

    // O usuário pode ter colado o site de um feed que já está cadastrado.
    if feed_url != url.as_str() && feed_exists(&state, &feed_url).await? {
        return Err(AppError::Conflict(format!(
            "essa fonte já está cadastrada (feed encontrado: {feed_url})"
        )));
    }

    let category = normalize_category(body.category.as_deref());
    let id = Uuid::new_v4().to_string();

    repository::insert_feed(&state.db, &id, &feed_url, &category, &parsed)
        .await
        .map_err(|e| match e.as_database_error() {
            // Duas requisições simultâneas para a mesma URL: a segunda cai aqui.
            Some(db_err) if db_err.is_unique_violation() => {
                AppError::Conflict("essa fonte já está cadastrada".into())
            }
            _ => AppError::Database(e),
        })?;
    repository::upsert_articles(&state.db, &id, &parsed.entries).await?;

    tracing::info!(
        feed = %parsed.title,
        articles = parsed.entries.len(),
        auto_discovered = feed_url != url.as_str(),
        "fonte cadastrada"
    );
    let feed = repository::get_feed(&state.db, &id).await?;
    Ok((StatusCode::CREATED, Json(feed)))
}

async fn feed_exists(state: &AppState, url: &str) -> AppResult<bool> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE url = ?")
        .bind(url)
        .fetch_one(&state.db)
        .await?;
    Ok(count > 0)
}

/// DELETE /api/feeds/:id  — remove a fonte e (por cascata) todos os seus artigos.
pub async fn delete_feed(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let result = sqlx::query("DELETE FROM feeds WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("feed não encontrado".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/feeds/:id/refresh  — baixa o feed de novo e devolve a fonte atualizada.
pub async fn refresh_feed(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Feed>> {
    Ok(Json(refresh::refresh_feed(&state, &id).await?))
}

fn normalize_category(raw: Option<&str>) -> String {
    let cleaned: String = raw.unwrap_or("").trim().chars().take(40).collect();
    if cleaned.is_empty() {
        "Geral".to_string()
    } else {
        cleaned
    }
}
