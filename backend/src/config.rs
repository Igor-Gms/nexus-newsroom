//! Configuração da aplicação, lida de variáveis de ambiente (ou do arquivo `.env`).

use std::{env, net::SocketAddr};

use anyhow::Context;

#[derive(Debug, Clone)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub database_url: String,
    pub cors_origins: Vec<String>,
    /// 0 desativa a atualização automática.
    pub refresh_interval_minutes: u64,
    /// Apenas para desenvolvimento: libera URLs de localhost/rede privada.
    pub allow_private_urls: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
        let port = env::var("PORT").unwrap_or_else(|_| "3000".into());
        let bind_addr = format!("{host}:{port}")
            .parse::<SocketAddr>()
            .with_context(|| format!("HOST/PORT inválidos: {host}:{port}"))?;

        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173".into())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let refresh_interval_minutes = env::var("REFRESH_INTERVAL_MINUTES")
            .unwrap_or_else(|_| "15".into())
            .parse()
            .context("REFRESH_INTERVAL_MINUTES deve ser um número inteiro")?;

        Ok(Self {
            bind_addr,
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite://nexus_feed.db".into()),
            cors_origins,
            refresh_interval_minutes,
            allow_private_urls: matches!(
                env::var("ALLOW_PRIVATE_URLS").as_deref(),
                Ok("true") | Ok("1")
            ),
        })
    }
}
