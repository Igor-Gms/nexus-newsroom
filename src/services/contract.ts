import type { Article, ArticleQuery, CreateFeedInput, Feed, Paginated } from "@/types/nexus";

/** Contrato usado pelo cliente HTTP e pelos serviços da aplicação. */
export interface NexusApi {
  feeds: {
    list(): Promise<Feed[]>;
    create(input: CreateFeedInput): Promise<Feed>;
    remove(id: string): Promise<void>;
    refresh(id: string): Promise<Feed>;
  };
  articles: {
    list(query: ArticleQuery): Promise<Paginated<Article>>;
    get(id: string): Promise<Article>;
    setFavorite(id: string, favorite: boolean): Promise<Article>;
    setRead(id: string, read: boolean): Promise<Article>;
  };
}
