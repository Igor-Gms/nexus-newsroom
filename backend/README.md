# NEXUS FEED API

Backend REST do **NEXUS FEED**, escrito em Rust com [Axum](https://github.com/tokio-rs/axum).
Ele cadastra fontes RSS/Atom, baixa e interpreta o XML, guarda os artigos em SQLite e expõe
os endpoints consumidos pelo frontend (React) via `VITE_API_BASE_URL`.

## Como rodar

Pré-requisito: Rust 1.85 ou superior (`rustup update`). Testado com Rust 1.91.

```bash
cp .env.example .env     # ajuste se precisar
cargo run                # sobe em http://127.0.0.1:3000
cargo test               # testes unitários + teste de ponta a ponta
```

O banco SQLite (`nexus_feed.db`) e as tabelas são criados automaticamente na primeira execução
(migrações em `migrations/`, aplicadas ao iniciar).

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Endereço da API (use `0.0.0.0` em Docker) |
| `DATABASE_URL` | `sqlite://nexus_feed.db` | Arquivo do banco |
| `CORS_ORIGINS` | `localhost` e `127.0.0.1` nas portas 8080 e 5173 | Origens permitidas, separadas por vírgula (`*` só em dev) |
| `REFRESH_INTERVAL_MINUTES` | `15` | Atualização automática dos feeds (`0` desativa) |
| `ALLOW_PRIVATE_URLS` | `false` | **Somente dev**: permite feeds em localhost/rede privada |
| `RUST_LOG` | `nexus_feed_api=debug,tower_http=info` | Nível de log |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Verificação de saúde |
| GET | `/api/feeds` | Lista as fontes |
| POST | `/api/feeds` | Cadastra uma fonte. A `url` pode ser a de um **feed ou a de um site** (busca automática do feed); valida o XML antes de salvar e devolve o `Feed` criado (201) |
| DELETE | `/api/feeds/:id` | Remove a fonte e seus artigos (204) |
| POST | `/api/feeds/:id/refresh` | Baixa o feed de novo e devolve o `Feed` atualizado |
| GET | `/api/articles` | Lista artigos com filtros e paginação |
| GET | `/api/articles/:id` | Detalhe de um artigo |
| POST | `/api/articles/:id/favorite` | Corpo `{ "favorite": true }`. Sem corpo, alterna o estado |
| POST | `/api/articles/:id/read` | Corpo `{ "read": false }`. Sem corpo, marca como lido |

Favoritar e marcar como lido definem o **valor exato** informado (idempotente), então um clique repetido ou
uma requisição reenviada não desfaz a ação. As duas rotas devolvem o artigo atualizado.

### Busca automática do feed (`POST /api/feeds`)

A `url` pode apontar para o próprio feed ou para a página inicial de um site (sempre com `http://` ou `https://`).
A API tenta, nesta ordem, e usa o primeiro que for um feed válido:

1. **A própria URL** (RSS, Atom ou JSON Feed).
2. **Feeds anunciados na página**: tags `<link rel="alternate" type="application/rss+xml|atom+xml|feed+json" href="...">`.
   Endereços relativos e `<base href>` são resolvidos, `javascript:` e similares são ignorados, no máximo 5 candidatos são
   testados e os feeds de comentários ficam por último.
3. **Caminhos comuns**: `/feed`, `/feed/`, `/rss`, `/rss.xml`, `/atom.xml`, `/feed.xml`, `/index.xml`,
   `/feeds/posts/default` e, se a URL tem caminho (`/blog`), também `/blog/feed` e `/blog/rss`.

Os candidatos são testados **em paralelo** (8 s por tentativa) e respeitam a mesma proteção SSRF da URL original.
A fonte é salva com o endereço do feed encontrado (`url` na resposta), e cadastrar o mesmo feed por outro caminho
(site e feed) retorna `409`. Se nada for encontrado, a resposta é `422` e nada é salvo:

```json
{ "error": { "code": "invalid_feed", "message": "não encontramos nenhum feed RSS ou Atom em exemplo.com. O site pode não oferecer feed. Se você souber o endereço do feed, cole o link direto dele (costuma terminar em /feed, /rss ou .xml)" } }
```

Limitação: a página é lida como HTML estático (sem executar JavaScript).

### `GET /api/articles`: parâmetros (todos opcionais)

| Parâmetro | Exemplo | Descrição |
|---|---|---|
| `category` | `Tecnologia` | Categoria da fonte |
| `feedId` | `3f2a...` | Uma fonte específica (`feed_id` também é aceito) |
| `period` | `24h`, `7d`, `30d`, `all` | Período de publicação |
| `q` | `rust` | Busca no título, resumo e nome da fonte |
| `favorite` | `true` | Apenas favoritos |
| `unread` | `true` | Apenas não lidos |
| `page` / `limit` | `1` / `24` | Paginação (`limit` máximo: 100) |

Para "sem filtro", **omita** o parâmetro (não envie `period=` vazio). Resposta:
`{ items, total, page, limit, totalPages }`, ordenada da publicação mais recente para a mais antiga.

### Exemplos

```bash
# Cadastrar uma fonte (pelo link do feed OU pelo endereço do site)
curl -X POST http://localhost:3000/api/feeds \
  -H "content-type: application/json" \
  -d '{"url":"https://exemplo.com","category":"Tecnologia"}'

# Artigos não lidos da última semana
curl "http://localhost:3000/api/articles?period=7d&unread=true"

# Favoritar
curl -X POST http://localhost:3000/api/articles/ID/favorite \
  -H "content-type: application/json" -d '{"favorite":true}'
```

### Erros

Todo erro segue o mesmo formato (o `message` é exibido pela interface):

```json
{ "error": { "code": "invalid_feed", "message": "o conteúdo não é um feed RSS/Atom válido" } }
```

| Status | `code` | Quando |
|---|---|---|
| 400 | `bad_request` | JSON ou parâmetros inválidos |
| 404 | `not_found` | Feed, artigo ou rota inexistente |
| 409 | `conflict` | Fonte já cadastrada |
| 422 | `invalid_feed` | Nenhum feed encontrado na URL/site, URL inválida ou não permitida |
| 502 | `upstream_error` | O site do feed falhou no refresh (a fonte fica com `status: "error"`) |
| 500 | `internal_error` | Erro interno (detalhes só no log) |

## Tipos TypeScript

São os mesmos de `src/types/nexus.ts` no frontend. O JSON usa **camelCase**, datas em ISO 8601 (UTC) e
**campos opcionais ausentes são omitidos** (nunca vêm como `null`).

```ts
export type FeedStatus = "active" | "error" | "pending"; // a API envia "active" ou "error"

export interface Feed {
  id: string;
  title: string;
  url: string;
  siteUrl?: string;
  description?: string;
  category: string;
  status: FeedStatus;
  errorMessage?: string;   // motivo da última falha de atualização
  lastFetchedAt?: string;
  createdAt: string;
  articleCount: number;
}

export interface Article {
  id: string;
  feedId: string;
  feedTitle: string;       // nome da fonte
  category: string;
  title: string;
  summary: string;         // texto puro, até 300 caracteres ("" se o feed não traz resumo)
  url: string;             // link do artigo original (sempre http/https)
  imageUrl?: string;
  author?: string;
  publishedAt: string;
  isFavorite: boolean;
  isRead: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## Estrutura do projeto

```
src/
  main.rs            inicialização: config, banco, tarefa em segundo plano, servidor
  lib.rs             módulos reutilizados por main.rs e pelos testes
  config.rs          variáveis de ambiente
  db.rs              conexão SQLite + migrações
  state.rs           AppState compartilhado (banco, cliente HTTP, config)
  error.rs           AppError -> resposta JSON padronizada (+ extratores AppJson/AppQuery)
  models.rs          tipos do banco e do contrato JSON
  repository.rs      consultas SQL reutilizadas
  routes/            handlers: feeds.rs e articles.rs (+ roteador e CORS em mod.rs)
  services/
    rss.rs           download, busca automática do feed, parsing do XML (feed-rs), sanitização e proteção SSRF
    refresh.rs       atualização de feeds (endpoint + tarefa automática)
migrations/          esquema SQL (001 tabelas, 002 status "active")
tests/api.rs         teste de ponta a ponta com servidor RSS local
```

## Decisões de segurança

- **SSRF**: o servidor busca URLs informadas por usuários, então só aceita `http(s)` para endereços
  públicos (bloqueia localhost, redes privadas, link-local e CGNAT, inclusive em redirecionamentos).
  Limitação conhecida: um atacante que controle o DNS poderia trocar o IP entre a validação e a
  conexão (*DNS rebinding*). Se a API for pública, rode-a em uma rede sem acesso a recursos internos.
- **Conteúdo dos feeds**: resumos viram texto puro (sem HTML/scripts). Links e imagens só são
  aceitos se forem `http(s)`, o que bloqueia `javascript:` e `data:`.
- **Limites**: feeds de até 5 MB, timeout de 15 s, 100 itens por feed.
- **SQL injection**: todos os valores entram como parâmetros preparados (`push_bind`).
- **Autenticação**: esta versão não tem login, e qualquer cliente permitido pelo CORS pode
  cadastrar e remover fontes. Antes de publicar, adicione autenticação.

## Próximos passos sugeridos

Autenticação (JWT) e feeds por usuário, limpeza de artigos antigos, `ETag`/`If-Modified-Since`
para economizar banda no refresh, importação de OPML e Dockerfile para deploy.
