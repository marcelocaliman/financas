import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-9 w-72 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Hero */}
      <section className="rounded-[var(--radius-xl)] bg-ink-950 p-9 sm:p-12 mb-6 overflow-hidden border border-ink-700">
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

      {/* TIER 1 — FIRE + Cobertura */}
      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>

      {/* TIER 2 — Obrigações + Metas */}
      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>

      {/* TIER 3 — Top categorias + Composição */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 mb-8">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>

      {/* TIER 4 — Últimos movimentos */}
      <Skeleton className="h-72" />
    </>
  );
}
