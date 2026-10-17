"use client";

import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { VendorCard } from "@/components/proveedores/vendor-card";
import { VendorsSkeleton } from "@/components/proveedores/vendors-skeleton";

export default function ProveedoresPage() {
  const { data, error } = usePolling(() => api.vendors(), 3000);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">Proveedores registrados, sus cuentas y órdenes de compra.</p>
      </header>
      {error && !data ? (
        <p className="text-sm text-hold">No se pudieron cargar los proveedores.</p>
      ) : !data ? (
        <VendorsSkeleton />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay proveedores.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((v) => <VendorCard key={v.id} vendor={v} />)}
        </ul>
      )}
    </div>
  );
}
