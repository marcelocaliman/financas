import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPtaxCompra, PTAX_CURRENCIES } from "@/lib/external/bcb-ptax";
import { logger } from "@/lib/logger";

/**
 * Captura a PTAX de 31/12 (cotação de compra) de USD/EUR/GBP e grava em
 * currency_rates com source='ptax'. Como a PK é (base,quote,date), a PTAX de
 * 31/12 vira a cotação autoritativa daquela data — e getRateMapAt(yearEnd) a
 * usa automaticamente pra valorar Bens no IR (decisão D14).
 *
 * Degrada por moeda: se uma falhar, as outras seguem; nunca aborta o batch.
 */
export async function capturePtaxForYearEnd(
  year: number,
): Promise<{ year: number; captured: string[]; missing: string[] }> {
  const admin = createAdminClient();
  const yearEnd = `${year}-12-31`;
  const captured: string[] = [];
  const missing: string[] = [];

  for (const cur of PTAX_CURRENCIES) {
    const r = await fetchPtaxCompra(cur, yearEnd);
    if (!r) {
      missing.push(cur);
      continue;
    }
    // Grava sob a data 31/12 (semântica do IR), mesmo que o boletim seja do
    // último dia útil anterior.
    const { error } = await admin
      .from("currency_rates")
      .upsert({ base: cur, quote: "BRL", date: yearEnd, rate: r.rate, source: "ptax" });
    if (error) {
      logger.error("PTAX upsert falhou", error, { cur, year });
      missing.push(cur);
    } else {
      captured.push(cur);
    }
  }

  logger.info("PTAX 31/12 capturada", { year, captured, missing });
  return { year, captured, missing };
}
