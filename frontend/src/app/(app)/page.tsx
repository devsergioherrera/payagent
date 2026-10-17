"use client";

import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { Center } from "@/components/mesa/center";
import { InvoiceRail } from "@/components/mesa/invoice-rail";
import { PendingRail } from "@/components/mesa/pending-rail";

export default function Page() {
  const { data: summary } = usePolling(() => api.summary());
  const { data: invoices } = usePolling(() => api.invoices());

  // Cancels the layout padding so the three areas fill the space under the nav.
  return (
    <div className="-mx-4 -my-6 flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      <Center summary={summary} invoices={invoices} className="order-1 min-h-[calc(100dvh-3.5rem)] lg:order-2 lg:min-h-0 lg:flex-1" />
      <PendingRail invoices={invoices} className="order-2 border-t lg:order-3 lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0" />
      <InvoiceRail invoices={invoices} summary={summary} className="order-3 max-h-[32rem] border-t lg:order-1 lg:max-h-none lg:w-80 lg:shrink-0 lg:border-r lg:border-t-0" />
    </div>
  );
}
