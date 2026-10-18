import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-primary/15 text-primary",
  cyan: "bg-cyan/15 text-cyan",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  tone = "primary",
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  loading?: boolean;
  tone?: keyof typeof tones;
}) {
  return (
    <div className="glass flex items-center gap-4 rounded-2xl p-5 shadow-card">
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading || value === undefined ? (
          <div className="skeleton mt-1 h-7 w-14 rounded" aria-label="Carregando" />
        ) : (
          <p className="font-display text-2xl font-bold leading-tight">
            {value.toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    </div>
  );
}
