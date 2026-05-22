import { Skeleton } from "@/components/ui/skeleton";

export default function ResgatesLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="h-3 w-44 mb-3" />
        <Skeleton className="h-9 w-72 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <Skeleton className="h-24 mb-6" />

      <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-7 items-center mb-7">
        <Skeleton className="h-32" />
        <Skeleton className="h-10 w-12" />
        <Skeleton className="h-32" />
      </div>

      <Skeleton className="h-72 mb-7" />
      <Skeleton className="h-64" />
    </>
  );
}
