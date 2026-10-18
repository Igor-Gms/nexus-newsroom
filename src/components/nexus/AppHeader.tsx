import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useIsFetching } from "@tanstack/react-query";
import { Menu, RefreshCw, Search, Server, User } from "lucide-react";
import { useRefreshAll } from "@/hooks/use-nexus";
import { isDemoMode } from "@/services";
import { API_BASE_URL } from "@/services/api-client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate();
  const urlQ = useRouterState({ select: (s) => (s.location.search as { q?: string }).q ?? "" });
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);

  const fetching = useIsFetching() > 0;
  const refreshAll = useRefreshAll();
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!fetching) setLastSync(Date.now());
  }, [fetching]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/articles", search: (prev) => ({ ...prev, q: q.trim() || undefined }) });
  };

  const busy = fetching || refreshAll.isPending;

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-x-0 border-t-0 px-4 md:px-8">
      <button type="button" onClick={onOpenMenu} aria-label="Abrir menu" className="rounded-lg p-2 hover:bg-secondary md:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={submit} role="search" className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="global-search" className="sr-only">Buscar artigos</label>
        <input
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar artigos, fontes…"
          className="h-10 w-full rounded-lg border border-input bg-surface/60 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        {isDemoMode && (
          <span className="hidden rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning lg:inline">
            Modo demonstração
          </span>
        )}
        <button
          type="button"
          onClick={() => refreshAll.mutate()}
          disabled={refreshAll.isPending}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Atualizar todas as fontes"
        >
          <span className={cn("h-2 w-2 rounded-full", busy ? "animate-pulse bg-cyan" : "bg-success")} aria-hidden />
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} aria-hidden />
          <span className="hidden sm:inline" aria-live="polite">
            {busy ? "Atualizando…" : lastSync ? `Atualizado ${relativeTime(lastSync)}` : "Sincronizar"}
          </span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="Menu do perfil"
            className="bg-brand grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-primary-foreground ring-2 ring-primary/30 transition hover:ring-primary/60"
          >
            NX
          </button>
          {menu && (
            <div role="menu" className="glass absolute right-0 mt-2 w-72 rounded-xl bg-popover p-2 shadow-card">
              <div className="flex items-center gap-3 border-b px-3 py-3">
                <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Leitor NEXUS</p>
                  <p className="text-xs text-muted-foreground">Perfil local</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-3 py-3 text-xs text-muted-foreground">
                <Server className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="break-all">
                  {isDemoMode ? "API não configurada — exibindo dados demonstrativos. Defina VITE_API_BASE_URL." : `Conectado a ${API_BASE_URL}`}
                </span>
              </div>
              <button
                role="menuitem"
                type="button"
                onClick={() => { refreshAll.mutate(); setMenu(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary"
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar todas as fontes
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
