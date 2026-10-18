//! Tipo de erro único da API. Todo erro vira uma resposta JSON padronizada:
//! `{ "error": { "code": "not_found", "message": "..." } }`

use axum::{
    extract::{
        rejection::{JsonRejection, QueryRejection},
        FromRequest, FromRequestParts,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    /// A URL informada não é um feed RSS/Atom válido (HTTP 422).
    #[error("{0}")]
    InvalidFeed(String),
    /// O site do feed falhou ao responder (HTTP 502).
    #[error("{0}")]
    Upstream(String),
    /// `#[from]` permite usar `?` em chamadas do sqlx dentro dos handlers.
    #[error("erro de banco de dados: {0}")]
    Database(#[from] sqlx::Error),
}

pub type AppResult<T> = Result<T, AppError>;

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found"),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            AppError::InvalidFeed(_) => (StatusCode::UNPROCESSABLE_ENTITY, "invalid_feed"),
            AppError::Upstream(_) => (StatusCode::BAD_GATEWAY, "upstream_error"),
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        };

        // Detalhes internos vão para o log, nunca para o cliente.
        let message = match &self {
            AppError::Database(e) => {
                tracing::error!(error = ?e, "falha no banco de dados");
                "Erro interno do servidor".to_string()
            }
            other => other.to_string(),
        };

        (
            status,
            axum::Json(json!({ "error": { "code": code, "message": message } })),
        )
            .into_response()
    }
}

// Extratores próprios: se o JSON ou a query string vierem inválidos,
// a resposta também sai no formato padrão de erro (e não em texto puro).

#[derive(FromRequest)]
#[from_request(via(axum::Json), rejection(AppError))]
pub struct AppJson<T>(pub T);

#[derive(FromRequestParts)]
#[from_request(via(axum::extract::Query), rejection(AppError))]
pub struct AppQuery<T>(pub T);

impl From<JsonRejection> for AppError {
    fn from(rejection: JsonRejection) -> Self {
        AppError::BadRequest(format!("corpo JSON inválido: {}", rejection.body_text()))
    }
}

impl From<QueryRejection> for AppError {
    fn from(rejection: QueryRejection) -> Self {
        AppError::BadRequest(format!("parâmetros inválidos: {}", rejection.body_text()))
    }
}
