import type { ReactNode } from "react";
import { Inbox, SearchX, WifiOff } from "lucide-react";
import { NxButton } from "@/components/ui/nx-button";

type Kind = "empty" | "no-results" | "error";
const icons = { empty: Inbox, "no-results": SearchX, error: WifiOff };

export function StateView({
  kind,
  title,
  description,
  action,
  onRetry,
}: {
  kind: Kind;
  title: string;
  description?: string;
  action?: ReactNode;
  onRetry?: () => void;
}) {
  const Icon = icons[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className="glass flex flex-col items-center rounded-2xl px-6 py-14 text-center">
      <div className={`mb-4 grid h-14 w-14 place-items-center rounded-2xl ${kind === "error" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 flex gap-2">
        {onRetry && <NxButton onClick={onRetry}>Tentar novamente</NxButton>}
        {action}
      </div>
    </div>
  );
}

export function ArticleSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando artigos">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass overflow-hidden rounded-2xl">
          <div className="skeleton h-36" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
