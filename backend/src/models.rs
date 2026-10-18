//! Tipos que representam as tabelas do banco e o contrato JSON com o frontend.
//! O JSON usa camelCase (`siteUrl`, `publishedAt`...) para casar com o TypeScript.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ---------------------------------------------------------------- Feeds

/// Estado da fonte. Vai para o JSON como "active" | "error" (contrato do frontend).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, sqlx::Type)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum FeedStatus {
    Active,
    Error,
}

/// Campos opcionais ausentes são OMITIDOS do JSON (em vez de `null`),
/// porque no TypeScript eles são `campo?: string`.
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Feed {
    pub id: String,
    pub title: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub category: String,
    pub status: FeedStatus,
    /// Coluna `last_error` no banco; no JSON vira `errorMessage`.
    #[sqlx(rename = "last_error")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_fetched_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub article_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateFeedRequest {
    pub url: String,
    pub category: Option<String>,
}

// ------------------------------------------------------------- Articles

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Article {
    pub id: String,
    pub feed_id: String,
    /// Nome da fonte (título do feed).
    pub feed_title: String,
    pub category: String,
    pub title: String,
    /// Texto puro do resumo (string vazia quando o feed não traz descrição).
    pub summary: String,
    /// Link do artigo original.
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    pub published_at: DateTime<Utc>,
    pub is_favorite: bool,
    pub is_read: bool,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub enum Period {
    #[serde(rename = "24h")]
    Last24h,
    #[serde(rename = "7d")]
    Last7d,
    #[serde(rename = "30d")]
    Last30d,
    #[serde(rename = "all")]
    All,
}

impl Period {
    /// Data mínima de publicação para o período (None = sem limite).
    pub fn since(self) -> Option<DateTime<Utc>> {
        let now = Utc::now();
        match self {
            Period::Last24h => Some(now - Duration::hours(24)),
            Period::Last7d => Some(now - Duration::days(7)),
            Period::Last30d => Some(now - Duration::days(30)),
            Period::All => None,
        }
    }
}

/// Parâmetros aceitos em `GET /api/articles` (todos opcionais).
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleQuery {
    pub category: Option<String>,
    #[serde(alias = "feed_id")]
    pub feed_id: Option<String>,
    pub period: Option<Period>,
    pub q: Option<String>,
    pub favorite: Option<bool>,
    pub unread: Option<bool>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}
