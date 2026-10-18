"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { OrdersTab } from "./orders-tab";
import { count, useKeyedPolling } from "./use-directory";
import { VendorsTab } from "./vendors-tab";

export function Directorio() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") === "ordenes" ? "ordenes" : "proveedores";

  const go = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
      router.replace(`${pathname}?${sp}`, { scroll: false });
    },
    [router, pathname],
  );

  const { data: vendorTotal } = useKeyedPolling(() => api.vendors({ limit: 1 }), "count");
  const { data: poTotal } = useKeyedPolling(() => api.purchaseOrders({ limit: 1 }), "count");

  const tabs = [
    { id: "proveedores", label: "Proveedores", icon: Building2, total: vendorTotal?.total },
    { id: "ordenes", label: "Órdenes de compra", icon: ClipboardList, total: poTotal?.total },
  ] as const;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-7rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Directorio</h1>
        <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-[3px]">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => go({ tab: t.id === "ordenes" ? "ordenes" : null })}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-3 text-sm text-foreground/60 transition-colors hover:text-foreground",
                tab === t.id && "bg-background font-medium text-foreground shadow-sm",
              )}
            >
              <t.icon className="size-4" />
              <span className="max-sm:hidden">{t.label}</span>
              <span className="sm:hidden">{t.id === "ordenes" ? "Órdenes" : "Proveedores"}</span>
              {t.total !== undefined && <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums text-muted-foreground">{count(t.total)}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        {tab === "proveedores" ? (
          <VendorsTab
            selectedId={params.get("vendor")}
            onSelect={(id) => go({ vendor: id })}
            onOpenPo={(po) => go({ tab: "ordenes", po })}
            onAllPos={(name) => go({ tab: "ordenes", q: name })}
          />
        ) : (
          <OrdersTab
            key={params.get("q") ?? ""}
            selectedPo={params.get("po")}
            initialQ={params.get("q") ?? ""}
            onSelect={(po) => go({ tab: "ordenes", po, q: params.get("q") })}
            onOpenVendor={(id) => go({ vendor: id })}
          />
        )}
      </div>
    </div>
  );
}
