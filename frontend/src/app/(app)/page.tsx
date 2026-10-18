"use client";

import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { MesaLayout } from "@/components/mesa/mesa-layout";

export default function Page() {
  const { data: summary } = usePolling(() => api.summary());
  const { data: invoices } = usePolling(() => api.invoices());

  // Cancels the layout padding so the panes fill the space under the nav.
  return (
    <div className="-mx-4 -my-6">
      <MesaLayout summary={summary} invoices={invoices} />
    </div>
  );
}
