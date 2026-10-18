//! Teste de ponta a ponta: sobe um servidor RSS local, cadastra a fonte pela API
//! e exercita todos os endpoints (sem precisar de internet).

use std::sync::Arc;

use axum::{
    body::{to_bytes, Body},
    http::{header, Request, StatusCode},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use nexus_feed_api::{config::Config, db, routes, services::rss, state::AppState};
use serde_json::{json, Value};
use tower::ServiceExt; // fornece `.oneshot()`
use uuid::Uuid;

const FEED_XML: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Feed de Teste</title>
    <link>https://exemplo.com</link>
    <item><title>Rust 2026 chegou</title><link>https://exemplo.com/a</link><guid>a</guid>
      <pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><description>Novidades da linguagem</description></item>
    <item><title>Axum em produção</title><link>https://exemplo.com/b</link><guid>b</guid>
      <pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate><description>Dicas de deploy</description></item>
  </channel>
</rss>"#;

/// Sobe um servidor HTTP local com as rotas informadas e devolve o endereço base.
async fn spawn_site(app: Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

async fn rss() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "application/rss+xml")], FEED_XML)
}

/// Site com o feed em `/feed.xml` (um dos caminhos comuns) e uma página HTML sem tag de feed.
async fn spawn_feed_server() -> String {
    spawn_site(
        Router::new()
            .route("/feed.xml", get(rss))
            .route("/pagina", get(|| async { Html("<html><body>página comum</body></html>") })),
    )
    .await
}

async fn test_app(allow_private: bool) -> Router {
    let db_path = std::env::temp_dir().join(format!("nexus-test-{}.db", Uuid::new_v4()));
    let config = Config {
        bind_addr: "127.0.0.1:0".parse().unwrap(),
        database_url: format!("sqlite://{}", db_path.display()),
        cors_origins: vec!["*".into()],
        refresh_interval_minutes: 0,
        allow_private_urls: allow_private,
    };
    let pool = db::connect(&config.database_url).await.unwrap();
    let http = rss::build_http_client(allow_private).unwrap();
    routes::router(AppState { db: pool, http, config: Arc::new(config) })
}

async fn call(app: &Router, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    let body = match body {
        Some(json) => {
            req = req.header(header::CONTENT_TYPE, "application/json");
            Body::from(json.to_string())
        }
        None => Body::empty(),
    };
    let response = app.clone().oneshot(req.body(body).unwrap()).await.unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).unwrap_or(Value::Null) };
    (status, value)
}

#[tokio::test]
async fn full_flow() {
    let server = spawn_feed_server().await;
    let app = test_app(true).await;

    // Lista vazia no início
    let (status, body) = call(&app, "GET", "/api/feeds", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!([]));

    // Cadastro: feed válido
    let feed_url = format!("{server}/feed.xml");
    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": feed_url, "category": "Tecnologia" }))).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    // O cadastro devolve a própria fonte (contrato do frontend: tipo `Feed`).
    assert_eq!(body["title"], "Feed de Teste");
    assert_eq!(body["category"], "Tecnologia");
    assert_eq!(body["status"], "active");
    assert_eq!(body["articleCount"], 2);
    assert_eq!(body["siteUrl"], "https://exemplo.com/");
    // Campos opcionais ausentes são omitidos (e não `null`).
    assert!(body.get("errorMessage").is_none());
    let feed_id = body["id"].as_str().unwrap().to_string();

    // Cadastro repetido -> 409
    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": feed_url }))).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"]["code"], "conflict");

    // Link de uma página do mesmo site: a API acha o feed (/feed.xml), que já está cadastrado -> 409
    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{server}/pagina") }))).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body["error"]["message"].as_str().unwrap().contains("já está cadastrada"));

    // JSON inválido -> 400 no formato padrão
    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "naoEhUrl": 1 }))).await;
    assert!(status.is_client_error());
    assert!(body["error"]["message"].is_string());

    // Listagem de artigos (mais recente primeiro)
    let (status, body) = call(&app, "GET", "/api/articles", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["total"], 2);
    assert_eq!(body["items"][0]["title"], "Axum em produção");
    assert_eq!(body["items"][0]["feedTitle"], "Feed de Teste");
    assert_eq!(body["items"][0]["summary"], "Dicas de deploy");
    assert_eq!(body["items"][0]["url"], "https://exemplo.com/b");
    assert_eq!(body["items"][0]["category"], "Tecnologia");
    assert_eq!(body["items"][0]["isRead"], false);
    assert!(body["items"][0].get("imageUrl").is_none());
    let article_id = body["items"][0]["id"].as_str().unwrap().to_string();

    // Filtros: busca, categoria, fonte, período
    let (_, body) = call(&app, "GET", "/api/articles?q=rust", None).await;
    assert_eq!(body["total"], 1);
    let (_, body) = call(&app, "GET", "/api/articles?q=100%25", None).await; // '%' é literal
    assert_eq!(body["total"], 0);
    let (_, body) = call(&app, "GET", "/api/articles?category=Esportes", None).await;
    assert_eq!(body["total"], 0);
    let (_, body) = call(&app, "GET", &format!("/api/articles?feedId={feed_id}&category=Tecnologia"), None).await;
    assert_eq!(body["total"], 2);
    let (_, body) = call(&app, "GET", &format!("/api/articles?feed_id={feed_id}"), None).await; // alias legado
    assert_eq!(body["total"], 2);
    let (_, body) = call(&app, "GET", "/api/articles?feedId=outra-fonte", None).await;
    assert_eq!(body["total"], 0);
    let (_, body) = call(&app, "GET", "/api/articles?period=24h", None).await;
    assert_eq!(body["total"], 0); // as datas do XML são antigas
    let (_, body) = call(&app, "GET", "/api/articles?period=all&page=2&limit=1", None).await;
    assert_eq!(body["items"].as_array().unwrap().len(), 1);
    assert_eq!(body["totalPages"], 2);
    let (status, _) = call(&app, "GET", "/api/articles?period=banana", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Detalhe, favoritar (alterna), marcar como lido / não lido
    let (status, body) = call(&app, "GET", &format!("/api/articles/{article_id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], article_id.as_str());

    // Favorito: valor explícito (idempotente)
    let fav_uri = format!("/api/articles/{article_id}/favorite");
    let (_, body) = call(&app, "POST", &fav_uri, Some(json!({ "favorite": true }))).await;
    assert_eq!(body["isFavorite"], true);
    let (_, body) = call(&app, "POST", &fav_uri, Some(json!({ "favorite": true }))).await; // repetir não desfaz
    assert_eq!(body["isFavorite"], true);
    let (_, body) = call(&app, "GET", "/api/articles?favorite=true", None).await;
    assert_eq!(body["total"], 1);
    let (_, body) = call(&app, "POST", &fav_uri, Some(json!({ "favorite": false }))).await;
    assert_eq!(body["isFavorite"], false);
    // Sem corpo: alterna
    let (_, body) = call(&app, "POST", &fav_uri, None).await;
    assert_eq!(body["isFavorite"], true);
    let (_, body) = call(&app, "POST", &fav_uri, None).await;
    assert_eq!(body["isFavorite"], false);
    // Corpo inválido -> 400
    let (status, body) = call(&app, "POST", &fav_uri, Some(json!({ "favorite": "talvez" }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "bad_request");

    // Lido / não lido
    let read_uri = format!("/api/articles/{article_id}/read");
    let (_, body) = call(&app, "POST", &read_uri, Some(json!({ "read": true }))).await;
    assert_eq!(body["isRead"], true);
    let (_, body) = call(&app, "GET", "/api/articles?unread=true", None).await;
    assert_eq!(body["total"], 1);
    let (_, body) = call(&app, "POST", &read_uri, Some(json!({ "read": false }))).await;
    assert_eq!(body["isRead"], false);
    let (_, body) = call(&app, "POST", &read_uri, None).await; // sem corpo: marca como lido
    assert_eq!(body["isRead"], true);

    let (status, _) = call(&app, "GET", "/api/articles/nao-existe", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Refresh não duplica artigos e preserva o estado de leitura/favorito
    call(&app, "POST", &fav_uri, Some(json!({ "favorite": true }))).await;
    let (status, body) = call(&app, "POST", &format!("/api/feeds/{feed_id}/refresh"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["articleCount"], 2);
    assert_eq!(body["status"], "active");
    let (_, body) = call(&app, "GET", &format!("/api/articles/{article_id}"), None).await;
    assert_eq!(body["isFavorite"], true);
    assert_eq!(body["isRead"], true);

    // Remoção da fonte apaga os artigos (cascata)
    let (status, _) = call(&app, "DELETE", &format!("/api/feeds/{feed_id}"), None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, body) = call(&app, "GET", "/api/articles", None).await;
    assert_eq!(body["total"], 0);
    let (status, _) = call(&app, "DELETE", &format!("/api/feeds/{feed_id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = call(&app, "POST", &format!("/api/feeds/{feed_id}/refresh"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn rejects_private_urls_by_default() {
    let server = spawn_feed_server().await; // escuta em 127.0.0.1
    let app = test_app(false).await;
    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{server}/feed.xml") }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["error"]["code"], "invalid_feed");
}

#[tokio::test]
async fn health_and_unknown_route() {
    let app = test_app(false).await;
    let (status, body) = call(&app, "GET", "/api/health", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    let (status, body) = call(&app, "GET", "/api/nada", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");
}

// ------------------------------------------------------- Busca automática do feed

/// O usuário cola o endereço do SITE: a API lê a tag <link rel="alternate"> e cadastra o feed anunciado.
#[tokio::test]
async fn discovers_feed_announced_in_the_page() {
    let site = spawn_site(
        Router::new()
            .route(
                "/",
                get(|| async {
                    Html(
                        r#"<html><head>
                        <link rel="alternate" type="application/rss+xml" title="Comentários" href="/comentarios.xml">
                        <link rel="alternate" type="application/rss+xml" title="Notícias" href="/arquivo/noticias.xml">
                        </head><body>Meu site</body></html>"#,
                    )
                }),
            )
            // O feed de comentários anunciado primeiro não existe (404): deve ser ignorado.
            .route("/arquivo/noticias.xml", get(rss)),
    )
    .await;
    let app = test_app(true).await;

    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{site}/"), "category": "Notícias" }))).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    // A fonte é salva com o endereço REAL do feed, não com o do site.
    assert_eq!(body["url"], format!("{site}/arquivo/noticias.xml"));
    assert_eq!(body["title"], "Feed de Teste");
    assert_eq!(body["articleCount"], 2);

    // Colar o site de novo, ou o feed direto, é reconhecido como duplicata.
    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{site}/") }))).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body["error"]["message"].as_str().unwrap().contains("já está cadastrada"));
    let (status, _) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{site}/arquivo/noticias.xml") }))).await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (_, body) = call(&app, "GET", "/api/feeds", None).await;
    assert_eq!(body.as_array().unwrap().len(), 1);
}

/// Sem tag na página, a API tenta caminhos comuns (/feed, /rss, /atom.xml...).
#[tokio::test]
async fn discovers_feed_in_common_paths() {
    let site = spawn_site(
        Router::new()
            .route("/", get(|| async { Html("<html><head><title>Sem tag</title></head></html>") }))
            .route("/rss", get(rss)),
    )
    .await;
    let app = test_app(true).await;

    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{site}/") }))).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["url"], format!("{site}/rss"));
}

/// Se o link tem caminho (ex.: /blog), também procura dentro dele (/blog/feed).
#[tokio::test]
async fn discovers_feed_inside_a_section() {
    let site = spawn_site(
        Router::new()
            .route("/blog", get(|| async { Html("<html><body>blog</body></html>") }))
            .route("/blog/feed", get(rss)),
    )
    .await;
    let app = test_app(true).await;

    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{site}/blog") }))).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["url"], format!("{site}/blog/feed"));
}

/// Site sem nenhum feed: mensagem clara e nada é salvo.
#[tokio::test]
async fn explains_when_the_site_has_no_feed() {
    let site = spawn_site(
        Router::new()
            .route("/", get(|| async { Html("<html><head><link rel=\"stylesheet\" href=\"/a.css\"></head></html>") }))
            .route("/dados", get(|| async { ([(header::CONTENT_TYPE, "application/json")], "{\"a\":1}") })),
    )
    .await;
    let app = test_app(true).await;

    for path in ["/", "/dados"] {
        let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{site}{path}") }))).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{path}: {body}");
        assert_eq!(body["error"]["code"], "invalid_feed");
        let message = body["error"]["message"].as_str().unwrap();
        assert!(message.contains("não encontramos nenhum feed RSS ou Atom em 127.0.0.1"), "{message}");
        assert!(message.contains("cole o link direto"), "{message}");
    }

    let (_, body) = call(&app, "GET", "/api/feeds", None).await;
    assert_eq!(body, json!([]));
}

/// Endereço que nem responde (404): erro de acesso, não "feed não encontrado".
#[tokio::test]
async fn reports_http_errors_of_the_given_url() {
    let site = spawn_site(Router::new()).await;
    let app = test_app(true).await;
    let (status, body) = call(&app, "POST", "/api/feeds", Some(json!({ "url": format!("{site}/nao-existe") }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(body["error"]["message"].as_str().unwrap().contains("status HTTP 404"));
}
