"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { useState } from "react";
import type { InvoiceSummary, Summary } from "@/lib/api-types";
import { Center } from "./center";
import { InvoiceRail } from "./invoice-rail";
import { PendingRail } from "./pending-rail";

const DESKTOP = "(min-width: 1024px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

const IDS = ["invoices", "center", "pending"];
const RAIL = { collapsible: true, collapsedSize: "56px", minSize: "240px", maxSize: "480px" } as const;

function Handle() {
  return (
    <Separator className="group relative w-px bg-border outline-none transition-colors data-[separator=hover]:bg-brand/60 data-[separator=active]:bg-brand focus-visible:bg-brand">
      <span className="absolute inset-y-0 -left-1 -right-1" />
    </Separator>
  );
}

interface Props { summary: Summary | null; invoices: InvoiceSummary[] | null }

function Desktop({ summary, invoices }: Props) {
  const layout = useDefaultLayout({ id: "payagent-mesa", panelIds: IDS, storage: localStorage });
  const left = usePanelRef();
  const right = usePanelRef();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const toggle = (ref: typeof left) => (ref.current?.isCollapsed() ? ref.current.expand() : ref.current?.collapse());

  // With nothing pending the right rail folds to its icon strip; it reopens by itself when something arrives
  // unless the user has taken over.
  const pending = invoices ? invoices.filter((i) => i.state === "WAITING").length : null;
  const manual = useRef(false);
  const auto = useRef(false);
  useEffect(() => {
    if (pending === null || manual.current) return;
    if (pending === 0 && !right.current?.isCollapsed()) {
      auto.current = true;
      right.current?.collapse();
    } else if (pending > 0 && auto.current) {
      auto.current = false;
      right.current?.expand();
    }
  }, [pending, right]);
  const toggleRight = () => {
    manual.current = true;
    toggle(right);
  };

  return (
    <Group orientation="horizontal" id="payagent-mesa" defaultLayout={layout.defaultLayout} onLayoutChanged={layout.onLayoutChanged} style={{ height: "calc(100dvh - 3.5rem)" }}>
      <Panel id="invoices" panelRef={left} defaultSize="300px" {...RAIL} onResize={(s) => setLeftCollapsed(s.inPixels < 100)}>
        <InvoiceRail invoices={invoices} summary={summary} collapsed={leftCollapsed} onToggle={() => toggle(left)} className="h-full" />
      </Panel>
      <Handle />
      <Panel id="center" minSize="420px">
        <Center summary={summary} invoices={invoices} className="h-full" />
      </Panel>
      <Handle />
      <Panel id="pending" panelRef={right} defaultSize="320px" {...RAIL} onResize={(s) => setRightCollapsed(s.inPixels < 100)}>
        <PendingRail invoices={invoices} collapsed={rightCollapsed} onToggle={toggleRight} className="h-full" />
      </Panel>
    </Group>
  );
}

export function MesaLayout({ summary, invoices }: Props) {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => false);
  if (desktop) return <Desktop summary={summary} invoices={invoices} />;
  return (
    <div className="flex flex-col">
      <Center summary={summary} invoices={invoices} className="min-h-[calc(100dvh-3.5rem)]" />
      <PendingRail invoices={invoices} className="border-t" />
      <InvoiceRail invoices={invoices} summary={summary} className="max-h-[32rem] border-t" />
    </div>
  );
}
