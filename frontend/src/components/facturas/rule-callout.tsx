import Link from "next/link";
import { FilePlus, OctagonX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CreateRuleButton({ id, secondary = true }: { id: string; secondary?: boolean }) {
  return (
    <Link
      href={`/reglas?from=${id}`}
      className={cn(buttonVariants({ variant: secondary ? "outline" : "default", size: "sm" }), "shrink-0 active:scale-[0.98]")}
    >
      <FilePlus /> Crear regla a partir de esta factura
    </Link>
  );
}

// A hold is final: nobody releases it. The only follow-up is to change the rules.
export function HoldCallout({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex min-w-0 items-start gap-2.5 text-[13px] text-muted-foreground">
        <OctagonX className="mt-0.5 size-4 shrink-0 text-hold" />
        El agente frenó esta factura. Si crees que una regla debe cambiar, créala desde aquí.
      </p>
      <CreateRuleButton id={id} />
    </div>
  );
}
