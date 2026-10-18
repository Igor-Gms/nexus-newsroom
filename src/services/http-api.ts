import { request, toQueryString } from "./api-client";
import type { NexusApi } from "./contract";
import type { Article, Feed, Paginated } from "@/types/nexus";

/** Real implementation talking to the Rust/Axum backend. */
export const httpApi: NexusApi = {
  feeds: {
    list: () => request<Feed[]>("/api/feeds"),
    create: (input) => request<Feed>("/api/feeds", { method: "POST", body: JSON.stringify(input) }),
    remove: (id) => request<void>(`/api/feeds/${encodeURIComponent(id)}`, { method: "DELETE" }),
    refresh: (id) => request<Feed>(`/api/feeds/${encodeURIComponent(id)}/refresh`, { method: "POST" }),
  },
  articles: {
    list: (q) =>
      request<Paginated<Article>>(
        `/api/articles${toQueryString({
          q: q.q,
          category: q.category,
          feed_id: q.feedId,
          period: q.period,
          favorite: q.favorite,
          limit: q.limit,
        })}`,
      ),
    get: (id) => request<Article>(`/api/articles/${encodeURIComponent(id)}`),
    setFavorite: (id, favorite) =>
      request<Article>(`/api/articles/${encodeURIComponent(id)}/favorite`, {
        method: "POST",
        body: JSON.stringify({ favorite }),
      }),
    setRead: (id, read) =>
      request<Article>(`/api/articles/${encodeURIComponent(id)}/read`, {
        method: "POST",
        body: JSON.stringify({ read }),
      }),
  },
};
