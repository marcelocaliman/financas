import { repository } from "@/data/dexie-repository";
import { buildSeed } from "@/data/seed";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";
import { pending } from "@/vault/pending";
import type {
  AppSettings,
  Asset,
  Dividend,
  Expense,
  Goal,
  Income,
  Liability,
  NetWorthSnapshot,
} from "@/domain/types";
import type { Taxonomy } from "@/domain/taxonomy";
import { planRecurring } from "@/domain/recurring";

/**
 * Mutações do app. Escrevem PRIMEIRO no repositório local (instantâneo, offline),
 * MARCAM pendência de sync e disparam o push cifrado em segundo plano. Se a rede
 * falhar, o dado já está salvo localmente e a flag garante que o próximo
 * unlock/online re-tente subir — sem nunca sobrescrever o local com o servidor.
 */
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Meses com materialização de recorrentes em curso — evita escrita dupla (StrictMode/efeito reentrante). */
const materializing = new Set<string>();

/** Coalesce: edições rápidas (grid) viram UM push, não um por célula. */
function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void useVault
      .getState()
      .push()
      .catch((e) => console.warn("sync adiado (será re-tentado):", e));
  }, 700);
}

async function withSync(write: () => Promise<void>): Promise<void> {
  await write();
  pending.set(); // durabilidade: marcado já; o push é re-tentado no unlock/online
  schedulePush();
}

export const actions = {
  putAsset: (asset: Asset) => withSync(() => repository.putAsset(asset)),
  removeAsset: (id: string) => withSync(() => repository.removeAsset(id)),
  putLiability: (liability: Liability) => withSync(() => repository.putLiability(liability)),
  removeLiability: (id: string) => withSync(() => repository.removeLiability(id)),
  /** Salva a taxonomia editada no Config (alimenta os dropdowns). */
  putTaxonomy: (taxonomy: Taxonomy) => withSync(() => repository.putTaxonomy(taxonomy)),

  // Orçamento
  putExpense: (expense: Expense) => withSync(() => repository.putExpense(expense)),
  removeExpense: (id: string) => withSync(() => repository.removeExpense(id)),
  putIncome: (income: Income) => withSync(() => repository.putIncome(income)),
  removeIncome: (id: string) => withSync(() => repository.removeIncome(id)),

  // Histórico
  putSnapshot: (snapshot: NetWorthSnapshot) =>
    withSync(() => repository.putNetWorthSnapshot(snapshot)),
  removeSnapshot: (id: string) => withSync(() => repository.removeNetWorthSnapshot(id)),

  // Objetivos
  putGoal: (goal: Goal) => withSync(() => repository.putGoal(goal)),
  removeGoal: (id: string) => withSync(() => repository.removeGoal(id)),

  // Proventos / dividendos
  putDividend: (dividend: Dividend) => withSync(() => repository.putDividend(dividend)),
  removeDividend: (id: string) => withSync(() => repository.removeDividend(id)),

  // Configurações sincronizadas (singleton): SEMPRE merge sobre o estado mais fresco do
  // repositório — nunca reconstruído de um snapshot do React (que pode estar vazio/velho
  // durante o boot) — pra um campo nunca apagar o outro (baseCurrency × allocationTargets).
  putSettings: (patch: Partial<AppSettings>) =>
    withSync(async () => {
      const cur = await repository.getSettings();
      await repository.putSettings({ id: "settings", allocationTargets: {}, ...(cur ?? {}), ...patch });
    }),
  /** Define/limpa o alvo de alocação de UMA classe, lendo o mapa mais fresco (sem clobber). */
  setAllocationTarget: (classId: string, pct: number) =>
    withSync(async () => {
      const cur = await repository.getSettings();
      const allocationTargets = { ...(cur?.allocationTargets ?? {}) };
      if (pct > 0) allocationTargets[classId] = pct;
      else delete allocationTargets[classId];
      await repository.putSettings({ id: "settings", ...(cur ?? {}), allocationTargets });
    }),
  /** Traz os lançamentos FIXOS (recurring) pro mês-alvo, vindos do mês anterior mais recente que
   *  os tenha. Idempotente e dedupado: seguro pra chamar em todo render/efeito. Não escreve (nem
   *  dispara sync) se não houver nada a trazer. Quem chama garante "não reescrever o passado". */
  materializeRecurring: async (target: string): Promise<void> => {
    if (materializing.has(target)) return;
    materializing.add(target);
    try {
      const [expenses, incomes] = await Promise.all([
        repository.listExpenses(),
        repository.listIncomes(),
      ]);
      const plan = planRecurring(expenses, incomes, target, () => crypto.randomUUID());
      if (plan.expenses.length === 0 && plan.incomes.length === 0) return;
      await withSync(async () => {
        for (const e of plan.expenses) await repository.putExpense(e);
        for (const i of plan.incomes) await repository.putIncome(i);
      });
    } finally {
      materializing.delete(target);
    }
  },
  /** Copia os lançamentos AVULSOS (não-recorrentes) de um mês pro outro (novos ids).
   *  Os FIXOS são trazidos sozinhos por `materializeRecurring`, então copiá-los aqui
   *  também duplicaria a linha — por isso o filtro `!x.recurring`. Assim copiar e
   *  materializar nunca se sobrepõem, em qualquer ordem (sem corrida de inserção dupla). */
  copyBudgetMonth: (from: string, to: string) =>
    withSync(async () => {
      const [expenses, incomes] = await Promise.all([
        repository.listExpenses(),
        repository.listIncomes(),
      ]);
      for (const e of expenses.filter((x) => x.month === from && !x.recurring)) {
        await repository.putExpense({ ...e, id: crypto.randomUUID(), month: to, paid: false });
      }
      for (const i of incomes.filter((x) => x.month === from && !x.recurring)) {
        await repository.putIncome({ ...i, id: crypto.randomUUID(), month: to });
      }
    }),
  /** Carrega os dados de exemplo (opt-in pela Config): SUBSTITUI tudo por um exemplo
   *  coerente, ancorado na moeda principal atual (não mistura com o que já existe). */
  loadSample: () =>
    withSync(async () => {
      const base = useUI.getState().baseCurrency;
      const seed = buildSeed(base);
      await repository.clearAll();
      await repository.seed(seed);
      // clearAll zera as settings — preserva a moeda principal.
      await repository.putSettings({ id: "settings", allocationTargets: {}, baseCurrency: base });
    }),
  /** Apaga tudo — "começar do zero" (mantém a moeda principal como preferência). */
  resetAll: () =>
    withSync(async () => {
      const base = useUI.getState().baseCurrency;
      await repository.clearAll();
      await repository.putSettings({ id: "settings", allocationTargets: {}, baseCurrency: base });
    }),
};
