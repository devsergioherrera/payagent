"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { MoneyColumn } from "@/components/mesa/money-column";
import { SummaryColumn } from "@/components/mesa/summary-column";
import { PendingColumn } from "@/components/mesa/pending-column";
import { ChatComposer } from "@/components/mesa/chat-composer";

export default function Page() {
  const { data: summary, error: summaryError } = usePolling(() => api.summary(), 3000);

  if (summaryError) {
    return <div className="p-4 text-sm text-destructive">Error cargando resumen</div>
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col">
      {!summary ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="ml-2 text-xs text-muted-foreground">Correo conectado · revisado hace 8 s</span>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-muted-foreground">
              Correo conectado · revisado hace {summary.email_checked_at ? new Date(summary.email_checked_at).toLocaleTimeString() : '8 s'}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 flex gap-4">
        <MoneyColumn className="w-[260px] shrink-0" />
        <SummaryColumn className="flex-1 min-w-0" />
        <PendingColumn className="w-[260px] shrink-0" />
        <ChatComposer className="w-[320px] shrink-0" />
      </div>
    </div>
  );
}