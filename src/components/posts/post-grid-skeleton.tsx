import { Skeleton } from "@/components/ui/skeleton";

export function PostGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading articles">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[16/9] w-full rounded-md" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
