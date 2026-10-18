use std::sync::Arc;

use sqlx::SqlitePool;

use crate::config::Config;

/// Estado compartilhado entre todos os handlers.
/// Clonar é barato: `SqlitePool`, `reqwest::Client` e `Arc` apenas copiam um ponteiro interno.
#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub http: reqwest::Client,
    pub config: Arc<Config>,
}
