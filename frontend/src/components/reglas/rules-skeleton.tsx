import { Skeleton } from "@/components/ui/skeleton";

export function RulesSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-7 w-2/3" />
      </div>
      <div className="divide-y">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <Skeleton className="size-7 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
