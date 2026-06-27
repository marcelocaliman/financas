import { useEffect } from "react";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useHistorico } from "@/hooks/use-historico";
import { useBudget } from "@/hooks/use-budget";
import { useRates } from "@/store/rates";
import { useUI } from "@/store/ui";
import { actions } from "@/data/actions";
import { convert } from "@/money/currency";
import { budgetSaldoForMonth } from "@/finance/budget-saldo";
import { monthsBetween } from "@/finance/months";

/** Mês atual em "AAAA-MM" no horário LOCAL (UTC erraria a virada num app cross-border). */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

    const rows = snapshots.filter((s) => s.month === month);
    const manual = rows.find((s) => s.auto !== true);
    if (manual) {
      // Usuário assumiu o mês manualmente → respeita e limpa um auto duplicado, se houver.
      const dupAuto = rows.find((s) => s.auto === true);
      if (dupAuto) void actions.removeSnapshot(dupAuto.id);
      return;
    }
    const auto = rows.find((s) => s.auto === true);
    if (!auto) {
      void actions.putSnapshot({ id: crypto.randomUUID(), month, currency: base, amount: nw, contribution: want, auto: true });
    } else {
      const cur = auto.contribution ?? null;
      const tgt = want ?? null;
      const contribChanged = cur === null ? tgt !== null : tgt === null || Math.abs(cur - tgt) > 0.5;
      if (auto.currency !== base || Math.abs(auto.amount - nw) > 0.5 || contribChanged) {
        // Mantém o AUTO do mês corrente alinhado ao patrimônio, à moeda principal e ao saldo do orçamento.
        void actions.putSnapshot({ ...auto, currency: base, amount: nw, contribution: want });
      }
    }
  }, [data, snapshots, budget, rates, base]);
}
