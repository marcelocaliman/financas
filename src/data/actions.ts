import { repository, isRepositoryReadOnly } from "@/data/dexie-repository";
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
  HealthConfig,
  Income,
  Liability,
  LiberdadeConfig,
  NetWorthSnapshot,
  Subscription,
} from "@/domain/types";
import type { Taxonomy } from "@/domain/taxonomy";
import { planRecurring, effectiveRecurringIds } from "@/domain/recurring";

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
  if (isRepositoryReadOnly()) return; // modo visitante: nenhuma escrita/sync (inerte)
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
  /** Insere vários gastos de uma vez (import CSV da fatura) — UMA transação, UM push de sync. */
  importExpenses: (expenses: Expense[]) =>
    withSync(async () => {
      for (const e of expenses) await repository.putExpense(e);
    }),
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

  // Assinaturas recorrentes (documentação)
  putSubscription: (subscription: Subscription) => withSync(() => repository.putSubscription(subscription)),
  removeSubscription: (id: string) => withSync(() => repository.removeSubscription(id)),

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
  /** Mescla campos da config da Liberdade sobre o estado mais fresco (sem apagar os demais). */
  setLiberdade: (patch: Partial<LiberdadeConfig>) =>
    withSync(async () => {
      const cur = await repository.getSettings();
      const liberdade = { ...(cur?.liberdade ?? {}), ...patch };
      await repository.putSettings({ id: "settings", allocationTargets: {}, ...(cur ?? {}), liberdade });
    }),
  /** Liga/desliga UMA classe na elegibilidade da Liberdade, lendo o mapa mais fresco (sem clobber). */
  setEligibleClass: (classId: string, eligible: boolean) =>
    withSync(async () => {
      const cur = await repository.getSettings();
      const liberdade = { ...(cur?.liberdade ?? {}) };
      liberdade.eligibleClasses = { ...(liberdade.eligibleClasses ?? {}), [classId]: eligible };
      await repository.putSettings({ id: "settings", allocationTargets: {}, ...(cur ?? {}), liberdade });
    }),
  /** Mescla campos da config de Saúde (pesos/limiares) sobre o estado mais fresco (sem clobber). */
  setHealth: (patch: Partial<HealthConfig>) =>
    withSync(async () => {
      const cur = await repository.getSettings();
      const health = { ...(cur?.health ?? {}), ...patch };
      await repository.putSettings({ id: "settings", allocationTargets: {}, ...(cur ?? {}), health });
    }),
  /** Define o peso de UMA dimensão de Saúde, lendo o mapa mais fresco (sem clobber). */
  setHealthWeight: (dim: string, weight: number) =>
    withSync(async () => {
      const cur = await repository.getSettings();
      const health = { ...(cur?.health ?? {}) };
      health.weights = { ...(health.weights ?? {}), [dim]: weight };
      await repository.putSettings({ id: "settings", allocationTargets: {}, ...(cur ?? {}), health });
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
      // Copia os AVULSOS (efetivo): a recorrência de um filho segue o PAI, então a fatura vem numa
      // passada só com os seus itens (nunca sobra filho órfão sobre a fatura → sem dupla contagem).
      // Remapeia o vínculo de fatura (parentId) pros ids do novo mês.
      const fromExp = expenses.filter((x) => x.month === from);
      const eff = effectiveRecurringIds(fromExp);
      const srcExp = fromExp.filter((x) => !eff.has(x.id));
      const idMap = new Map<string, string>();
      for (const e of srcExp) idMap.set(e.id, crypto.randomUUID());
      for (const e of srcExp) {
        await repository.putExpense({ ...e, id: idMap.get(e.id)!, month: to, paid: false, parentId: e.parentId ? idMap.get(e.parentId) : undefined });
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
      // clearAll zera as settings — reaplica as do exemplo (alocação/Liberdade/Saúde) e
      // PRESERVA a moeda principal (injetada aqui, não vem no seed).
      await repository.putSettings({
        id: "settings",
        allocationTargets: seed.settings?.allocationTargets ?? {},
        baseCurrency: base,
        liberdade: seed.settings?.liberdade,
        health: seed.settings?.health,
      });
    }),
  /** Apaga tudo — "começar do zero" (mantém a moeda principal como preferência). */
  resetAll: () =>
    withSync(async () => {
      const base = useUI.getState().baseCurrency;
      await repository.clearAll();
      await repository.putSettings({ id: "settings", allocationTargets: {}, baseCurrency: base });
    }),
};
