import { Skeleton } from "@/components/ui/skeleton";

export function RulesSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
