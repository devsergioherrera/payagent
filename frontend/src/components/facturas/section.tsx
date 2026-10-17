"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Collapsible card: header with icon, title, optional aside and a chevron.
export function Section({
  title, icon: Icon, aside, defaultOpen = true, className, bodyClassName, children,
}: {
  title: string; icon: LucideIcon; aside?: ReactNode; defaultOpen?: boolean;
  className?: string; bodyClassName?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("rounded-2xl border bg-card", className)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
        </button>
        {aside}
        <button type="button" tabIndex={-1} aria-hidden onClick={() => setOpen((v) => !v)} className="shrink-0 rounded-md p-0.5">
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        </button>
      </div>
      {open && <div className={cn("border-t px-4 py-4", bodyClassName)}>{children}</div>}
    </section>
  );
}
