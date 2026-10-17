import { Skeleton } from "@/components/ui/skeleton";

export function VendorsSkeleton() {
  return (
    <ul className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex flex-col gap-2 rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
          <Skeleton className="h-3.5 w-48" />
        </li>
      ))}
    </ul>
  );
}
