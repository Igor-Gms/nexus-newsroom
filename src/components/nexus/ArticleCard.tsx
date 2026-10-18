import { motion } from "framer-motion";
import { Check, ExternalLink, Rss, Star } from "lucide-react";
import type { Article } from "@/types/nexus";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarkRead, useToggleFavorite } from "@/hooks/use-nexus";

export function ArticleCard({ article, index = 0 }: { article: Article; index?: number }) {
  const fav = useToggleFavorite();
  const read = useMarkRead();
  const isFav = fav.isPending ? !!fav.variables?.favorite : article.isFavorite;
  const isRead = read.isPending ? !!read.variables?.read : article.isRead;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className={cn(
        "glass group flex flex-col overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40",
        isRead && "opacity-60",
      )}
    >
      <div className="relative h-36 overflow-hidden">
        {article.imageUrl ? (
          <img src={article.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="bg-brand grid h-full w-full place-items-center opacity-30">
            <Rss className="h-10 w-10 text-primary-foreground" aria-hidden />
          </div>
        )}
        <span className="glass absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan">
          {article.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{article.feedTitle}</span>
          <span aria-hidden>•</span>
          <time dateTime={article.publishedAt}>{relativeTime(article.publishedAt)}</time>
        </div>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">{article.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>

        <div className="mt-auto flex items-center gap-1 pt-4">
          <button
            type="button"
            onClick={() => fav.mutate({ id: article.id, favorite: !isFav })}
            aria-pressed={isFav}
            aria-label={isFav ? "Remover dos favoritos" : "Favoritar"}
            className={cn("rounded-lg p-2 transition-colors hover:bg-secondary", isFav ? "text-warning" : "text-muted-foreground")}
          >
            <Star className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => read.mutate({ id: article.id, read: !isRead })}
            aria-pressed={isRead}
            aria-label={isRead ? "Marcar como não lido" : "Marcar como lido"}
            className={cn("rounded-lg p-2 transition-colors hover:bg-secondary", isRead ? "text-success" : "text-muted-foreground")}
          >
            <Check className="h-4 w-4" />
          </button>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => !isRead && read.mutate({ id: article.id, read: true })}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Abrir original <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </motion.article>
  );
}
