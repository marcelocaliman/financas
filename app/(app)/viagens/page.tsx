import Link from "next/link";
import { Plane, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { listTripsWithSummary } from "@/services/trips";
import { NewTripButton } from "@/components/trips/new-trip-button";
import { TripsWorldMap } from "@/components/trips/trips-world-map";
import { formatCurrency } from "@/lib/financial/currency";
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUS_TONES,
  type TripStatus,
} from "@/types/trips";

export const dynamic = "force-dynamic";

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Sem datas";
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  const startY = start?.slice(0, 4);
  const endY = end?.slice(0, 4);
  if (start && end) {
    return startY === endY
      ? `${fmt(start)} → ${fmt(end)}/${endY}`
      : `${fmt(start)}/${startY} → ${fmt(end)}/${endY}`;
  }
  return start ? `A partir ${fmt(start)}/${startY}` : `Até ${fmt(end!)}/${endY}`;
}

function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2) return "🗺️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 65,
    A + code.toUpperCase().charCodeAt(1) - 65,
  );
}

export default async function ViagensPage() {
  const summaries = await listTripsWithSummary();

  const grouped = {
    planning: summaries.filter((s) => s.trip.status === "planning"),
    confirmed: summaries.filter((s) => s.trip.status === "confirmed"),
    in_progress: summaries.filter((s) => s.trip.status === "in_progress"),
    completed: summaries.filter((s) => s.trip.status === "completed"),
    cancelled: summaries.filter((s) => s.trip.status === "cancelled"),
  };
  const ordered: TripStatus[] = [
    "in_progress",
    "confirmed",
    "planning",
    "completed",
    "cancelled",
  ];

  const pins = summaries
    .filter((s) => s.trip.latitude != null && s.trip.longitude != null)
    .map((s) => ({
      id: s.trip.id,
      name: s.trip.name,
      destination: s.trip.destination,
      latitude: s.trip.latitude!,
      longitude: s.trip.longitude!,
      href: `/viagens/${s.trip.id}`,
    }));

  return (
    <>
      <PageHeader
        eyebrow={`${summaries.length} viage${summaries.length === 1 ? "m" : "ns"}`}
        title={
          <>
            Suas{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              viagens.
            </em>
          </>
        }
        subtitle="Planeje, orce e registre. Cada viagem com seu próprio orçamento, fotos e mapa — gastos reais se conectam ao seu fluxo financeiro normal."
        actions={<NewTripButton />}
      />

      {summaries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {pins.length > 0 ? (
            <Panel className="mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-display text-[17px] font-medium tracking-[-0.01em]">
                  Lugares que você já foi (ou vai)
                </h2>
                <span className="font-mono text-[11px] text-faint-foreground">
                  {pins.length} pin{pins.length !== 1 ? "s" : ""}
                </span>
              </div>
              <TripsWorldMap pins={pins} />
            </Panel>
          ) : null}

          {ordered.map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status} className="mb-7">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint-foreground font-medium">
                    {TRIP_STATUS_LABELS[status]} ({items.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((s) => (
                    <TripCard key={s.trip.id} summary={s} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

function TripCard({
  summary,
}: {
  summary: Awaited<ReturnType<typeof listTripsWithSummary>>[number];
}) {
  const t = summary.trip;
  const pct =
    summary.totalPlanned > 0
      ? (summary.totalActual / summary.totalPlanned) * 100
      : 0;
  const pctTone =
    pct > 100
      ? "text-rust-600"
      : pct > 80
        ? "text-gold-700 dark:text-gold-400"
        : "text-olive-700 dark:text-olive-400";

  return (
    <Link
      href={`/viagens/${t.id}`}
      className="group block rounded-[10px] border border-border bg-surface hover:border-navy-700/40 hover:-translate-y-px transition-all overflow-hidden"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-navy-700/15 to-olive-700/10 flex items-center justify-center text-[42px]">
        {flagEmoji(t.country_code)}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-medium text-[14.5px] text-foreground truncate">
            {t.name}
          </div>
          <Badge tone={TRIP_STATUS_TONES[t.status]}>
            {TRIP_STATUS_LABELS[t.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-muted-foreground mb-3">
          <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.7} />
          <span className="truncate">{t.destination}</span>
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint-foreground mb-1">
          {fmtDateRange(t.start_date, t.end_date)}
        </div>
        {summary.totalPlanned > 0 ? (
          <>
            <div className="flex items-baseline justify-between mt-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground">
                Realizado / Orçado
              </span>
              <span className={`font-mono text-[12px] tabular-nums ${pctTone}`}>
                {pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden mt-1">
              <div
                className={`h-full ${pct > 100 ? "bg-rust-600" : pct > 80 ? "bg-gold-600" : "bg-olive-600"}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="text-[11.5px] text-muted-foreground mt-1.5 font-mono tabular-nums">
              {formatCurrency(summary.totalActual, t.default_currency)} /{" "}
              {formatCurrency(summary.totalPlanned, t.default_currency)}
            </div>
          </>
        ) : summary.totalActual > 0 ? (
          <div className="mt-3 font-mono text-[12px] tabular-nums">
            Realizado:{" "}
            {formatCurrency(summary.totalActual, t.default_currency)}{" "}
            <span className="text-faint-foreground text-[10.5px]">
              (sem orçamento)
            </span>
          </div>
        ) : (
          <p className="text-[12px] text-faint-foreground italic mt-2">
            Sem orçamento nem gastos ainda.
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[480px]">
        <Plane
          className="w-8 h-8 text-faint-foreground mx-auto mb-3"
          strokeWidth={1.4}
        />
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          Nenhuma viagem cadastrada
        </div>
        <h2 className="font-display text-[24px] tracking-[-0.02em] mt-2">
          Comece pela próxima ou pela mais memorável.
        </h2>
        <p className="text-[13.5px] text-muted-foreground mt-2.5 leading-relaxed">
          Use o botão <b>&ldquo;Nova viagem&rdquo;</b> acima. Cadastre destino,
          orce por categoria, suba fotos depois. As despesas que você lançar com
          o tag dessa viagem aparecem aqui automaticamente.
        </p>
      </div>
    </Panel>
  );
}
