"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff, CircleCheck, Hand, Lightbulb, MailWarning, OctagonX, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { ActivityItem, ActivityKind } from "@/lib/api-types";
import { ago } from "@/lib/format";
import { usePolling } from "@/hooks/use-polling";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

const SEEN_KEY = "payagent:activity-seen";

export const ACTIVITY_KIND: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  ESCALATED: { icon: Hand, tone: "bg-escalate-soft text-escalate" },
  HELD: { icon: OctagonX, tone: "bg-hold-soft text-hold" },
  PAID: { icon: CircleCheck, tone: "bg-pay-soft text-pay" },
  PROPOSAL: { icon: Lightbulb, tone: "bg-brand-soft text-brand" },
  EMAIL_FAILED: { icon: MailWarning, tone: "bg-hold-soft text-hold" },
};

// Unread = newer than the last time the popover was opened. Kept in localStorage, per browser.
const listeners = new Set<() => void>();
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
function writeSeen(iso: string) {
  try {
    localStorage.setItem(SEEN_KEY, iso);
  } catch {}
  listeners.forEach((l) => l());
}

function href(a: ActivityItem) {
  if (a.invoice_id) return `/facturas/${a.invoice_id}`;
  if (a.proposal_id) return "/reglas";
  return "/facturas";
}

export function Notifications() {
  const { data } = usePolling(() => api.activity(20), 10_000);
  const seen = useSyncExternalStore(subscribe, readSeen, () => "");
  const [open, setOpen] = useState(false);
  const [shownSince, setShownSince] = useState(seen);
  const [now] = useState(() => Date.now());

  // The badge counts what waits for the user (escalations, rule proposals), not everything that happened.
  const { data: summary } = usePolling(() => api.summary(), 10_000);
  const { data: proposals } = usePolling(() => api.proposals("PENDING"), 10_000);
  const unread = (summary?.pending_human ?? 0) + (proposals?.length ?? 0);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setShownSince(seen);
      if (data?.[0]) writeSeen(data[0].at);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={unread ? `Notificaciones, ${unread} por atender` : "Notificaciones"}
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-[color,background-color,transform] hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] aria-expanded:bg-secondary aria-expanded:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold tabular-nums leading-none text-brand-foreground ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
          <h2 className="text-sm font-semibold">Actividad</h2>
          {data && <span className="text-xs text-muted-foreground">Últimas {data.length}</span>}
        </div>
        <div className="max-h-[min(26rem,70dvh)] overflow-y-auto px-2 pb-2">
          {!data ? (
            <div className="space-y-1 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                </div>
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Todo tranquilo por ahora.</p>
            </div>
          ) : (
            data.map((a) => {
              const { icon: Icon, tone } = ACTIVITY_KIND[a.kind];
              const isNew = a.at > shownSince;
              return (
                <Link
                  key={a.id}
                  href={href(a)}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    {a.detail && <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-muted-foreground tabular-nums">
                    {isNew && <span aria-label="Nueva" className="size-1.5 rounded-full bg-brand" />}
                    {ago(a.at, now)}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
