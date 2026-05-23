import { Skeleton } from "@/components/ui/skeleton";

export default function AnaliseLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-9 w-64 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28 col-span-2 sm:col-span-1" />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mb-5">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>

      <Skeleton className="h-80" />
    </>
  );
}
