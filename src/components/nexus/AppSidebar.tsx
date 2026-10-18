import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronsLeft, Home, LayoutGrid, Newspaper, Rss, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/articles", label: "Todas as notícias", icon: Newspaper },
  { to: "/categories", label: "Categorias", icon: LayoutGrid },
  { to: "/favorites", label: "Favoritos", icon: Star },
  { to: "/sources", label: "Fontes RSS", icon: Rss },
] as const;

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="bg-brand grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-glow">
        <Rss className="h-4.5 w-4.5 text-primary-foreground" aria-hidden />
      </div>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight">
          NEXUS <span className="text-brand">FEED</span>
        </span>
      )}
    </div>
  );
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const nav = (compact: boolean) => (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onCloseMobile}
            title={compact ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              compact && "justify-center px-0",
              active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {active && <span className="bg-brand absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" aria-hidden />}
            <Icon className={cn("h-4.5 w-4.5 shrink-0", active && "text-primary")} aria-hidden />
            {!compact && <span>{label}</span>}
            {compact && <span className="sr-only">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside
        className={cn(
          "glass sticky top-0 hidden h-screen shrink-0 flex-col border-y-0 border-l-0 p-4 transition-[width] duration-300 md:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className={cn("mb-8 flex items-center", collapsed ? "justify-center" : "justify-between")}>
          <Logo compact={collapsed} />
        </div>
        {nav(collapsed)}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
          {!collapsed && "Recolher"}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden" onClick={onCloseMobile}>
          <aside className="glass h-full w-72 bg-popover p-4" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="mb-8 flex items-center justify-between">
              <Logo />
              <button type="button" onClick={onCloseMobile} aria-label="Fechar menu" className="rounded-lg p-2 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}
    </>
  );
}
