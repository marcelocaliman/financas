import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriasLoading() {
  return (
    <>
      <div className="mb-8">
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-9 w-56 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </>
  );
}
