import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Newspaper, Rss, Star, MailOpen } from "lucide-react";
import { AddFeedButton } from "@/components/nexus/AddFeedDialog";
import { ArticleList } from "@/components/nexus/ArticleList";
import { PageHeader } from "@/components/nexus/PageHeader";
import { StatCard } from "@/components/nexus/StatCard";
import { useArticleTotal, useFeeds } from "@/hooks/use-nexus";
import { greeting } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Início — NEXUS FEED" }] }),
  component: HomePage,
});

function HomePage() {
  // A saudação depende do relógio do navegador: calculamos só após a montagem
  // para não gerar diferença entre o HTML do servidor e o do cliente (hydration).
  const [salutation, setSalutation] = useState("Olá");
  useEffect(() => setSalutation(greeting()), []);

  const feeds = useFeeds();
  const all = useArticleTotal();
  const unread = useArticleTotal({ unread: true });
  const favorites = useArticleTotal({ favorite: true });

  const feedCount = feeds.data?.length;
  const feedsWithError = feeds.data?.filter((f) => f.status === "error").length ?? 0;

  const summary =
    unread.total === undefined || feedCount === undefined
      ? "Carregando o resumo das suas notícias…"
      : feedCount === 0
        ? "Adicione sua primeira fonte RSS para começar."
        : unread.total === 0
          ? "Você está em dia: nenhum artigo não lido."
          : `Você tem ${unread.total.toLocaleString("pt-BR")} ${unread.total === 1 ? "artigo não lido" : "artigos não lidos"} em ${feedCount} ${feedCount === 1 ? "fonte" : "fontes"}.`;

  return (
    <>
      <PageHeader
        title={
          <>
            {salutation}, <span className="text-brand">leitor</span>
          </>
        }
        description={summary}
        actions={<AddFeedButton />}
      />

      <section aria-label="Resumo" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Artigos" value={all.total} loading={all.isPending} icon={Newspaper} />
        <StatCard
          label="Não lidos"
          value={unread.total}
          loading={unread.isPending}
          icon={MailOpen}
          tone="cyan"
        />
        <StatCard
          label="Favoritos"
          value={favorites.total}
          loading={favorites.isPending}
          icon={Star}
          tone="warning"
        />
        <StatCard
          label="Fontes RSS"
          value={feedCount}
          loading={feeds.isPending}
          icon={Rss}
          tone="success"
        />
      </section>

      {feedsWithError > 0 && (
        <div
          role="status"
          className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>
            {feedsWithError}{" "}
            {feedsWithError === 1 ? "fonte está com erro" : "fontes estão com erro"} na última
            atualização.
          </span>
          <Link to="/sources" className="ml-auto font-medium text-primary hover:underline">
            Ver fontes
          </Link>
        </div>
      )}

      <section aria-labelledby="latest-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="latest-title" className="text-lg font-semibold">
            Últimas notícias
          </h2>
          <Link
            to="/articles"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver todas <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ArticleList query={{ limit: 6 }} emptyAction={<AddFeedButton />} />
      </section>
    </>
  );
}
