import { CircleCheck, CircleX, Hand, LoaderCircle, OctagonX, UserCheck, type LucideIcon } from "lucide-react";
import type { InvoiceState } from "./api-types";

// The one place an invoice's visible state is described. Screens read `summary.state`, never outcome + status.
export const STATE = {
  PROCESSING: { label: "Procesando", tone: "bg-brand-soft text-brand", dot: "bg-brand", icon: LoaderCircle },
  FAILED: { label: "No se pudo leer", tone: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/40", icon: CircleX },
  PAID: { label: "Pagada", tone: "bg-pay-soft text-pay", dot: "bg-pay", icon: CircleCheck },
  HELD: { label: "Frenada", tone: "bg-hold-soft text-hold", dot: "bg-hold", icon: OctagonX },
  WAITING: { label: "Espera tu decisión", tone: "bg-escalate-soft text-escalate", dot: "bg-escalate", icon: Hand },
  APPROVED: { label: "Aprobada por ti", tone: "bg-pay-soft text-pay", dot: "bg-pay", icon: UserCheck },
  REJECTED: { label: "Rechazada por ti", tone: "bg-hold-soft text-hold", dot: "bg-hold", icon: CircleX },
} as const satisfies Record<InvoiceState, { label: string; tone: string; dot: string; icon: LucideIcon }>;

export const STATES = Object.keys(STATE) as InvoiceState[];

export function describeState(state: InvoiceState) {
  switch (state) {
    case "PROCESSING": case "FAILED": case "PAID": case "HELD": case "WAITING": case "APPROVED": case "REJECTED":
      return STATE[state];
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
