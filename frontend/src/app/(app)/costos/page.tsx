"use client";

import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { ByTypeTable } from "@/components/costos/by-type-table";
import { CostsSkeleton } from "@/components/costos/costs-skeleton";
import { RecentOperations } from "@/components/costos/recent-operations";
import { StatTiles } from "@/components/costos/stat-tiles";

export default function CostosPage() {
  const { data, error } = usePolling(() => api.costs(), 3000);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Costos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lo que cuesta cada operación del agente, en dólares.</p>
      </header>
      {error && !data ? (
        <p className="text-sm text-hold">No se pudieron cargar los costos.</p>
      ) : !data ? (
        <CostsSkeleton />
      ) : (
        <>
          <StatTiles costs={data} />
          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5"><ByTypeTable rows={data.by_type} /></div>
            <div className="lg:col-span-7"><RecentOperations rows={data.recent} /></div>
          </div>
        </>
      )}
    </div>
  );
}
