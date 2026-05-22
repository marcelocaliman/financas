import { Skeleton } from "@/components/ui/skeleton";

export default function ConfiguracoesLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-9 w-56 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </>
  );
}
