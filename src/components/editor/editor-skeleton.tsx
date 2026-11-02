import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading editor">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-28 w-full rounded-md" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-96 w-full rounded-md" />
    </div>
  );
}
