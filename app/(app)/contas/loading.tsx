import { Skeleton } from "@/components/ui/skeleton";

export default function ContasLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-9 w-56 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      <Skeleton className="h-16 mb-6" />

      <div className="space-y-7">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-3 w-32 mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
