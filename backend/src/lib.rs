//! NEXUS FEED API — backend REST do agregador de notícias RSS.
//!
//! A biblioteca expõe os módulos para que `main.rs` e os testes de integração
//! (pasta `tests/`) possam reutilizar o mesmo código.

pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod repository;
pub mod routes;
pub mod services;
pub mod state;
