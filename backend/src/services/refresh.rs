//! Atualização de feeds: usada tanto pelo endpoint de refresh quanto pela tarefa em segundo plano.

use std::time::Duration;

use chrono::Utc;
use tokio::time::{interval_at, Instant, MissedTickBehavior};

use crate::{
    error::{AppError, AppResult},
    models::{Feed, FeedStatus},
    repository,
    services::rss,
    state::AppState,
};

/// Baixa o feed de novo, grava os artigos novos e atualiza o status da fonte.
pub async fn refresh_feed(state: &AppState, feed_id: &str) -> AppResult<Feed> {
    let feed = repository::get_feed(&state.db, feed_id).await?;

    let result = async {
        let url = rss::ensure_public_url(&feed.url, state.config.allow_private_urls).await?;
        rss::fetch_feed(&state.http, &url).await
    }
    .await;

    match result {
        Ok(parsed) => {
            let new_articles = repository::upsert_articles(&state.db, feed_id, &parsed.entries).await?;
            sqlx::query(
                "UPDATE feeds SET status = ?, last_error = NULL, last_fetched_at = ?, \
                 site_url = COALESCE(?, site_url) WHERE id = ?",
            )
            .bind(FeedStatus::Active)
            .bind(Utc::now())
            .bind(&parsed.site_url)
            .bind(feed_id)
            .execute(&state.db)
            .await?;
            tracing::info!(feed = %feed.title, new_articles, "feed atualizado");
            repository::get_feed(&state.db, feed_id).await
        }
        Err(err) => {
            // Guardamos o erro para o frontend mostrar o estado da fonte.
            sqlx::query("UPDATE feeds SET status = ?, last_error = ?, last_fetched_at = ? WHERE id = ?")
                .bind(FeedStatus::Error)
                .bind(err.to_string())
                .bind(Utc::now())
                .bind(feed_id)
                .execute(&state.db)
                .await?;
            Err(AppError::Upstream(err.to_string()))
        }
    }
}

/// Atualiza todas as fontes, uma por vez (simples e gentil com os servidores dos feeds).
pub async fn refresh_all(state: &AppState) {
    let ids = match repository::list_feed_ids(&state.db).await {
        Ok(ids) => ids,
        Err(e) => {
            tracing::error!(error = ?e, "não foi possível listar os feeds");
            return;
        }
    };
    for id in ids {
        if let Err(e) = refresh_feed(state, &id).await {
            tracing::warn!(feed_id = %id, error = %e, "falha ao atualizar feed");
        }
    }
}

/// Tarefa em segundo plano (`tokio::spawn`): atualiza todas as fontes a cada N minutos.
pub async fn run_background_refresh(state: AppState) {
    let period = Duration::from_secs(state.config.refresh_interval_minutes.max(1) * 60);
    // Primeira execução só depois de um período completo (o startup fica rápido).
    let mut ticker = interval_at(Instant::now() + period, period);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);
    loop {
        ticker.tick().await;
        tracing::info!("iniciando atualização automática dos feeds");
        refresh_all(&state).await;
    }
}
