//! Consultas ao banco de dados reutilizadas por mais de uma rota.

use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{Article, Feed, FeedStatus},
    services::rss::{ParsedEntry, ParsedFeed},
};

pub const FEED_SELECT: &str = "\
    SELECT f.id, f.title, f.url, f.site_url, f.description, f.category, f.status, \
           f.last_error, f.last_fetched_at, f.created_at, \
           (SELECT COUNT(*) FROM articles a WHERE a.feed_id = f.id) AS article_count \
    FROM feeds f";

pub const ARTICLE_SELECT: &str = "\
    SELECT a.id, a.feed_id, f.title AS feed_title, f.category AS category, \
           a.title, COALESCE(a.description, '') AS summary, a.link AS url, a.image_url, a.author, \
           a.published_at, a.is_favorite, a.is_read \
    FROM articles a JOIN feeds f ON f.id = a.feed_id";

pub async fn get_feed(db: &SqlitePool, id: &str) -> AppResult<Feed> {
    sqlx::query_as::<_, Feed>(&format!("{FEED_SELECT} WHERE f.id = ?"))
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound("feed não encontrado".into()))
}

pub async fn get_article(db: &SqlitePool, id: &str) -> AppResult<Article> {
    sqlx::query_as::<_, Article>(&format!("{ARTICLE_SELECT} WHERE a.id = ?"))
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound("artigo não encontrado".into()))
}

pub async fn list_feed_ids(db: &SqlitePool) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM feeds")
        .fetch_all(db)
        .await
}

pub async fn insert_feed(
    db: &SqlitePool,
    id: &str,
    url: &str,
    category: &str,
    parsed: &ParsedFeed,
) -> Result<(), sqlx::Error> {
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO feeds (id, title, url, site_url, description, category, status, last_fetched_at, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(&parsed.title)
    .bind(url)
    .bind(&parsed.site_url)
    .bind(&parsed.description)
    .bind(category)
    .bind(FeedStatus::Active)
    .bind(now)
    .bind(now)
    .execute(db)
    .await?;
    Ok(())
}

/// Insere os itens novos e atualiza os já conhecidos (mesmo `feed_id` + `guid`),
/// preservando `is_read` e `is_favorite`. Retorna quantos artigos são realmente novos.
pub async fn upsert_articles(
    db: &SqlitePool,
    feed_id: &str,
    entries: &[ParsedEntry],
) -> Result<i64, sqlx::Error> {
    let before: i64 = count_articles(db, feed_id).await?;

    // Uma transação garante que ou todos os itens entram, ou nenhum.
    let mut tx = db.begin().await?;
    let now = Utc::now();
    for e in entries {
        sqlx::query(
            "INSERT INTO articles (id, feed_id, guid, title, description, link, image_url, author, published_at, created_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
             ON CONFLICT (feed_id, guid) DO UPDATE SET \
                 title = excluded.title, description = excluded.description, link = excluded.link, \
                 image_url = excluded.image_url, author = excluded.author",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(feed_id)
        .bind(&e.guid)
        .bind(&e.title)
        .bind(&e.description)
        .bind(&e.link)
        .bind(&e.image_url)
        .bind(&e.author)
        .bind(e.published_at)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(count_articles(db, feed_id).await? - before)
}

async fn count_articles(db: &SqlitePool, feed_id: &str) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*) FROM articles WHERE feed_id = ?")
        .bind(feed_id)
        .fetch_one(db)
        .await
}
