import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages])).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const item = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm";
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "bg-surface hover:bg-muted")} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">Anterior</span>
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && p - pages[i - 1]! > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "bg-surface hover:bg-muted")} rel="next">
          <span className="sr-only sm:not-sr-only">Próxima</span> <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
