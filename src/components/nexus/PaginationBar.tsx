import { ChevronLeft, ChevronRight } from "lucide-react";
import { NxButton } from "@/components/ui/nx-button";

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-3">
      <NxButton size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
      </NxButton>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        Página {page} de {totalPages}
      </span>
      <NxButton size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Próxima <ChevronRight className="h-4 w-4" aria-hidden />
      </NxButton>
    </nav>
  );
}
