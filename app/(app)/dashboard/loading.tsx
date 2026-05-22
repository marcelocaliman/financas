import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      {/* Hero */}
      <section className="rounded-[var(--radius-xl)] bg-ink-950 p-9 sm:p-12 mb-6 overflow-hidden">
        <Skeleton className="h-3 w-40 mb-4 !bg-ink-800" />
        <Skeleton className="h-16 w-72 mb-5 !bg-ink-800" />
        <Skeleton className="h-5 w-44 !bg-ink-800" />
        <div className="grid grid-cols-3 gap-6 mt-10">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16 mb-3 !bg-ink-800" />
              <Skeleton className="h-7 w-32 !bg-ink-800" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <Skeleton className="h-72 mb-6" />
      <Skeleton className="h-80" />
    </>
  );
}
