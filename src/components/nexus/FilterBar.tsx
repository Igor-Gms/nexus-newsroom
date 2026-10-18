import { X } from "lucide-react";
import { useCategories, useFeeds } from "@/hooks/use-nexus";
import type { Period } from "@/types/nexus";

export interface Filters {
  category?: string | undefined;
  feedId?: string | undefined;
  period?: Period | undefined;
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "all", label: "Qualquer data" },
  { value: "24h", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

const selectCls =
  "glass h-10 rounded-lg px-3 pr-8 text-sm text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary";

export function FilterBar({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const { data: feeds } = useFeeds();
  const categories = useCategories();
  const active = !!(value.category || value.feedId || (value.period && value.period !== "all"));

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
      <label className="sr-only" htmlFor="f-cat">
        Categoria
      </label>
      <select
        id="f-cat"
        className={selectCls}
        value={value.category ?? ""}
        onChange={(e) => onChange({ ...value, category: e.target.value || undefined })}
      >
        <option value="">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="f-feed">
        Fonte
      </label>
      <select
        id="f-feed"
        className={selectCls}
        value={value.feedId ?? ""}
        onChange={(e) => onChange({ ...value, feedId: e.target.value || undefined })}
      >
        <option value="">Todas as fontes</option>
        {feeds?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="f-period">
        Período
      </label>
      <select
        id="f-period"
        className={selectCls}
        value={value.period ?? "all"}
        onChange={(e) => onChange({ ...value, period: e.target.value as Period })}
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {active && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden /> Limpar filtros
        </button>
      )}
    </div>
  );
}
