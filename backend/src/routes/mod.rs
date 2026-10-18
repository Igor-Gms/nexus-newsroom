mod articles;
mod feeds;

use std::time::Duration;

use axum::{
    http::{header::CONTENT_TYPE, HeaderValue, Method},
    routing::{delete, get, post},
    Json, Router,
};
use serde_json::{json, Value};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::{error::AppError, state::AppState};

pub fn router(state: AppState) -> Router {
    let cors = cors_layer(&state.config.cors_origins);

    Router::new()
        .route("/api/health", get(health))
        // Fontes RSS
        .route("/api/feeds", get(feeds::list_feeds).post(feeds::create_feed))
        .route("/api/feeds/{id}", delete(feeds::delete_feed))
        .route("/api/feeds/{id}/refresh", post(feeds::refresh_feed))
        // Artigos
        .route("/api/articles", get(articles::list_articles))
        .route("/api/articles/{id}", get(articles::get_article))
        .route("/api/articles/{id}/favorite", post(articles::set_favorite))
        .route("/api/articles/{id}/read", post(articles::set_read))
        .fallback(|| async { AppError::NotFound("rota não encontrada".into()) })
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION") }))
}

fn cors_layer(origins: &[String]) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE])
        .max_age(Duration::from_secs(3600));

    if origins.iter().any(|o| o == "*") {
        base.allow_origin(Any)
    } else {
        let allowed: Vec<HeaderValue> = origins.iter().filter_map(|o| o.parse().ok()).collect();
        base.allow_origin(allowed)
    }
}
