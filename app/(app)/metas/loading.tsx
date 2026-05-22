import { Skeleton } from "@/components/ui/skeleton";

export default function MetasLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="h-3 w-48 mb-3" />
        <Skeleton className="h-9 w-56 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <Skeleton className="h-10 w-72 mb-6" />

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </>
  );
}
