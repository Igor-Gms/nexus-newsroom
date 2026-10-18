import type { ReactNode } from "react";
import { useArticles } from "@/hooks/use-nexus";
import type { ArticleQuery } from "@/types/nexus";
import { ArticleCard } from "./ArticleCard";
import { ArticleSkeletonGrid, StateView } from "./StateView";

export function ArticleList({
  query,
  hasFilters,
  emptyTitle = "Nenhum artigo ainda",
  emptyDescription = "Adicione uma fonte RSS para começar a receber artigos.",
  emptyAction,
}: {
  query: ArticleQuery;
  hasFilters?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  const { data, isPending, isError, error, refetch } = useArticles(query);

  if (isPending) return <ArticleSkeletonGrid />;
  if (isError)
    return (
      <StateView kind="error" title="Erro de conexão" description={error instanceof Error ? error.message : "Falha ao carregar artigos."} onRetry={() => refetch()} />
    );
  if (data.items.length === 0)
    return hasFilters ? (
      <StateView kind="no-results" title="Nenhum resultado" description="Ajuste a busca ou os filtros para encontrar artigos." />
    ) : (
      <StateView kind="empty" title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.items.map((a, i) => (
        <ArticleCard key={a.id} article={a} index={i} />
      ))}
    </div>
  );
}
