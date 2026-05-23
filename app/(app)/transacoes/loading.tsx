import { Skeleton } from "@/components/ui/skeleton";

export default function TransacoesLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-9 w-72 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24 col-span-2 sm:col-span-1" />
      </div>

      <div className="flex gap-2 mb-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-72" />
      </div>

      <section className="rounded-[var(--radius-xl)] border border-border bg-surface px-7 py-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-48 flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </section>
    </>
  );
}
