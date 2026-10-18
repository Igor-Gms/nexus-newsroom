import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { api, CATEGORIES } from "@/services";
import type { ArticleQuery, CreateFeedInput } from "@/types/nexus";

export const nexusKeys = {
  feeds: ["feeds"] as const,
  articles: (q: ArticleQuery) => ["articles", q] as const,
};

export const useFeeds = () =>
  useQuery({ queryKey: nexusKeys.feeds, queryFn: () => api.feeds.list() });

export const useArticles = (q: ArticleQuery, options?: { keepPrevious?: boolean }) =>
  useQuery({
    queryKey: nexusKeys.articles(q),
    queryFn: () => api.articles.list(q),
    // Mantém a lista anterior na tela enquanto a próxima página/filtro carrega.
    ...(options?.keepPrevious ? { placeholderData: keepPreviousData } : {}),
  });

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Algo deu errado. Tente novamente.";

/** Total de artigos que casam com a consulta (pede só 1 item, usa apenas o `total`). */
export function useArticleTotal(query: Omit<ArticleQuery, "limit" | "page"> = {}) {
  const { data, isPending, isError } = useArticles({ ...query, limit: 1 });
  return { total: data?.total, isPending, isError };
}

/** Categorias padrão + as categorias das fontes cadastradas, sem repetição e em ordem alfabética. */
export function useCategories(): string[] {
  const { data: feeds } = useFeeds();
  return useMemo(() => {
    const all = new Set<string>(CATEGORIES);
    for (const f of feeds ?? []) all.add(f.category);
    return [...all].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [feeds]);
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["articles"] }),
      qc.invalidateQueries({ queryKey: nexusKeys.feeds }),
    ]);
}

export function useToggleFavorite() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      api.articles.setFavorite(id, favorite),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error("Não foi possível atualizar o favorito", { description: errorMessage(e) }),
  });
}

export function useMarkRead() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => api.articles.setRead(id, read),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error("Não foi possível atualizar o artigo", { description: errorMessage(e) }),
  });
}

export function useCreateFeed() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateFeedInput) => api.feeds.create(input),
    onSuccess: invalidate,
  });
}

export function useDeleteFeed() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.feeds.remove(id),
    onSuccess: () => {
      toast.success("Fonte removida");
      return invalidate();
    },
    onError: (e) =>
      toast.error("Não foi possível remover a fonte", { description: errorMessage(e) }),
  });
}

export function useRefreshFeed() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.feeds.refresh(id),
    onSuccess: (feed) => toast.success(`${feed.title} atualizada`),
    onError: (e) =>
      toast.error("Não foi possível atualizar a fonte", { description: errorMessage(e) }),
    // Mesmo com erro, a API registra o status da fonte: recarregamos para mostrar o estado real.
    onSettled: invalidate,
  });
}

export function useRefreshAll() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async () => {
      const feeds = await api.feeds.list();
      const results = await Promise.allSettled(feeds.map((f) => api.feeds.refresh(f.id)));
      return { total: feeds.length, failed: results.filter((r) => r.status === "rejected").length };
    },
    onSuccess: ({ total, failed }) => {
      if (total === 0) toast.info("Nenhuma fonte cadastrada ainda");
      else if (failed === 0) toast.success("Fontes atualizadas");
      else toast.warning(`${failed} de ${total} fontes falharam ao atualizar`);
    },
    onError: (e) =>
      toast.error("Não foi possível atualizar as fontes", { description: errorMessage(e) }),
    onSettled: invalidate,
  });
}
