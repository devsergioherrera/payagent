import { Skeleton } from "@/components/ui/skeleton";

export function CostsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Skeleton className="h-48 rounded-2xl lg:col-span-5" />
        <Skeleton className="h-[420px] rounded-2xl lg:col-span-7" />
      </div>
    </div>
  );
}
