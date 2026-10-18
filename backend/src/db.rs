//! Conexão com o SQLite e execução das migrações (pasta `migrations/`).

use std::{str::FromStr, time::Duration};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

pub async fn connect(database_url: &str) -> anyhow::Result<SqlitePool> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .foreign_keys(true) // necessário para o ON DELETE CASCADE funcionar
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(5));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // As migrações são embutidas no binário em tempo de compilação.
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
