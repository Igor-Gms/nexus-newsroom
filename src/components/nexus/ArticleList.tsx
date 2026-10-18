import type { ReactNode } from "react";
import { useArticles } from "@/hooks/use-nexus";
import type { ArticleQuery } from "@/types/nexus";
import { cn } from "@/lib/utils";
import { ArticleCard } from "./ArticleCard";
import { PaginationBar } from "./PaginationBar";
import { ArticleSkeletonGrid, StateView } from "./StateView";

export function ArticleList({
  query,
  hasFilters,
  emptyTitle = "Nenhum artigo ainda",
  emptyDescription = "Adicione uma fonte RSS para começar a receber artigos.",
  emptyAction,
  onPageChange,
}: {
  query: ArticleQuery;
  hasFilters?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Quando informado, exibe a paginação (use junto com `query.page`). */
  onPageChange?: (page: number) => void;
}) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useArticles(query, {
    keepPrevious: true,
  });

  if (isPending) return <ArticleSkeletonGrid />;
  if (isError)
    return (
      <StateView
        kind="error"
        title="Erro de conexão"
        description={error instanceof Error ? error.message : "Falha ao carregar artigos."}
        onRetry={() => refetch()}
      />
    );
  if (data.items.length === 0)
    return hasFilters ? (
      <StateView
        kind="no-results"
        title="Nenhum resultado"
        description="Ajuste a busca ou os filtros para encontrar artigos."
      />
    ) : (
      <StateView
        kind="empty"
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );

  const page = query.page ?? 1;
  return (
    <>
      <div
        className={cn(
          "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3",
          isPlaceholderData && "opacity-60",
        )}
        aria-busy={isPlaceholderData}
      >
        {data.items.map((a, i) => (
          <ArticleCard key={a.id} article={a} index={i} />
        ))}
      </div>
      {onPageChange && (data.totalPages ?? 1) > 1 && (
        <PaginationBar page={page} totalPages={data.totalPages ?? 1} onPageChange={onPageChange} />
      )}
    </>
  );
}
