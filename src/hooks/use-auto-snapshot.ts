import { useEffect } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useHistorico } from "@/hooks/use-historico";
import { useBudget } from "@/hooks/use-budget";
import { useRates } from "@/store/rates";
import { useUI } from "@/store/ui";
import { actions } from "@/data/actions";
import { convert } from "@/money/currency";
import { budgetSaldoForMonth } from "@/finance/budget-saldo";
import { monthsBetween, currentMonth } from "@/finance/months";
import { planCurrentMonthAuto } from "@/finance/auto-snapshot";

/**
 * Histórico automático: captura/atualiza UM snapshot do mês corrente com o patrimônio
 * líquido atual, na MOEDA PRINCIPAL do usuário (mesma âncora dos lançamentos), pra a
 * série não misturar moedas. Enquanto o mês corre ele se atualiza sozinho; meses
 * passados ficam congelados. Se o usuário editar a linha (vira `auto: false`), o
 * automático para de mexer nela. Não roda em app vazio.
 *
 * SEM BURACOS: como é tudo no cliente (E2EE, sem cron no servidor), se o usuário ficar
 * meses sem abrir o app, ao voltar preenchemos os meses que faltaram entre o último
 * registro e hoje — carregando pra frente o último patrimônio conhecido (LOCF: sem
 * inventar tendência). Esses meses ficam `auto: true` e editáveis; id determinístico
 * (`auto-AAAA-MM`) garante idempotência mesmo se o efeito disparar duas vezes.
 */
export function useAutoSnapshot(): void {
  const data = usePatrimonio();
  const snapshots = useHistorico();
  const budget = useBudget();
  const rates = useRates((s) => s.rates);
  const base = useUI((s) => s.baseCurrency);

  useEffect(() => {
    if (!data || !snapshots) return;
    if (data.assets.length === 0 && data.liabilities.length === 0) return;

    const month = currentMonth();
    const nw =
      data.assets.reduce((s, a) => s + convert(a.amount, a.currency, base, rates), 0) -
      data.liabilities.reduce((s, l) => s + convert(l.amount, l.currency, base, rates), 0);
    // Ponte com o orçamento: o aporte do mês = saldo (poupança) do orçamento, na moeda principal.
    const saldo = budgetSaldoForMonth(month, budget, base, rates);
    // Mas o aporte só faz sentido com um mês ANTERIOR pra comparar (decompõe o crescimento). No 1º
    // mês (sem anterior), o aporte fica VAZIO — senão vira um número solto que confunde.
    const past = snapshots.filter((s) => s.month < month);
    const hasPrior = past.length > 0;
    const want = hasPrior && saldo != null ? saldo : undefined;

    // Preenche os meses que faltaram (usuário ficou sem abrir o app) carregando pra frente o
    // último patrimônio conhecido. Não toca em meses que já existem (preserva edições manuais).
    if (hasPrior) {
      const lastPast = past.reduce((a, b) => (a.month > b.month ? a : b));
      const carry = convert(lastPast.amount, lastPast.currency, base, rates);
      const have = new Set(snapshots.map((s) => s.month));
      for (const m of monthsBetween(lastPast.month, month)) {
        if (!have.has(m)) {
          void actions.putSnapshot({ id: `auto-${m}`, month: m, currency: base, amount: carry, auto: true });
        }
      }
    }

    // Reconciliação do mês corrente num módulo PURO (testável): garante 1 auto por mês com id
    // determinístico e limpa duplicatas (o bug antigo do id aleatório criava 2 linhas do mesmo mês).
    for (const op of planCurrentMonthAuto(snapshots, month, base, nw, want)) {
      if (op.type === "put") void actions.putSnapshot(op.snapshot);
      else void actions.removeSnapshot(op.id);
    }
  }, [data, snapshots, budget, rates, base]);
}
