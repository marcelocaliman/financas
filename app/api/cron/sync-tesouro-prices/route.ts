import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { dateInSP } from "@/lib/financial/business-days";

/**
 * Cron diário: sincroniza PU oficial do Tesouro Direto.
 *
 *  1. Baixa o CSV oficial de tesourotransparente.gov.br (atualizado D-1)
 *  2. Parseia, extrai PU base por (titulo, vencimento, data)
 *  3. Upserta últimas 30 datas em tesouro_quotes
 *  4. Pra cada investimento RF pública com quantity > 0 e match por
 *     nome+vencimento, calcula current_balance = qty × PU_atual e atualiza
 *     last_yield_at = data do PU
 *
 * Resultado: zero clique pro user. Saldo do Tesouro fica 100% preciso,
 * fonte oficial do Tesouro Nacional. Cron rodando dentro do daily-master.
 *
 * Pra RF privada (CDB/LCI/LCA), o cron update-balances cuida via Selic/CDI.
 * Pra ativos sem quantity, é necessária sincronização manual única (button
 * no menu) ou cadastrar quantity no edit dialog.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CSV_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

/** Converte DD/MM/YYYY → YYYY-MM-DD. */
function brDateToIso(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

type QuoteRow = {
  title_type: string;
  maturity_date: string;
  base_date: string;
  pu_base: number;
};

/**
 * Parseia o CSV mantendo só linhas recentes (últimas N datas pra economizar
 * banco). O CSV inteiro tem 14MB e décadas de histórico — só precisamos das
 * últimas semanas pro cron.
 */
function parseRecentQuotes(csv: string, daysToKeep = 30): QuoteRow[] {
  const lines = csv.split("\n");
  // Header: Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;...;PU Base Manha
  // Index: 0           1               2          3                  ;7
  const allRows: QuoteRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split(";");
    if (parts.length < 8) continue;
    const title = parts[0]?.trim();
    const matBr = parts[1]?.trim();
    const baseBr = parts[2]?.trim();
    const puStr = parts[7]?.trim();
    if (!title || !matBr || !baseBr || !puStr) continue;
    const pu = parseFloat(puStr.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(pu) || pu <= 0) continue;
    allRows.push({
      title_type: title,
      maturity_date: brDateToIso(matBr),
      base_date: brDateToIso(baseBr),
      pu_base: pu,
    });
  }
  // Acha a data mais recente, mantém só as últimas N
  const dates = Array.from(new Set(allRows.map((r) => r.base_date))).sort();
  const cutoff = dates[dates.length - daysToKeep] ?? dates[0];
  return allRows.filter((r) => r.base_date >= cutoff);
}

/** Acha o latest PU pra (title_type, maturity_date) em uma lista de quotes. */
function latestPuFor(
  quotes: QuoteRow[],
  titleType: string,
  maturityIso: string,
): QuoteRow | null {
  let best: QuoteRow | null = null;
  for (const q of quotes) {
    if (q.title_type !== titleType) continue;
    if (q.maturity_date !== maturityIso) continue;
    if (!best || q.base_date > best.base_date) best = q;
  }
  return best;
}

/**
 * Tenta inferir (title_type, maturity_date) de um investimento.
 * Heurística (case-insensitive):
 *  - Nome contém "selic" → Tesouro Selic
 *  - "ipca" → Tesouro IPCA+
 *  - "ipca+ juros" / "ntn-b" sem "principal" → Tesouro IPCA+ com Juros Semestrais
 *  - "prefixado juros" → Tesouro Prefixado com Juros Semestrais
 *  - "prefixado" → Tesouro Prefixado
 *  - "renda+" → Tesouro RendA+
 *  - "educa+" → Tesouro Educa+
 * Vencimento extraído do ticker/name buscando padrão YYYY (4 dígitos 2025-2099).
 * Assume dia/mês padrão: Selic = 01/03, IPCA+ = 15/05, Prefixado = 01/01.
 */
function inferTesouroParams(
  ticker: string,
  name: string,
): { title_type: string; maturity_date: string } | null {
  const text = `${name} ${ticker}`.toLowerCase();
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = yearMatch[1];

  let titleType: string;
  let dayMonth: string;

  if (text.includes("selic")) {
    titleType = "Tesouro Selic";
    dayMonth = "03-01"; // 01/03 — padrão LFT
  } else if (text.includes("ipca")) {
    if (text.includes("principal")) {
      titleType = "Tesouro IPCA+";
      dayMonth = "05-15";
    } else {
      titleType = "Tesouro IPCA+ com Juros Semestrais";
      dayMonth = "08-15";
    }
  } else if (text.includes("renda+")) {
    titleType = "Tesouro RendA+";
    dayMonth = "01-15";
  } else if (text.includes("educa")) {
    titleType = "Tesouro Educa+";
    dayMonth = "01-15";
  } else if (text.includes("prefixado")) {
    if (text.includes("juros")) {
      titleType = "Tesouro Prefixado com Juros Semestrais";
      dayMonth = "01-01";
    } else {
      titleType = "Tesouro Prefixado";
      dayMonth = "01-01";
    }
  } else {
    return null;
  }
  return {
    title_type: titleType,
    maturity_date: `${year}-${dayMonth}`,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const todayIso = dateInSP(new Date()).iso;

  // ============== 1. Verifica cache: precisa baixar?
  // Cast: tabela tesouro_quotes adicionada via migration 20260527010000
  const { data: latestCache } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        order: (c: string, o: object) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{ data: { base_date: string } | null }>;
          };
        };
      };
    };
  })
    .from("tesouro_quotes")
    .select("base_date")
    .order("base_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cachedLatest = latestCache?.base_date ?? "1970-01-01";

  let csvDownloaded = false;
  let quotesUpserted = 0;

  // Baixa só se cache não tem dado de ontem/hoje
  if (cachedLatest < todayIso) {
    csvDownloaded = true;
    const res = await fetch(CSV_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (nossasfinancas.com.br bot)" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Tesouro CSV HTTP ${res.status}` },
        { status: 502 },
      );
    }
    const csv = await res.text();
    const recent = parseRecentQuotes(csv, 30);

    // Upsert em batch (chunks de 500 pra não estourar)
    for (let i = 0; i < recent.length; i += 500) {
      const chunk = recent.slice(i, i + 500);
      // Cast: tabela tesouro_quotes não tem types regenerados ainda
      const { error: upErr } = await (supabase as unknown as {
        from: (t: string) => {
          upsert: (
            data: QuoteRow[],
            options: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("tesouro_quotes")
        .upsert(chunk, { onConflict: "title_type,maturity_date,base_date" });
      if (upErr) {
        return NextResponse.json(
          { ok: false, error: `Upsert quotes falhou: ${upErr.message}` },
          { status: 500 },
        );
      }
      quotesUpserted += chunk.length;
    }
  }

  // ============== 2. Recarrega quotes recentes do banco pra usar no sync
  // Cast: tabela tesouro_quotes não tem types regenerados ainda
  const { data: allQuotes } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        order: (c: string, o: object) => Promise<{
          data: QuoteRow[] | null;
        }>;
      };
    };
  })
    .from("tesouro_quotes")
    .select("title_type, maturity_date, base_date, pu_base")
    .order("base_date", { ascending: true });

  const quotes = allQuotes ?? [];

  // ============== 3. Sync de cada investimento RF pública
  const { data: investments } = await supabase
    .from("investments")
    .select("id, ticker, name, asset_type, quantity, current_balance, last_yield_at")
    .eq("is_active", true)
    .eq("asset_type", "fixed_income_public");

  const report: Array<{
    id: string;
    ticker: string;
    matched: boolean;
    titleType?: string;
    maturityDate?: string;
    qty?: number;
    puUsed?: number;
    puDate?: string;
    oldBalance: number;
    newBalance?: number;
    skipped?: string;
  }> = [];

  for (const inv of investments ?? []) {
    const params = inferTesouroParams(inv.ticker, inv.name);
    if (!params) {
      report.push({
        id: inv.id,
        ticker: inv.ticker,
        matched: false,
        oldBalance: Number(inv.current_balance),
        skipped: "não consegui parsear tipo/vencimento do nome",
      });
      continue;
    }
    const quote = latestPuFor(quotes, params.title_type, params.maturity_date);
    if (!quote) {
      report.push({
        id: inv.id,
        ticker: inv.ticker,
        matched: false,
        titleType: params.title_type,
        maturityDate: params.maturity_date,
        oldBalance: Number(inv.current_balance),
        skipped: "sem PU no cache pra esse título",
      });
      continue;
    }
    const qty = Number(inv.quantity ?? 0);
    if (qty <= 0) {
      report.push({
        id: inv.id,
        ticker: inv.ticker,
        matched: true,
        titleType: params.title_type,
        maturityDate: params.maturity_date,
        puUsed: quote.pu_base,
        puDate: quote.base_date,
        oldBalance: Number(inv.current_balance),
        skipped: "sem quantity cadastrada (use sync manual uma vez)",
      });
      continue;
    }
    const newBalance = Math.round(qty * quote.pu_base * 100) / 100;
    const { error: updErr } = await supabase
      .from("investments")
      .update({ current_balance: newBalance, last_yield_at: quote.base_date })
      .eq("id", inv.id);
    if (updErr) {
      report.push({
        id: inv.id,
        ticker: inv.ticker,
        matched: true,
        titleType: params.title_type,
        maturityDate: params.maturity_date,
        oldBalance: Number(inv.current_balance),
        skipped: `update falhou: ${updErr.message}`,
      });
      continue;
    }
    report.push({
      id: inv.id,
      ticker: inv.ticker,
      matched: true,
      titleType: params.title_type,
      maturityDate: params.maturity_date,
      qty,
      puUsed: quote.pu_base,
      puDate: quote.base_date,
      oldBalance: Number(inv.current_balance),
      newBalance,
    });
  }

  return NextResponse.json({
    ok: true,
    csvDownloaded,
    quotesUpserted,
    cachedLatestBefore: cachedLatest,
    todayIso,
    syncedCount: report.filter((r) => r.newBalance != null).length,
    skippedCount: report.filter((r) => r.skipped).length,
    items: report,
  });
}
