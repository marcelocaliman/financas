import "server-only";
import { safeJson } from "@/lib/external/resilient-fetch";
import { logger } from "@/lib/logger";

/**
 * Cotação PTAX do Banco Central (fonte oficial exigida pela Receita pra valorar
 * Bens e Direitos em moeda estrangeira no IR — decisão D14). Usa a API Olinda
 * do BCB. Pra display continuamos com ECB/Frankfurter; PTAX é só pro IR.
 *
 * Regras:
 *  - Bens (ativos) em moeda estrangeira: cotação de COMPRA de 31/12.
 *  - 31/12 sem boletim (fim de semana/feriado): usa o último anterior.
 */

const BCB_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type PtaxCurrency = (typeof BCB_CURRENCIES)[number];

interface PtaxValue {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string;
}

/** Formata YYYY-MM-DD → MM-DD-YYYY (formato exigido pela API do BCB). */
function toBcbDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
}

/** Subtrai N dias de um ISO date (puro, sem Date.now). */
function minusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

/**
 * Busca a cotação PTAX de COMPRA (BRL por unidade) de uma moeda numa data.
 * Se a data não tiver boletim, anda pra trás até `maxBack` dias. Retorna null
 * se nada for encontrado (chamador degrada — não corrompe).
 */
export async function fetchPtaxCompra(
  currency: PtaxCurrency,
  isoDate: string,
  maxBack = 6,
): Promise<{ rate: number; date: string } | null> {
  for (let back = 0; back <= maxBack; back++) {
    const tryDate = minusDays(isoDate, back);
    const url =
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
      `CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)` +
      `?@moeda='${currency}'&@dataCotacao='${toBcbDate(tryDate)}'` +
      `&$top=1&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;
    const res = await safeJson<{ value: PtaxValue[] }>(url, { label: "bcb-ptax", timeoutMs: 10_000 });
    if (!res.ok) {
      logger.warn("PTAX indisponível (degradando)", { currency, tryDate });
      continue;
    }
    const row = res.data.value?.[0];
    if (row && Number(row.cotacaoCompra) > 0) {
      return { rate: Number(row.cotacaoCompra), date: tryDate };
    }
  }
  return null;
}

export const PTAX_CURRENCIES = BCB_CURRENCIES;
