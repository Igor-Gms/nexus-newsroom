import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Tag } from "lucide-react";
import { AddFeedButton } from "@/components/nexus/AddFeedDialog";
import { PageHeader } from "@/components/nexus/PageHeader";
import { ArticleSkeletonGrid, StateView } from "@/components/nexus/StateView";
import { useCategories, useFeeds } from "@/hooks/use-nexus";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categorias — NEXUS FEED" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const feeds = useFeeds();
  const categories = useCategories();

  // Fontes e artigos por categoria, calculados a partir da lista de fontes.
  const stats = useMemo(() => {
    const map = new Map<string, { sources: number; articles: number }>();
    for (const f of feeds.data ?? []) {
      const cur = map.get(f.category) ?? { sources: 0, articles: 0 };
      map.set(f.category, { sources: cur.sources + 1, articles: cur.articles + f.articleCount });
    }
    return map;
  }, [feeds.data]);

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Explore as notícias por assunto."
        actions={<AddFeedButton />}
      />

      {feeds.isPending ? (
        <ArticleSkeletonGrid count={6} />
      ) : feeds.isError ? (
        <StateView
          kind="error"
          title="Erro de conexão"
          description={
            feeds.error instanceof Error ? feeds.error.message : "Falha ao carregar as categorias."
          }
          onRetry={() => feeds.refetch()}
        />
      ) : feeds.data.length === 0 ? (
        <StateView
          kind="empty"
          title="Nenhuma categoria ainda"
          description="As categorias aparecem quando você cadastra fontes RSS."
          action={<AddFeedButton />}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((name) => {
            const s = stats.get(name) ?? { sources: 0, articles: 0 };
            return (
              <li key={name}>
                <Link
                  to="/articles"
                  search={{ category: name }}
                  className="glass group flex items-center gap-4 rounded-2xl p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <div className="bg-brand grid h-12 w-12 shrink-0 place-items-center rounded-xl text-primary-foreground">
                    <Tag className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold">{name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {s.articles.toLocaleString("pt-BR")} {s.articles === 1 ? "artigo" : "artigos"}{" "}
                      • {s.sources} {s.sources === 1 ? "fonte" : "fontes"}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
