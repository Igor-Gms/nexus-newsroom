import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NxButton } from "@/components/ui/nx-button";
import { useDeleteFeed, useRefreshFeed } from "@/hooks/use-nexus";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Feed, FeedStatus } from "@/types/nexus";

const STATUS: Record<FeedStatus, { label: string; className: string }> = {
  active: { label: "Ativa", className: "border-success/30 bg-success/10 text-success" },
  error: {
    label: "Com erro",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  pending: { label: "Pendente", className: "border-warning/30 bg-warning/10 text-warning" },
};

export function FeedItem({ feed }: { feed: Feed }) {
  const refresh = useRefreshFeed();
  const remove = useDeleteFeed();
  const status = STATUS[feed.status];

  return (
    <li className="glass flex flex-col gap-4 rounded-2xl p-5 shadow-card md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-semibold">{feed.title}</h2>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              status.className,
            )}
          >
            {status.label}
          </span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {feed.category}
          </span>
        </div>
        <p className="mt-1 break-all text-xs text-muted-foreground">{feed.url}</p>
        {feed.status === "error" && feed.errorMessage && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {feed.errorMessage}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {feed.articleCount.toLocaleString("pt-BR")}{" "}
          {feed.articleCount === 1 ? "artigo" : "artigos"}
          {feed.lastFetchedAt
            ? ` • atualizada ${relativeTime(feed.lastFetchedAt)}`
            : " • ainda não atualizada"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/articles"
          search={{ feedId: feed.id }}
          className="glass inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors hover:bg-accent"
        >
          Ver artigos
        </Link>
        {feed.siteUrl && (
          <a
            href={feed.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir o site de ${feed.title}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
        <NxButton
          size="sm"
          onClick={() => refresh.mutate(feed.id)}
          disabled={refresh.isPending}
          aria-label={`Atualizar ${feed.title}`}
        >
          {refresh.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar
        </NxButton>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <NxButton
              variant="danger"
              size="sm"
              disabled={remove.isPending}
              aria-label={`Remover ${feed.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover
            </NxButton>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover “{feed.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {feed.articleCount > 0
                  ? `Os ${feed.articleCount.toLocaleString("pt-BR")} artigos desta fonte também serão removidos. `
                  : ""}
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => remove.mutate(feed.id)}
              >
                Remover fonte
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
