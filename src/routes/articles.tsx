import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { AddFeedButton } from "@/components/nexus/AddFeedDialog";
import { ArticleList } from "@/components/nexus/ArticleList";
import { FilterBar, type Filters } from "@/components/nexus/FilterBar";
import { PageHeader } from "@/components/nexus/PageHeader";
import type { Period } from "@/types/nexus";

const PERIODS: readonly Period[] = ["24h", "7d", "30d", "all"];
const PAGE_SIZE = 24;

/** Filtros guardados na URL (links compartilháveis; o botão voltar do navegador funciona). */
export interface ArticlesSearch {
  q?: string | undefined;
  category?: string | undefined;
  feedId?: string | undefined;
  period?: Period | undefined;
  page?: number | undefined;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

export const Route = createFileRoute("/articles")({
  validateSearch: (search: Record<string, unknown>): ArticlesSearch => {
    const page = Number(search["page"]);
    return {
      q: text(search["q"]),
      category: text(search["category"]),
      feedId: text(search["feedId"]),
      period: PERIODS.find((p) => p === search["period"]),
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Todas as notícias — NEXUS FEED" }] }),
  component: ArticlesPage,
});

function ArticlesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const filters: Filters = {
    category: search.category,
    feedId: search.feedId,
    period: search.period,
  };
  const hasFilters = Boolean(
    search.q || search.category || search.feedId || (search.period && search.period !== "all"),
  );

  // Mudar filtro volta para a página 1.
  const setFilters = (f: Filters) =>
    navigate({
      search: (prev) => ({
        ...prev,
        category: f.category,
        feedId: f.feedId,
        period: f.period,
        page: undefined,
      }),
    });
  const setPage = (page: number) => {
    navigate({ search: (prev) => ({ ...prev, page: page > 1 ? page : undefined }) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <PageHeader
        title="Todas as notícias"
        description={
          search.q ? (
            <>Resultados para “{search.q}”</>
          ) : (
            "Tudo o que as suas fontes publicaram, das mais recentes às mais antigas."
          )
        }
        actions={<AddFeedButton />}
      />
      <div className="mb-6 space-y-3">
        {search.q && (
          <button
            type="button"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, q: undefined, page: undefined }) })
            }
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            Busca: {search.q} <X className="h-3.5 w-3.5" aria-hidden />{" "}
            <span className="sr-only">Limpar busca</span>
          </button>
        )}
        <FilterBar value={filters} onChange={setFilters} />
      </div>
      <ArticleList
        query={{ q: search.q, ...filters, page: search.page, limit: PAGE_SIZE }}
        hasFilters={hasFilters}
        emptyAction={<AddFeedButton />}
        onPageChange={setPage}
      />
    </>
  );
}
