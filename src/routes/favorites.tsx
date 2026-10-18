import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArticleList } from "@/components/nexus/ArticleList";
import { FilterBar, type Filters } from "@/components/nexus/FilterBar";
import { PageHeader } from "@/components/nexus/PageHeader";
import { useArticleTotal } from "@/hooks/use-nexus";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favoritos — NEXUS FEED" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const { total } = useArticleTotal({ favorite: true });
  const hasFilters = Boolean(
    filters.category || filters.feedId || (filters.period && filters.period !== "all"),
  );

  return (
    <>
      <PageHeader
        title="Favoritos"
        description={
          total === undefined
            ? "Seus artigos salvos."
            : `${total.toLocaleString("pt-BR")} ${total === 1 ? "artigo salvo" : "artigos salvos"}.`
        }
      />
      <div className="mb-6">
        <FilterBar
          value={filters}
          onChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
        />
      </div>
      <ArticleList
        query={{ favorite: true, ...filters, page, limit: PAGE_SIZE }}
        hasFilters={hasFilters}
        emptyTitle="Nenhum favorito ainda"
        emptyDescription="Toque na estrela de um artigo para guardá-lo aqui."
        onPageChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </>
  );
}
