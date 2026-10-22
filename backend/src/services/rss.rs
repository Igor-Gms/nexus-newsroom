//! Download e leitura (parsing) de feeds RSS/Atom.
//!
//! O `feed-rs` faz o trabalho pesado de interpretar o XML (RSS 0.9x/2.0, Atom e JSON Feed)
//! e devolve uma estrutura única. Aqui convertemos para tipos simples e seguros para o nosso banco.

use std::{net::IpAddr, sync::LazyLock, time::Duration};

use chrono::{DateTime, Utc};
use reqwest::{header, redirect, Client};
use scraper::{Html, Node, Selector};
use thiserror::Error;
use tokio::task::JoinHandle;
use url::Url;

const MAX_BODY_BYTES: usize = 5 * 1024 * 1024; // 5 MB
const MAX_ENTRIES_PER_FEED: usize = 100;
const MAX_DESCRIPTION_CHARS: usize = 300;
/// Quantos feeds anunciados na página (`<link rel="alternate">`) vamos testar.
const MAX_LINK_CANDIDATES: usize = 5;
/// Tempo máximo de cada tentativa durante a busca automática.
const PROBE_TIMEOUT: Duration = Duration::from_secs(8);
/// Caminhos onde sites costumam publicar o feed (usados quando a página não anuncia nenhum).
const COMMON_FEED_PATHS: &[&str] = &[
    "/feed",
    "/feed/",
    "/rss",
    "/rss.xml",
    "/atom.xml",
    "/feed.xml",
    "/index.xml",
    "/feeds/posts/default", // Blogger
];

#[derive(Debug, Error)]
pub enum FetchError {
    #[error("URL inválida: {0}")]
    InvalidUrl(String),
    #[error("endereço não permitido: informe uma URL pública http(s)")]
    Blocked,
    #[error("não foi possível acessar a URL: {0}")]
    Network(String),
    #[error("o servidor respondeu com status HTTP {0}")]
    Status(u16),
    #[error("o feed excede o tamanho máximo de 5 MB")]
    TooLarge,
    #[error("o conteúdo não é um feed RSS/Atom válido")]
    NotAFeed,
    #[error(
        "não encontramos nenhum feed RSS ou Atom em {0}. O site pode não oferecer feed. \
         Se você souber o endereço do feed, cole o link direto dele (costuma terminar em /feed, /rss ou .xml)"
    )]
    FeedNotFound(String),
}

/// Resultado da busca automática: o endereço real do feed e o conteúdo já interpretado.
#[derive(Debug)]
pub struct DiscoveredFeed {
    pub url: Url,
    pub feed: ParsedFeed,
}

#[derive(Debug)]
pub struct ParsedFeed {
    pub title: String,
    pub site_url: Option<String>,
    pub description: Option<String>,
    pub entries: Vec<ParsedEntry>,
}

#[derive(Debug)]
pub struct ParsedEntry {
    pub guid: String,
    pub title: String,
    pub description: Option<String>,
    pub link: String,
    pub image_url: Option<String>,
    pub author: Option<String>,
    pub published_at: DateTime<Utc>,
}

// ------------------------------------------------------------ HTTP client

pub fn build_http_client(allow_private: bool) -> reqwest::Result<Client> {
    // Política de redirecionamento: no máximo 3 saltos e, em produção,
    // nunca seguir para um IP privado (evita desvio da proteção SSRF).
    let policy = redirect::Policy::custom(move |attempt| {
        if attempt.previous().len() >= 3 {
            attempt.error("redirecionamentos demais")
        } else if !allow_private && is_blocked_literal_host(attempt.url()) {
            attempt.error("redirecionamento para endereço não permitido")
        } else {
            attempt.follow()
        }
    });

    Client::builder()
        .user_agent(concat!("NexusFeed/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(15))
        .redirect(policy)
        .build()
}

// --------------------------------------------------- Proteção contra SSRF
//
// O usuário informa uma URL e o *servidor* faz a requisição. Sem cuidado, alguém poderia
// pedir `http://localhost:...` ou `http://192.168.x.x` e usar a API para acessar a rede interna.

/// Valida o formato da URL e confirma que ela aponta para um endereço público.
pub async fn ensure_public_url(raw: &str, allow_private: bool) -> Result<Url, FetchError> {
    let url = Url::parse(raw.trim()).map_err(|e| FetchError::InvalidUrl(e.to_string()))?;

    if !matches!(url.scheme(), "http" | "https") {
        return Err(FetchError::InvalidUrl("use http:// ou https://".into()));
    }
    let host = url
        .host_str()
        .ok_or_else(|| FetchError::InvalidUrl("a URL não tem domínio".into()))?
        .to_string();

    if allow_private {
        return Ok(url);
    }
    if is_blocked_literal_host(&url) {
        return Err(FetchError::Blocked);
    }

    // Resolve o DNS e confere TODOS os IPs retornados.
    let port = url.port_or_known_default().unwrap_or(80);
    let addrs = tokio::net::lookup_host((host.as_str(), port))
        .await
        .map_err(|_| FetchError::Network("o domínio não pôde ser resolvido".into()))?;

    let mut found_any = false;
    for addr in addrs {
        found_any = true;
        if !is_public_ip(addr.ip()) {
            return Err(FetchError::Blocked);
        }
    }
    if !found_any {
        return Err(FetchError::Network(
            "o domínio não pôde ser resolvido".into(),
        ));
    }
    Ok(url)
}

/// Bloqueia `localhost` e IPs privados escritos diretamente na URL (sem DNS).
fn is_blocked_literal_host(url: &Url) -> bool {
    match url.host() {
        Some(url::Host::Domain(d)) => {
            let d = d.to_ascii_lowercase();
            d == "localhost" || d.ends_with(".localhost") || d.ends_with(".local")
        }
        Some(url::Host::Ipv4(ip)) => !is_public_ip(IpAddr::V4(ip)),
        Some(url::Host::Ipv6(ip)) => !is_public_ip(IpAddr::V6(ip)),
        None => true,
    }
}

pub fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let o = v4.octets();
            !(v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_unspecified()
                || v4.is_documentation()
                || o[0] == 0
                || (o[0] == 100 && (o[1] & 0b1100_0000) == 64)) // 100.64.0.0/10 (CGNAT)
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(v4));
            }
            let first = v6.segments()[0];
            !(v6.is_loopback()
                || v6.is_unspecified()
                || (first & 0xfe00) == 0xfc00 // fc00::/7  (ULA)
                || (first & 0xffc0) == 0xfe80) // fe80::/10 (link-local)
        }
    }
}

// ------------------------------------------------------------------ Fetch

/// Conteúdo baixado e o endereço final (depois de redirecionamentos).
struct Downloaded {
    final_url: Url,
    body: Vec<u8>,
}

/// Baixa a URL, limitando o tamanho do corpo.
async fn download(client: &Client, url: &Url) -> Result<Downloaded, FetchError> {
    let mut response = client
        .get(url.clone())
        .header(
            header::ACCEPT,
            "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5",
        )
        .send()
        .await
        .map_err(|e| FetchError::Network(e.without_url().to_string()))?;

    if !response.status().is_success() {
        return Err(FetchError::Status(response.status().as_u16()));
    }
    let final_url = response.url().clone();

    // Lê o corpo em pedaços para nunca carregar um arquivo gigante na memória.
    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| FetchError::Network(e.without_url().to_string()))?
    {
        if body.len() + chunk.len() > MAX_BODY_BYTES {
            return Err(FetchError::TooLarge);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(Downloaded { final_url, body })
}

/// Baixa a URL e interpreta o XML como feed (usado no refresh, onde o endereço do feed já é conhecido).
pub async fn fetch_feed(client: &Client, url: &Url) -> Result<ParsedFeed, FetchError> {
    let downloaded = download(client, url).await?;
    parse_feed(&downloaded.body, url)
}

// -------------------------------------------------- Busca automática do feed

/// Recebe o endereço de um feed **ou de um site** e devolve o feed encontrado.
///
/// Ordem da busca:
/// 1. o próprio link já é um feed (RSS, Atom ou JSON Feed);
/// 2. a página HTML anuncia o feed em `<link rel="alternate" type="application/rss+xml" href="...">`;
/// 3. caminhos comuns do site (`/feed`, `/rss`, `/atom.xml`...).
///
/// Se nada servir, devolve `FeedNotFound`, com uma mensagem pronta para o usuário.
pub async fn discover_feed(
    client: &Client,
    url: &Url,
    allow_private: bool,
) -> Result<DiscoveredFeed, FetchError> {
    // 1. Tenta baixar a URL informada.
    // Se a página inicial falhar, ainda tentamos os caminhos comuns de RSS.
    let page = match download(client, url).await {
        Ok(page) => page,
        Err(original_error) => {
            let candidates = common_feed_candidates(url);

            if let Some(found) = probe_candidates(client, candidates, url, allow_private).await {
                return Ok(found);
            }

            // Se nenhuma alternativa funcionar, preserva o erro original.
            return Err(original_error);
        }
    };

    // 2. A URL informada já pode ser um feed RSS, Atom ou JSON Feed.
    if let Ok(feed) = parse_feed(&page.body, &page.final_url) {
        return Ok(DiscoveredFeed {
            url: page.final_url,
            feed,
        });
    }

    // 3. Procura feeds anunciados no HTML da página.
    let html = String::from_utf8_lossy(&page.body);
    let announced = feed_links_in_html(&html, &page.final_url);

    if let Some(found) = probe_candidates(client, announced, url, allow_private).await {
        return Ok(found);
    }

    // 4. Se não houver feed anunciado, tenta caminhos conhecidos.
    let common = common_feed_candidates(&page.final_url);

    if let Some(found) = probe_candidates(client, common, url, allow_private).await {
        return Ok(found);
    }

    // 5. Nenhum feed válido foi encontrado.
    Err(FetchError::FeedNotFound(
        url.host_str().unwrap_or("esse endereço").to_string(),
    ))
}

/// Testa os candidatos **em paralelo** e devolve o primeiro, na ordem da lista, que for um feed válido.
async fn probe_candidates(
    client: &Client,
    candidates: Vec<Url>,
    original: &Url,
    allow_private: bool,
) -> Option<DiscoveredFeed> {
    let handles: Vec<JoinHandle<Option<DiscoveredFeed>>> = candidates
        .into_iter()
        .filter(|c| c != original)
        .map(|candidate| {
            let client = client.clone();
            tokio::spawn(async move {
                // Os endereços vêm de HTML de terceiros: passam pela mesma proteção SSRF.
                let url = ensure_public_url(candidate.as_str(), allow_private)
                    .await
                    .ok()?;
                let feed = tokio::time::timeout(PROBE_TIMEOUT, fetch_feed(&client, &url))
                    .await
                    .ok()?
                    .ok()?;
                Some(DiscoveredFeed { url, feed })
            })
        })
        .collect();

    let mut remaining = handles.into_iter();
    let mut winner = None;
    for handle in remaining.by_ref() {
        if let Ok(Some(found)) = handle.await {
            winner = Some(found);
            break;
        }
    }
    // Já temos um vencedor (ou acabaram as opções): cancela o que ainda estiver em andamento.
    for handle in remaining {
        handle.abort();
    }
    winner
}

static LINK_SELECTOR: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse("link[rel][href]").expect("seletor CSS válido"));
static BASE_SELECTOR: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse("base[href]").expect("seletor CSS válido"));

/// Tipos MIME que os sites usam para anunciar um feed.
const FEED_MIME_TYPES: &[&str] = &[
    "application/rss+xml",
    "application/atom+xml",
    "application/rdf+xml",
    "application/feed+json",
    "application/xml",
    "text/xml",
];

/// Lê as tags `<link rel="alternate" type="application/rss+xml" href="...">` de uma página HTML.
/// Resolve endereços relativos (respeitando `<base href>`), ignora o que não for http(s)
/// e deixa por último os feeds de comentários.
fn feed_links_in_html(html: &str, page_url: &Url) -> Vec<Url> {
    let document = Html::parse_document(html);

    let base = document
        .select(&BASE_SELECTOR)
        .next()
        .and_then(|b| b.value().attr("href"))
        .and_then(|href| page_url.join(href).ok())
        .unwrap_or_else(|| page_url.clone());

    let mut found: Vec<(bool, Url)> = Vec::new();
    for link in document.select(&LINK_SELECTOR) {
        let el = link.value();
        let is_alternate = el.attr("rel").is_some_and(|rel| {
            rel.split_whitespace()
                .any(|t| t.eq_ignore_ascii_case("alternate"))
        });
        let mime = el
            .attr("type")
            .map(|t| {
                t.split(';')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_ascii_lowercase()
            })
            .unwrap_or_default();
        if !is_alternate || !FEED_MIME_TYPES.contains(&mime.as_str()) {
            continue;
        }
        let Some(url) = el
            .attr("href")
            .and_then(|href| base.join(href.trim()).ok())
            .filter(|u| matches!(u.scheme(), "http" | "https"))
        else {
            continue;
        };
        let title = el.attr("title").unwrap_or("").to_lowercase();
        let is_comments = url.as_str().to_lowercase().contains("comment")
            || title.contains("comment")
            || title.contains("comentário");
        if !found.iter().any(|(_, u)| *u == url) {
            found.push((is_comments, url));
        }
    }

    found.sort_by_key(|(is_comments, _)| *is_comments); // ordenação estável: mantém a ordem da página
    found
        .into_iter()
        .map(|(_, url)| url)
        .take(MAX_LINK_CANDIDATES)
        .collect()
}

/// Caminhos comuns de feed na raiz do site e, se o link tem caminho (ex.: `/blog`), dentro dele.
fn common_feed_candidates(page_url: &Url) -> Vec<Url> {
    let origin = page_url.origin().ascii_serialization();
    let mut candidates: Vec<Url> = COMMON_FEED_PATHS
        .iter()
        .filter_map(|path| Url::parse(&format!("{origin}{path}")).ok())
        .collect();

    let section = page_url.path().trim_end_matches('/');
    if !section.is_empty() {
        for suffix in ["feed", "rss"] {
            if let Ok(url) = Url::parse(&format!("{origin}{section}/{suffix}")) {
                candidates.push(url);
            }
        }
    }
    candidates
}

// ---------------------------------------------------------------- Parsing

pub fn parse_feed(bytes: &[u8], feed_url: &Url) -> Result<ParsedFeed, FetchError> {
    let feed = feed_rs::parser::parse(bytes).map_err(|_| FetchError::NotAFeed)?;

    let title = feed
        .title
        .map(|t| html_to_text(&t.content))
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| feed_url.host_str().unwrap_or("Feed sem título").to_string());

    let site_url = feed
        .links
        .iter()
        .filter(|l| l.rel.as_deref() != Some("self"))
        .find_map(|l| http_url(&l.href));

    let description = feed
        .description
        .map(|t| html_to_text(&t.content))
        .filter(|t| !t.is_empty());

    let now = Utc::now();
    let entries = feed
        .entries
        .into_iter()
        .take(MAX_ENTRIES_PER_FEED)
        .filter_map(|entry| {
            // Sem link válido (http/https) não há como "abrir o artigo original": ignora o item.
            let link = entry.links.iter().find_map(|l| http_url(&l.href))?;

            let raw_html = entry
                .summary
                .as_ref()
                .map(|s| s.content.clone())
                .or_else(|| entry.content.as_ref().and_then(|c| c.body.clone()))
                .unwrap_or_default();

            let image_url = image_from_media(&entry).or_else(|| first_image_in_html(&raw_html));

            let title = entry
                .title
                .as_ref()
                .map(|t| html_to_text(&t.content))
                .filter(|t| !t.is_empty())
                .unwrap_or_else(|| "(Sem título)".to_string());

            let description = Some(truncate_chars(
                &html_to_text(&raw_html),
                MAX_DESCRIPTION_CHARS,
            ))
            .filter(|d| !d.is_empty());

            let author = entry
                .authors
                .first()
                .map(|p| p.name.trim().to_string())
                .filter(|n| !n.is_empty());

            let guid = if entry.id.trim().is_empty() {
                link.clone()
            } else {
                entry.id.clone()
            };

            // Datas no futuro (feeds mal configurados) são limitadas a "agora".
            let published_at = entry.published.or(entry.updated).unwrap_or(now).min(now);

            Some(ParsedEntry {
                guid,
                title,
                description,
                link,
                image_url,
                author,
                published_at,
            })
        })
        .collect();

    Ok(ParsedFeed {
        title,
        site_url,
        description,
        entries,
    })
}

/// Aceita somente URLs http(s). Impede links `javascript:` e `data:` vindos do XML.
fn http_url(raw: &str) -> Option<String> {
    let url = Url::parse(raw.trim()).ok()?;
    matches!(url.scheme(), "http" | "https").then(|| url.to_string())
}

fn image_from_media(entry: &feed_rs::model::Entry) -> Option<String> {
    for media in &entry.media {
        if let Some(thumb) = media.thumbnails.first() {
            if let Some(url) = http_url(&thumb.image.uri) {
                return Some(url);
            }
        }
        for content in &media.content {
            let is_image = content
                .content_type
                .as_ref()
                .is_some_and(|m| m.ty().as_str() == "image");
            if is_image {
                if let Some(url) = content.url.as_ref().and_then(|u| http_url(u.as_str())) {
                    return Some(url);
                }
            }
        }
    }
    None
}

static IMG_SELECTOR: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse("img[src]").expect("seletor CSS válido"));

fn first_image_in_html(html: &str) -> Option<String> {
    if html.is_empty() {
        return None;
    }
    Html::parse_fragment(html)
        .select(&IMG_SELECTOR)
        .find_map(|img| img.value().attr("src").and_then(http_url))
}

/// Elementos que criam uma quebra visual: entre eles inserimos um espaço
/// (tags "inline", como <b> e <a>, não separam as palavras).
const BLOCK_TAGS: &[&str] = &[
    "p",
    "div",
    "br",
    "li",
    "ul",
    "ol",
    "tr",
    "td",
    "th",
    "table",
    "blockquote",
    "section",
    "article",
    "header",
    "footer",
    "pre",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "figure",
    "figcaption",
];

/// Converte HTML em texto puro (sem tags, sem scripts/estilos e com espaços normalizados).
/// O frontend recebe apenas texto, o que elimina o risco de HTML malicioso vindo dos feeds.
fn html_to_text(html: &str) -> String {
    let fragment = Html::parse_fragment(html);
    let mut text = String::new();

    // `descendants()` percorre a árvore na ordem do documento.
    for node in fragment.root_element().descendants() {
        match node.value() {
            Node::Element(e) if BLOCK_TAGS.contains(&e.name()) => text.push(' '),
            Node::Text(t) => {
                let inside_script_or_style = node.ancestors().any(|a| {
                    matches!(a.value(), Node::Element(e) if matches!(e.name(), "script" | "style"))
                });
                if !inside_script_or_style {
                    text.push_str(t);
                }
            }
            _ => {}
        }
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate_chars(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let cut: String = text.chars().take(max).collect();
    format!("{}…", cut.trim_end())
}

// ------------------------------------------------------------------ Testes

#[cfg(test)]
mod tests {
    use super::*;

    const RSS_SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Blog de Teste</title>
    <link>https://exemplo.com</link>
    <description>Um feed de exemplo</description>
    <item>
      <title>Primeiro post</title>
      <link>https://exemplo.com/post-1</link>
      <guid>post-1</guid>
      <pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Texto <b>com</b> HTML</p><img src="https://exemplo.com/img.jpg"><script>alert(1)</script>]]></description>
    </item>
    <item>
      <title>Link perigoso</title>
      <link>javascript:alert(1)</link>
      <guid>post-2</guid>
    </item>
  </channel>
</rss>"#;

    const ATOM_SAMPLE: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Feed Atom</title>
  <link rel="self" href="https://exemplo.com/atom.xml"/>
  <link rel="alternate" href="https://exemplo.com/"/>
  <updated>2026-10-05T10:00:00Z</updated>
  <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
  <entry>
    <title>Entrada Atom</title>
    <link href="https://exemplo.com/atom-1"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
    <updated>2026-10-05T10:00:00Z</updated>
    <author><name>Maria</name></author>
    <summary>Resumo da entrada</summary>
  </entry>
</feed>"#;

    fn url() -> Url {
        Url::parse("https://exemplo.com/feed.xml").unwrap()
    }

    #[test]
    fn parses_rss_and_sanitizes_html() {
        let feed = parse_feed(RSS_SAMPLE.as_bytes(), &url()).unwrap();
        assert_eq!(feed.title, "Blog de Teste");
        assert_eq!(feed.site_url.as_deref(), Some("https://exemplo.com/"));
        // O item com link `javascript:` é descartado.
        assert_eq!(feed.entries.len(), 1);
        let e = &feed.entries[0];
        assert_eq!(e.title, "Primeiro post");
        assert_eq!(e.description.as_deref(), Some("Texto com HTML"));
        assert_eq!(e.image_url.as_deref(), Some("https://exemplo.com/img.jpg"));
    }

    #[test]
    fn html_to_text_keeps_inline_words_together() {
        assert_eq!(
            html_to_text("<p>Banco <b>simples</b>.</p><p>Outro</p>"),
            "Banco simples. Outro"
        );
        assert_eq!(html_to_text("linha 1<br>linha 2"), "linha 1 linha 2");
        assert_eq!(
            html_to_text("a&amp;b <style>x{}</style><script>y()</script>fim"),
            "a&b fim"
        );
    }

    #[test]
    fn parses_atom() {
        let feed = parse_feed(ATOM_SAMPLE.as_bytes(), &url()).unwrap();
        assert_eq!(feed.title, "Feed Atom");
        assert_eq!(feed.site_url.as_deref(), Some("https://exemplo.com/"));
        assert_eq!(feed.entries[0].author.as_deref(), Some("Maria"));
    }

    #[test]
    fn rejects_non_feed_content() {
        let err = parse_feed(b"<html><body>oi</body></html>", &url()).unwrap_err();
        assert!(matches!(err, FetchError::NotAFeed));
    }

    #[test]
    fn finds_announced_feeds_and_resolves_relative_links() {
        let html = r#"<html><head>
            <base href="https://cdn.exemplo.com/blog/">
            <link rel="stylesheet" href="/estilo.css">
            <link rel="alternate" type="application/rss+xml" title="Comentários" href="/comments/feed">
            <link rel="alternate" type="application/rss+xml" title="Posts" href="feed.xml">
            <link rel="ALTERNATE" type="application/atom+xml; charset=utf-8" href="https://exemplo.com/atom">
            <link rel="alternate" type="text/html" href="/versao-html">
            <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
            <link rel="alternate" type="application/rss+xml" href="feed.xml">
        </head><body></body></html>"#;
        let page = Url::parse("https://exemplo.com/").unwrap();
        let urls: Vec<String> = feed_links_in_html(html, &page)
            .iter()
            .map(|u| u.to_string())
            .collect();
        // Sem duplicatas, sem `javascript:`, sem HTML/CSS, e o feed de comentários fica por último.
        assert_eq!(
            urls,
            [
                "https://cdn.exemplo.com/blog/feed.xml",
                "https://exemplo.com/atom",
                "https://cdn.exemplo.com/comments/feed",
            ]
        );
    }

    #[test]
    fn page_without_feed_links_yields_no_candidates() {
        let page = Url::parse("https://exemplo.com/").unwrap();
        assert!(feed_links_in_html("<html><head><title>x</title></head></html>", &page).is_empty());
    }

    #[test]
    fn builds_common_feed_candidates() {
        let site = Url::parse("https://exemplo.com/").unwrap();
        let urls: Vec<String> = common_feed_candidates(&site)
            .iter()
            .map(|u| u.to_string())
            .collect();
        assert_eq!(
            urls.first().map(String::as_str),
            Some("https://exemplo.com/feed")
        );
        assert!(urls.contains(&"https://exemplo.com/atom.xml".to_string()));
        assert_eq!(urls.len(), COMMON_FEED_PATHS.len());

        let section = Url::parse("https://exemplo.com/blog/?x=1").unwrap();
        let urls: Vec<String> = common_feed_candidates(&section)
            .iter()
            .map(|u| u.to_string())
            .collect();
        assert!(urls.contains(&"https://exemplo.com/blog/feed".to_string()));
        assert!(urls.contains(&"https://exemplo.com/blog/rss".to_string()));
    }

    #[test]
    fn classifies_ips() {
        for private in [
            "127.0.0.1",
            "10.0.0.5",
            "192.168.1.10",
            "172.16.0.1",
            "169.254.1.1",
            "100.64.0.1",
            "::1",
            "fd00::1",
            "::ffff:127.0.0.1",
        ] {
            assert!(
                !is_public_ip(private.parse().unwrap()),
                "{private} deveria ser bloqueado"
            );
        }
        for public in ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"] {
            assert!(
                is_public_ip(public.parse().unwrap()),
                "{public} deveria ser permitido"
            );
        }
    }

    #[tokio::test]
    async fn blocks_private_urls() {
        for raw in [
            "http://localhost/feed",
            "http://127.0.0.1:8080/x",
            "http://[::1]/x",
            "ftp://exemplo.com/x",
            "javascript:alert(1)",
        ] {
            assert!(
                ensure_public_url(raw, false).await.is_err(),
                "{raw} deveria ser rejeitada"
            );
        }
    }
}
