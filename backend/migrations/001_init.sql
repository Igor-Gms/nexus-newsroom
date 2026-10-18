-- Fontes RSS cadastradas pelo usuário
CREATE TABLE IF NOT EXISTS feeds (
    id              TEXT PRIMARY KEY NOT NULL,
    title           TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    site_url        TEXT,
    description     TEXT,
    category        TEXT NOT NULL DEFAULT 'Geral',
    status          TEXT NOT NULL DEFAULT 'ok',      -- 'ok' | 'error'
    last_error      TEXT,
    last_fetched_at TEXT,
    created_at      TEXT NOT NULL
);

-- Artigos importados dos feeds
CREATE TABLE IF NOT EXISTS articles (
    id           TEXT PRIMARY KEY NOT NULL,
    feed_id      TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    guid         TEXT NOT NULL,                      -- identificador do item dentro do feed
    title        TEXT NOT NULL,
    description  TEXT,
    link         TEXT NOT NULL,
    image_url    TEXT,
    author       TEXT,
    published_at TEXT NOT NULL,
    is_favorite  INTEGER NOT NULL DEFAULT 0,
    is_read      INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    UNIQUE (feed_id, guid)                           -- evita duplicar o mesmo item a cada refresh
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_feed      ON articles (feed_id);
