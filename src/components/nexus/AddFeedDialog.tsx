import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2, X } from "lucide-react";
import { NxButton } from "@/components/ui/nx-button";
import { useCreateFeed, useDeleteFeed } from "@/hooks/use-nexus";
import { CATEGORIES } from "@/services";
import type { Feed } from "@/types/nexus";

export function AddFeedButton({ label = "Adicionar fonte" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <NxButton variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden /> {label}
      </NxButton>
      <AddFeedDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AddFeedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [created, setCreated] = useState<Feed | null>(null);
  const create = useCreateFeed();
  const remove = useDeleteFeed();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setCreated(null);
    create.reset();
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    create.mutate({ url: url.trim(), category }, { onSuccess: (f) => setCreated(f) });
  };

  const undo = () => {
    if (!created) return;
    remove.mutate(created.id, { onSuccess: () => { setCreated(null); create.reset(); } });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-feed-title"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="glass w-full max-w-lg rounded-2xl p-6 shadow-card"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="add-feed-title" className="text-xl font-semibold">Nova fonte RSS</h2>
                <p className="mt-1 text-sm text-muted-foreground">Cole a URL de um feed RSS ou Atom.</p>
              </div>
              <NxButton variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></NxButton>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="feed-url" className="mb-1.5 block text-sm font-medium">URL do feed</label>
                <input
                  ref={inputRef}
                  id="feed-url"
                  type="url"
                  required
                  placeholder="https://site.com/feed.xml"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (create.isError) create.reset(); }}
                  disabled={create.isPending || !!created}
                  className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="feed-cat" className="mb-1.5 block text-sm font-medium">Categoria</label>
                <select
                  id="feed-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={create.isPending || !!created}
                  className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div aria-live="polite">
                {create.isError && (
                  <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{create.error instanceof Error ? create.error.message : "Falha na validação."}</span>
                  </div>
                )}
                {created && (
                  <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <div className="flex-1">
                      <p className="font-medium">Fonte validada: {created.title}</p>
                      <p className="break-all text-xs text-muted-foreground">{created.url}</p>
                    </div>
                    <NxButton variant="danger" size="sm" onClick={undo} disabled={remove.isPending}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover
                    </NxButton>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {created ? (
                  <>
                    <NxButton onClick={() => { setCreated(null); setUrl(""); create.reset(); inputRef.current?.focus(); }}>Adicionar outra</NxButton>
                    <NxButton variant="primary" onClick={onClose}>Concluir</NxButton>
                  </>
                ) : (
                  <>
                    <NxButton variant="ghost" onClick={onClose}>Cancelar</NxButton>
                    <NxButton type="submit" variant="primary" disabled={create.isPending || !url.trim()}>
                      {create.isPending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Validando…</> : "Validar e adicionar"}
                    </NxButton>
                  </>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
