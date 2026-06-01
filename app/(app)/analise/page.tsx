import { MonthlyView } from "@/components/analise/monthly-view";
import { AnnualView } from "@/components/analise/annual-view";

export const dynamic = "force-dynamic";

type SearchParams = { view?: string; month?: string; year?: string };

/**
 * Histórico — a casa única do "como foi meu dinheiro?". Antes eram duas páginas
 * (/analise + /relatorios); agora é uma só com seletor de granularidade:
 *   ?view=meses (default) → insights dos últimos 6 meses
 *   ?view=ano             → fechamento fiscal do ano (bens, proventos, export)
 */
export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { view, month, year } = await searchParams;

  if (view === "ano") {
    const y = year ? parseInt(year, 10) : new Date().getUTCFullYear() - 1;
    const safeYear = Number.isNaN(y) || y < 2000 || y > 2100 ? new Date().getUTCFullYear() - 1 : y;
    return <AnnualView year={safeYear} />;
  }

  return <MonthlyView month={month} />;
}
