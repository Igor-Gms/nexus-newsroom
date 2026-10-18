// Domain types shared by the UI and the service layer.
// They mirror the JSON contract expected from the Rust/Axum REST API.

export type FeedStatus = "active" | "error" | "pending";

export interface Feed {
  id: string;
  title: string;
  url: string;
  siteUrl?: string;
  category: string;
  status: FeedStatus;
  errorMessage?: string;
  articleCount: number;
  lastFetchedAt?: string; // ISO 8601
  createdAt: string; // ISO 8601
}

export interface Article {
  id: string;
  feedId: string;
  feedTitle: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  category: string;
  publishedAt: string; // ISO 8601
  isRead: boolean;
  isFavorite: boolean;
}

export type Period = "24h" | "7d" | "30d" | "all";

export interface ArticleQuery {
  q?: string | undefined;
  category?: string | undefined;
  feedId?: string | undefined;
  period?: Period | undefined;
  favorite?: boolean | undefined;
  /** Só artigos ainda não lidos. */
  unread?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface CreateFeedInput {
  url: string;
  category?: string | undefined;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
