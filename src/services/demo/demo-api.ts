// DEMO ONLY — in-memory adapter used while VITE_API_BASE_URL is not set.
// Content is fictitious and labeled as demonstration in the UI. Delete this
// folder once the Rust API is connected.
import type { NexusApi } from "../contract";
import { ApiError } from "../api-client";
import type { Article, Feed } from "@/types/nexus";
import { createDemoData } from "./demo-data";

const state = createDemoData();
const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));
const PERIOD_MS = { "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5 } as const;

function findArticle(id: string): Article {
  const a = state.articles.find((x) => x.id === id);
  if (!a) throw new ApiError("Artigo não encontrado", 404);
  return a;
}

export const demoApi: NexusApi = {
  feeds: {
    async list() {
      await wait();
      return state.feeds.map((f) => ({
        ...f,
        articleCount: state.articles.filter((a) => a.feedId === f.id).length,
      }));
    },
    async create({ url, category }) {
      await wait(900);
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new ApiError("URL inválida. Use um endereço completo, ex.: https://site.com/feed.xml", 422);
      }
      if (!/^https?:$/.test(parsed.protocol)) throw new ApiError("Apenas URLs http(s) são aceitas.", 422);
      if (state.feeds.some((f) => f.url === parsed.href)) throw new ApiError("Esta fonte já está cadastrada.", 409);
      if (!/(rss|feed|atom|xml)/i.test(parsed.href))
        throw new ApiError("Nenhum feed RSS/Atom foi encontrado nesta URL (simulação de validação).", 422);
      const feed: Feed = {
        id: `demo-${Date.now()}`,
        title: parsed.hostname.replace(/^www\./, ""),
        url: parsed.href,
        siteUrl: parsed.origin,
        category: category || "Tecnologia",
        status: "pending",
        articleCount: 0,
        createdAt: new Date().toISOString(),
      };
      state.feeds.push(feed);
      return feed;
    },
    async remove(id) {
      await wait();
      state.feeds = state.feeds.filter((f) => f.id !== id);
      state.articles = state.articles.filter((a) => a.feedId !== id);
    },
    async refresh(id) {
      await wait(800);
      const f = state.feeds.find((x) => x.id === id);
      if (!f) throw new ApiError("Fonte não encontrada", 404);
      f.lastFetchedAt = new Date().toISOString();
      if (f.status === "pending") f.status = "active";
      return { ...f, articleCount: state.articles.filter((a) => a.feedId === id).length };
    },
  },
  articles: {
    async list(q) {
      await wait();
      const now = Date.now();
      const term = q.q?.trim().toLowerCase();
      let items = state.articles.filter((a) => {
        if (q.category && a.category !== q.category) return false;
        if (q.feedId && a.feedId !== q.feedId) return false;
        if (q.favorite && !a.isFavorite) return false;
        if (q.period && q.period !== "all" && now - Date.parse(a.publishedAt) > PERIOD_MS[q.period]) return false;
        if (term && !`${a.title} ${a.summary} ${a.feedTitle}`.toLowerCase().includes(term)) return false;
        return true;
      });
      items = items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      const total = items.length;
      return { items: (q.limit ? items.slice(0, q.limit) : items).map((a) => ({ ...a })), total };
    },
    async get(id) {
      await wait(200);
      return { ...findArticle(id) };
    },
    async setFavorite(id, favorite) {
      await wait(150);
      const a = findArticle(id);
      a.isFavorite = favorite;
      return { ...a };
    },
    async setRead(id, read) {
      await wait(150);
      const a = findArticle(id);
      a.isRead = read;
      return { ...a };
    },
  },
};
