"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { count, PAGE_SIZE } from "./use-directory";

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs transition-colors",
        active ? "border-foreground/25 bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface Props {
  placeholder: string;
  query: string;
  onQuery: (q: string) => void;
  filters: React.ReactNode;
  total: number | null;
  offset: number;
  onOffset: (o: number) => void;
  hidden: boolean;
  children: React.ReactNode;
}

export function ListPane({ placeholder, query, onQuery, filters, total, offset, onOffset, hidden, children }: Props) {
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + PAGE_SIZE, total ?? 0);
  return (
    <section className={cn("min-h-0 flex-col overflow-hidden rounded-2xl border bg-card max-lg:h-[calc(100dvh-13rem)]", hidden ? "hidden lg:flex" : "flex")}>
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-9 pl-8 pr-8 md:text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">{filters}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span className="tabular-nums">{total === null ? "Cargando" : `${count(from)}-${count(to)} de ${count(total)}`}</span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={offset === 0}
            onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))}
            className="flex size-7 items-center justify-center rounded-md border transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={total === null || offset + PAGE_SIZE >= total}
            onClick={() => onOffset(offset + PAGE_SIZE)}
            className="flex size-7 items-center justify-center rounded-md border transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function RowsSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <ul className="divide-y" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex-1 space-y-2"><div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" /><div className="h-3 w-2/5 animate-pulse rounded bg-muted" /></div>
          <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}

export const EmptyRows = ({ text }: { text: string }) => <p className="p-6 text-center text-sm text-muted-foreground">{text}</p>;
