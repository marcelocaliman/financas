import { Skeleton } from "@/components/ui/skeleton";

export default function RecorrentesLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-9 w-72 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </>
  );
}
