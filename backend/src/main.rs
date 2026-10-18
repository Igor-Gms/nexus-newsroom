use std::sync::Arc;

use nexus_feed_api::{config::Config, db, routes, services, state::AppState};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Carrega o arquivo .env (se existir) e inicia os logs.
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("nexus_feed_api=debug,tower_http=info")),
        )
        .init();

    let config = Config::from_env()?;
    let pool = db::connect(&config.database_url).await?;
    let http = services::rss::build_http_client(config.allow_private_urls)?;

    let state = AppState {
        db: pool,
        http,
        config: Arc::new(config.clone()),
    };

    // Atualização automática dos feeds em segundo plano.
    if config.refresh_interval_minutes > 0 {
        tokio::spawn(services::refresh::run_background_refresh(state.clone()));
    }

    let app = routes::router(state);
    let listener = TcpListener::bind(config.bind_addr).await?;
    tracing::info!("API ouvindo em http://{}", listener.local_addr()?);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// Espera Ctrl+C (ou SIGTERM no Linux/Docker) para encerrar sem derrubar requisições em andamento.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.expect("falha ao ouvir Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("falha ao ouvir SIGTERM")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("encerrando...");
}
