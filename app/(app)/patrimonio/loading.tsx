import { Skeleton } from "@/components/ui/skeleton";

export default function PatrimonioLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-9 w-64 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <section className="rounded-[var(--radius-xl)] bg-ink-950 p-9 mb-7 overflow-hidden border border-ink-700">
        <Skeleton className="h-3 w-44 mb-4 !bg-ink-800" />
        <Skeleton className="h-14 w-80 !bg-ink-800" />
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </>
  );
}
