import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import type { ArticleQuery, CreateFeedInput } from "@/types/nexus";

export const nexusKeys = {
  feeds: ["feeds"] as const,
  articles: (q: ArticleQuery) => ["articles", q] as const,
};

export const useFeeds = () => useQuery({ queryKey: nexusKeys.feeds, queryFn: () => api.feeds.list() });

export const useArticles = (q: ArticleQuery) =>
  useQuery({ queryKey: nexusKeys.articles(q), queryFn: () => api.articles.list(q) });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["articles"] }), qc.invalidateQueries({ queryKey: nexusKeys.feeds })]);
}

export function useToggleFavorite() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => api.articles.setFavorite(id, favorite),
    onSuccess: invalidate,
  });
}

export function useMarkRead() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => api.articles.setRead(id, read),
    onSuccess: invalidate,
  });
}

export function useCreateFeed() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: CreateFeedInput) => api.feeds.create(input), onSuccess: invalidate });
}

export function useDeleteFeed() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.feeds.remove(id), onSuccess: invalidate });
}

export function useRefreshFeed() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.feeds.refresh(id), onSuccess: invalidate });
}

export function useRefreshAll() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async () => {
      const feeds = await api.feeds.list();
      await Promise.allSettled(feeds.map((f) => api.feeds.refresh(f.id)));
    },
    onSettled: invalidate,
  });
}
