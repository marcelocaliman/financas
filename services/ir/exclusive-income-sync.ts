import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Mantém ir_other_incomes (rendimentos exclusivos de fonte) sincronizado com
 * os investimentos liquidados no ano.
 *
 * Para cada investimento com closed_at no ano informado:
 *  - 0 entradas em ir_other_incomes → cria 1
 *  - 1 entrada → não faz nada
 *  - 2+ entradas (estado sujo) → mantém a mais antiga, deleta as duplicadas
 *
 * Função totalmente idempotente. Chamada em 2 lugares:
 *  1. services/investments.actions.ts → liquidateInvestment (após RPC)
 *  2. app/(app)/ir/[year]/page.tsx (self-healing no render)
 *
 * Custo: 1 query pra listar liquidações + N queries por liquidação. Pra um
 * household com poucas dezenas de liquidações/ano, é ~ms. Cacheado por
 * request via React cache pra não duplicar trabalho dentro do mesmo render.
 */
export const ensureExclusiveIncomeForClosures = cache(
  async (
    year: number,
    householdId: string,
  ): Promise<{ created: number; deduped: number; kept: number }> => {
    const supabase = await createClient();

    const { data: closed } = await supabase
      .from("investments")
      .select(
        "id, ticker, name, asset_type, initial_amount, gross_proceeds_on_close, ir_withheld_on_close, closed_at, closed_reason, cnpj, owner_filer_id",
      )
      .eq("household_id", householdId)
      .not("closed_at", "is", null)
      .gte("closed_at", `${year}-01-01`)
      .lte("closed_at", `${year}-12-31`);

    let created = 0;
    let deduped = 0;
    let kept = 0;

    for (const c of closed ?? []) {
      // Aceita venda sem lucro (gross == initial) — vai com gross_amount = 0
      // mas só se houve IR retido (pra evitar lançamentos vazios).
      // Vendas com prejuízo (gross < initial) também viram entry com gross=0,
      // o prejuízo em si vai pra apuração de Renda Variável (não aqui).
      if (!c.gross_proceeds_on_close || Number(c.gross_proceeds_on_close) <= 0) continue;

      // Procura entradas existentes pra esse ticker no ano. Casa o ticker
      // DELIMITADO por " · " (formato fixo da description abaixo) pra não casar
      // por substring — antes "%PETR%" casava "PETR4", "%BOVA%" casava "BOVA11",
      // podendo pular criação (subdeclaração) ou deletar entrada de outro ativo.
      const { data: existing } = await supabase
        .from("ir_other_incomes")
        .select("id, created_at")
        .eq("household_id", householdId)
        .eq("year", year)
        .eq("category", "exclusivo_fonte")
        .like("description", `%· ${c.ticker} ·%`)
        .order("created_at", { ascending: true });

      const list = existing ?? [];

      if (list.length === 0) {
        // Não existe — cria
        const rendimentoBruto = Math.max(
          0,
          Number(c.gross_proceeds_on_close) - Number(c.initial_amount),
        );
        const irrf = Number(c.ir_withheld_on_close ?? 0);
        const isTesouroDireto = c.asset_type === "fixed_income_public";
        const sourceName = isTesouroDireto ? "Tesouro Nacional" : c.name;
        const sourceCnpj = isTesouroDireto ? "00.394.460/0001-41" : c.cnpj;
        const closedAtDate = (c.closed_at as string).slice(0, 10);
        const description = `Rendimento exclusivo fonte · ${c.ticker} · liquidação ${closedAtDate
          .split("-")
          .reverse()
          .join("/")}`;

        const { error: insErr } = await supabase.from("ir_other_incomes").insert({
          household_id: householdId,
          year,
          category: "exclusivo_fonte",
          description,
          source_name: sourceName,
          source_cnpj_cpf: sourceCnpj,
          gross_amount: Math.round(rendimentoBruto * 100) / 100,
          irrf_amount: Math.round(irrf * 100) / 100,
          inss_amount: 0,
          thirteenth_amount: 0,
          currency: "BRL",
          owner_filer_id: c.owner_filer_id,
          notes: `Gerado automaticamente do fechamento (${c.closed_reason}).`,
        });
        if (!insErr) created++;
      } else if (list.length === 1) {
        kept++;
      } else {
        // Duplicatas: mantém a mais antiga, deleta o resto
        const [keep, ...drop] = list;
        const ids = drop.map((d) => d.id);
        const { error: delErr } = await supabase
          .from("ir_other_incomes")
          .delete()
          .in("id", ids);
        if (!delErr) {
          deduped += ids.length;
          kept++;
        }
        void keep;
      }
    }

    return { created, deduped, kept };
  },
);
