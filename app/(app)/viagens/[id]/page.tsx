import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Calendar, Camera, Wallet, ListTree } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { createClient } from "@/lib/supabase/server";
import {
  getTrip,
  getTripSummary,
  listTripBudgetItems,
  listTripPhotos,
  getTripPhotoUrls,
} from "@/services/trips";
import { getCurrentUserContext } from "@/services/auth";
import { TripHeaderActions } from "@/components/trips/trip-header-actions";
import { TripDetailMap } from "@/components/trips/trip-detail-map";
import { TripGallery } from "@/components/trips/trip-gallery";
import { TripPhotoUploader } from "@/components/trips/trip-photo-uploader";
import { TripBudgetEditor } from "@/components/trips/trip-budget-editor";
import { TripAiSummary } from "@/components/trips/trip-ai-summary";
import { TRIP_STATUS_LABELS, TRIP_STATUS_TONES } from "@/types/trips";
import { formatDateShort, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2) return "🗺️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 65,
    A + code.toUpperCase().charCodeAt(1) - 65,
  );
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Sem datas";
  if (start && end) return `${formatDateShort(start)} → ${formatDateShort(end)}`;
  return start ? `A partir ${formatDateShort(start)}` : `Até ${formatDateShort(end!)}`;
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const ctx = await getCurrentUserContext();
  if (!ctx) notFound();

  const [summary, budgetItems, photos] = await Promise.all([
    getTripSummary(id),
    listTripBudgetItems(id),
    listTripPhotos(id),
  ]);
  if (!summary) notFound();

  const photoUrls = await getTripPhotoUrls(photos);
  const photosWithUrls = photos
    .map((p) => ({
      id: p.id,
      url: photoUrls.get(p.id) ?? "",
      caption: p.caption,
      width: p.width,
      height: p.height,
    }))
    .filter((p) => p.url);

  // Cover photo
  const coverUrl = trip.cover_photo_id
    ? photoUrls.get(trip.cover_photo_id) ?? null
    : photosWithUrls[0]?.url ?? null;

  // Transações vinculadas
  const supabase = await createClient();
  type LinkedTx = {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    kind: string;
    category: { name: string } | null;
    account: { name: string; institution: string } | null;
  };
  const { data: txs } = await (
    supabase.from as unknown as (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          order: (c: string, opts?: Record<string, unknown>) => {
            limit: (n: number) => Promise<{ data: LinkedTx[] | null }>;
          };
        };
      };
    }
  )("transactions")
    .select(
      "id, date, description, amount, currency, kind, category:categories(name), account:accounts!transactions_account_id_fkey(name, institution)",
    )
    .eq("trip_id", id)
    .order("date", { ascending: false })
    .limit(100);
  const linkedTxs = (txs ?? []) as LinkedTx[];

  // Budget item IDs pra delete
  const budgetItemIds = Object.fromEntries(
    budgetItems.map((b) => [b.category, b.id]),
  );

  const totalRemaining = summary.totalPlanned - summary.totalActual;

  return (
    <>
      <Link
        href="/viagens"
        className="inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 mb-3"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        Voltar para viagens
      </Link>

      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span className="text-[20px] leading-none">
              {flagEmoji(trip.country_code)}
            </span>
            <span>{trip.destination}</span>
            <Badge tone={TRIP_STATUS_TONES[trip.status]}>
              {TRIP_STATUS_LABELS[trip.status]}
            </Badge>
          </span>
        }
        title={
          <em className="not-italic font-display italic">{trip.name}</em>
        }
        subtitle={
          <span className="inline-flex items-center gap-3 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.7} />
              {fmtDateRange(trip.start_date, trip.end_date)}
            </span>
            <span className="text-faint-foreground">·</span>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.1em]">
              Moeda padrão: {trip.default_currency}
            </span>
          </span>
        }
        actions={<TripHeaderActions trip={trip} />}
      />

      {/* Hero com capa */}
      {coverUrl ? (
        <div className="relative aspect-[16/6] rounded-[10px] overflow-hidden border border-border mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={trip.destination} className="w-full h-full object-cover" />
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Planejado"
          textValue={formatMoney(summary.totalPlanned, trip.default_currency)}
          tone="neutral"
          hint={`${budgetItems.length} categoria${budgetItems.length !== 1 ? "s" : ""}`}
        />
        <KpiCard
          label="Realizado"
          textValue={formatMoney(summary.totalActual, trip.default_currency)}
          tone="negative"
          hint={`${summary.txCount} transações`}
        />
        <KpiCard
          label="Restante"
          textValue={formatMoney(totalRemaining, trip.default_currency)}
          tone={totalRemaining < 0 ? "negative" : "positive"}
          hint={
            summary.totalPlanned > 0
              ? `${((summary.totalActual / summary.totalPlanned) * 100).toFixed(0)}% usado`
              : "sem orçamento"
          }
        />
        <KpiCard
          label="Fotos"
          textValue={`${photosWithUrls.length}`}
          tone="muted"
          hint={photosWithUrls.length === 0 ? "nenhuma ainda" : "memórias"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Mapa */}
        {trip.latitude != null && trip.longitude != null ? (
          <Panel className="lg:col-span-2">
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4" strokeWidth={1.7} />
                  Localização
                </span>
              }
              meta={trip.destination}
            />
            <TripDetailMap
              latitude={trip.latitude}
              longitude={trip.longitude}
              name={trip.name}
              destination={trip.destination}
            />
          </Panel>
        ) : (
          <Panel className="lg:col-span-2">
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4" strokeWidth={1.7} />
                  Localização
                </span>
              }
            />
            <p className="text-[13px] text-muted-foreground">
              Sem coordenadas. Edite a viagem e clique em &ldquo;Localizar&rdquo;
              pra buscar automaticamente.
            </p>
          </Panel>
        )}

        {/* Notas / itinerário */}
        <Panel>
          <PanelHeader title="Notas" />
          {trip.notes ? (
            <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
              {trip.notes}
            </div>
          ) : (
            <p className="text-[12.5px] text-faint-foreground italic">
              Sem notas. Edite a viagem pra adicionar itinerário, voos, hotéis…
            </p>
          )}
        </Panel>
      </div>

      {/* Orçamento */}
      <Panel className="mb-6">
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Wallet className="w-4 h-4" strokeWidth={1.7} />
              Orçamento por categoria
            </span>
          }
          meta={`em ${trip.default_currency}`}
        />
        <TripBudgetEditor
          tripId={trip.id}
          currency={trip.default_currency}
          rows={summary.budgetByCategory}
          budgetItemIds={budgetItemIds}
        />
      </Panel>

      {/* Galeria */}
      <Panel className="mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Camera className="w-4 h-4" strokeWidth={1.7} />
                Galeria
              </span>
            }
            meta={`${photosWithUrls.length} foto${photosWithUrls.length !== 1 ? "s" : ""}`}
          />
          <TripPhotoUploader tripId={trip.id} householdId={ctx.household.id} />
        </div>
        <TripGallery
          tripId={trip.id}
          photos={photosWithUrls}
          coverPhotoId={trip.cover_photo_id}
        />
      </Panel>

      {/* Transações vinculadas */}
      <Panel className="mb-6">
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ListTree className="w-4 h-4" strokeWidth={1.7} />
              Transações vinculadas
            </span>
          }
          meta={`${linkedTxs.length} lançamento${linkedTxs.length !== 1 ? "s" : ""}`}
        />
        {linkedTxs.length === 0 ? (
          <p className="text-[12.5px] text-faint-foreground italic">
            Nenhuma transação vinculada. Ao lançar gastos relacionados a essa
            viagem em <Link className="text-navy-700 dark:text-navy-300 underline" href="/transacoes">/transacoes</Link>,
            selecione esta viagem no campo &ldquo;Viagem&rdquo; do formulário.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em] border-b border-border">
                  <th className="text-left py-2 font-medium">Data</th>
                  <th className="text-left py-2 font-medium">Descrição</th>
                  <th className="text-left py-2 font-medium">Categoria</th>
                  <th className="text-left py-2 font-medium">Conta</th>
                  <th className="text-right py-2 pr-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {linkedTxs.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-b-0">
                    <td className="py-2 font-mono text-[11px] text-muted-foreground">
                      {formatDateShort(t.date)}
                    </td>
                    <td className="py-2 pr-2 truncate max-w-[280px]">{t.description}</td>
                    <td className="py-2 text-muted-foreground">
                      {t.category?.name ?? "—"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {t.account ? `${t.account.name}` : "—"}
                    </td>
                    <td className="text-right pr-2 font-mono tabular-nums">
                      {formatMoney(Number(t.amount), t.currency as "BRL" | "EUR" | "USD" | "GBP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* AI Summary — só se viagem completada */}
      {trip.status === "completed" && summary.totalActual > 0 ? (
        <TripAiSummary tripId={trip.id} />
      ) : null}
    </>
  );
}
