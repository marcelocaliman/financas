import { Skeleton } from "@/components/ui/skeleton";

export default function InvestimentosLoading() {
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-9 w-64 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Ticker live */}
      <section className="rounded-[var(--radius-xl)] bg-ink-950 p-9 sm:p-10 mb-7 overflow-hidden">
        <Skeleton className="h-3 w-44 mb-4 !bg-ink-800" />
        <Skeleton className="h-12 w-72 mb-4 !bg-ink-800" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-40 !bg-ink-800" />
          <Skeleton className="h-8 w-40 !bg-ink-800" />
          <Skeleton className="h-8 w-32 !bg-ink-800" />
        </div>
      </section>

      {/* Tabelas (renda variável + fixa) */}
      {[0, 1].map((i) => (
        <section
          key={i}
          className="rounded-[var(--radius-xl)] border border-border bg-surface mb-8 overflow-hidden"
        >
          <div className="px-7 pt-7 pb-6 border-b border-border">
            <Skeleton className="h-3 w-32 mb-2" />
            <Skeleton className="h-8 w-44" />
          </div>
          <div className="px-7 py-4 space-y-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
