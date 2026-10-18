import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { AddFeedButton } from "@/components/nexus/AddFeedDialog";
import { FeedItem } from "@/components/nexus/FeedItem";
import { PageHeader } from "@/components/nexus/PageHeader";
import { StateView } from "@/components/nexus/StateView";
import { NxButton } from "@/components/ui/nx-button";
import { useFeeds, useRefreshAll } from "@/hooks/use-nexus";

export const Route = createFileRoute("/sources")({
  head: () => ({ meta: [{ title: "Fontes RSS — NEXUS FEED" }] }),
  component: SourcesPage,
});

function SourcesPage() {
  const feeds = useFeeds();
  const refreshAll = useRefreshAll();
  const list = feeds.data ?? [];
  const withError = list.filter((f) => f.status === "error").length;

  const description = feeds.data
    ? list.length === 0
      ? "Nenhuma fonte cadastrada."
      : `${list.length} ${list.length === 1 ? "fonte" : "fontes"}${withError ? ` • ${withError} com erro` : " • todas funcionando"}`
    : "Gerencie as fontes RSS e Atom.";

  return (
    <>
      <PageHeader
        title="Fontes RSS"
        description={description}
        actions={
          <div className="flex flex-wrap gap-2">
            <NxButton
              onClick={() => refreshAll.mutate()}
              disabled={refreshAll.isPending || list.length === 0}
            >
              <RefreshCw
                className={refreshAll.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                aria-hidden
              />{" "}
              Atualizar todas
            </NxButton>
            <AddFeedButton />
          </div>
        }
      />

      {feeds.isPending ? (
        <ul className="space-y-4" aria-label="Carregando fontes" aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </ul>
      ) : feeds.isError ? (
        <StateView
          kind="error"
          title="Erro de conexão"
          description={
            feeds.error instanceof Error ? feeds.error.message : "Falha ao carregar as fontes."
          }
          onRetry={() => feeds.refetch()}
        />
      ) : list.length === 0 ? (
        <StateView
          kind="empty"
          title="Nenhuma fonte RSS"
          description="Cole a URL de um feed RSS ou Atom para começar."
          action={<AddFeedButton />}
        />
      ) : (
        <ul className="space-y-4">
          {list.map((feed) => (
            <FeedItem key={feed.id} feed={feed} />
          ))}
        </ul>
      )}
    </>
  );
}
