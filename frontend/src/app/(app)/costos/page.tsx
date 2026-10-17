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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
          <ByTypeTable rows={data.by_type} />
          <RecentOperations rows={data.recent} />
        </>
      )}
    </div>
  );
}
