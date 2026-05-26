"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ChevronLeft, Sparkles, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from "@/components/goals/goal-icons";
import { runOnboarding, type OnboardingPayload } from "@/services/onboarding.actions";
import { cn } from "@/lib/utils/cn";
import type {
  CommonAssetsStrategy,
  DeclarationStrategy,
  FontePagadoraType,
  GoalType,
  IRDependentRelationship,
  MarriageRegime,
  Tables,
} from "@/types/database";

type Account = Tables<"accounts">;
type Category = Tables<"categories">;

/**
 * Wizard de 7 passos:
 *   0. Titular (CPF, nome, data nasc, ocupação) — essencial pro IR
 *   1. Cônjuge + regime de bens (condicional)
 *   2. Dependentes (CPF de cada, atribuição titular/cônjuge)
 *   3. Contas (bancos/corretoras)
 *   4. Fontes pagadoras (empresas que pagam você ou cônjuge)
 *   5. Renda recorrente (linkando fonte + IRRF/INSS mensal)
 *   6. Despesas fixas + Meta (combinados)
 *
 * Atomic submit no final via runOnboarding.
 */

const PRESET_ACCOUNTS: Array<{ name: string; institution: string; type: Account["type"] }> = [
  { name: "Conta Corrente", institution: "Itaú", type: "checking" },
  { name: "Conta Corrente", institution: "Nubank", type: "checking" },
  { name: "Conta Corrente", institution: "Bradesco", type: "checking" },
  { name: "Conta Corrente", institution: "Santander", type: "checking" },
  { name: "Conta Corrente", institution: "Banco do Brasil", type: "checking" },
  { name: "Conta Corrente", institution: "Inter", type: "checking" },
  { name: "Conta Corrente", institution: "C6 Bank", type: "checking" },
  { name: "Conta Corrente", institution: "Caixa", type: "checking" },
  { name: "Cartão de crédito", institution: "Nubank", type: "credit_card" },
  { name: "Cartão de crédito", institution: "Itaú", type: "credit_card" },
  { name: "Investimentos", institution: "XP", type: "investment" },
  { name: "Investimentos", institution: "BTG", type: "investment" },
  { name: "Investimentos", institution: "Rico", type: "investment" },
  { name: "Investimentos", institution: "Avenue", type: "investment" },
  { name: "Dinheiro vivo", institution: "Carteira", type: "cash" },
];

const PRESET_EXPENSES: Array<{
  description: string;
  amount: number;
  day: number;
  categoryHint: string;
}> = [
  { description: "Aluguel / Condomínio", amount: 0, day: 5, categoryHint: "moradia" },
  { description: "Internet", amount: 110, day: 10, categoryHint: "moradia" },
  { description: "Luz", amount: 180, day: 15, categoryHint: "moradia" },
  { description: "Plano de saúde", amount: 600, day: 5, categoryHint: "saude" },
  { description: "Mercado / Compras mensais", amount: 1200, day: 1, categoryHint: "mercado" },
  { description: "Celular", amount: 80, day: 10, categoryHint: "moradia" },
];

const REGIME_OPTIONS: { value: MarriageRegime; label: string }[] = [
  { value: "comunhao_parcial", label: "Comunhão parcial (default BR)" },
  { value: "comunhao_universal", label: "Comunhão universal" },
  { value: "separacao_total", label: "Separação total (pacto antenupcial)" },
  { value: "separacao_obrigatoria", label: "Separação obrigatória" },
];

const DEPENDENT_RELATIONSHIPS: { value: IRDependentRelationship; label: string }[] = [
  { value: "filho", label: "Filho" },
  { value: "filha", label: "Filha" },
  { value: "enteado", label: "Enteado(a)" },
  { value: "pais", label: "Pai/Mãe" },
  { value: "avos", label: "Avô/Avó" },
  { value: "irmaos", label: "Irmão/Irmã" },
  { value: "menor_guarda", label: "Menor sob guarda" },
  { value: "outros", label: "Outros" },
];

const FONTE_TYPES: { value: FontePagadoraType; label: string; hint: string }[] = [
  { value: "clt", label: "CLT", hint: "Empresa com carteira assinada" },
  { value: "pj_propria", label: "PJ própria", hint: "Sua empresa (MEI/LTDA)" },
  { value: "pj_outros", label: "Outra PJ", hint: "Cliente PJ que paga você" },
  { value: "aluguel", label: "Aluguel (PF)", hint: "Inquilino pessoa física" },
  { value: "pensao", label: "Pensão", hint: "Pensão alimentícia recebida" },
  { value: "aposentadoria", label: "Aposentadoria", hint: "INSS / previdência privada" },
  { value: "bolsa", label: "Bolsa", hint: "Pesquisa, professor" },
  { value: "outra", label: "Outra", hint: "Caso especial" },
];

type TitularState = {
  fullName: string;
  cpf: string;
  birthDate: string;
  occupation: string;
  occupationCode: string;
};

type SpouseState = {
  enabled: boolean;
  fullName: string;
  cpf: string;
  birthDate: string;
  occupation: string;
  occupationCode: string;
  marriageRegime: MarriageRegime;
  marriageDate: string;
  declarationStrategy: DeclarationStrategy;
  commonAssetsStrategy: CommonAssetsStrategy;
};

type DependentRow = {
  name: string;
  cpf: string;
  birthDate: string;
  relationship: IRDependentRelationship;
  belongsToSpouse: boolean;
};

type FonteRow = {
  type: FontePagadoraType;
  name: string;
  cnpj: string;
  cpf: string;
};

type IncomeRow = {
  description: string;
  amount: number;
  day: number;
  accountIdx: number;
  fonteIdx: number; // -1 = nenhuma
  irrfAmount: number;
  inssAmount: number;
};

type ExpenseRow = {
  description: string;
  amount: number;
  day: number;
  accountIdx: number;
  categoryHint: string;
};

type GoalState = {
  enabled: boolean;
  type: GoalType;
  name: string;
  targetAmount: number;
  currency: "BRL" | "EUR" | "USD";
  targetDate: string;
};

export function OnboardingWizard({
  existingAccounts,
  existingCategories,
  defaultName,
}: {
  existingAccounts: Account[];
  existingCategories: Category[];
  /** Pre-fill do nome do titular (vem de users.display_name) */
  defaultName?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const [titular, setTitular] = useState<TitularState>({
    fullName: defaultName ?? "",
    cpf: "",
    birthDate: "",
    occupation: "",
    occupationCode: "",
  });
  const [spouse, setSpouse] = useState<SpouseState>({
    enabled: false,
    fullName: "",
    cpf: "",
    birthDate: "",
    occupation: "",
    occupationCode: "",
    marriageRegime: "comunhao_parcial",
    marriageDate: "",
    declarationStrategy: "auto",
    commonAssetsStrategy: "split_50_50",
  });
  const [dependents, setDependents] = useState<DependentRow[]>([]);
  const [accountsToCreate, setAccountsToCreate] = useState<
    Array<{ name: string; institution: string; type: Account["type"]; initialBalance: number }>
  >([]);
  const [fontes, setFontes] = useState<FonteRow[]>([]);
  const [incomes, setIncomes] = useState<IncomeRow[]>([
    {
      description: "Salário",
      amount: 0,
      day: 5,
      accountIdx: 0,
      fonteIdx: -1,
      irrfAmount: 0,
      inssAmount: 0,
    },
  ]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [goal, setGoal] = useState<GoalState>({
    enabled: false,
    type: "emergencia",
    name: "Reserva de emergência",
    targetAmount: 0,
    currency: "BRL",
    targetDate: "",
  });

  const allAccountOptions = [
    ...existingAccounts.map((a) => ({
      name: a.name,
      institution: a.institution,
      type: a.type,
      isExisting: true as const,
      id: a.id,
    })),
    ...accountsToCreate.map((a, idx) => ({ ...a, isExisting: false as const, id: `new-${idx}` })),
  ];

  const handleFinish = () => {
    const payload: OnboardingPayload = {
      titular: titular.cpf && titular.fullName
        ? {
            fullName: titular.fullName.trim(),
            cpf: titular.cpf,
            birthDate: titular.birthDate || undefined,
            occupation: titular.occupation.trim() || undefined,
            occupationCode: titular.occupationCode.trim() || undefined,
          }
        : undefined,
      spouse: spouse.enabled && spouse.cpf && spouse.fullName
        ? {
            fullName: spouse.fullName.trim(),
            cpf: spouse.cpf,
            birthDate: spouse.birthDate || undefined,
            occupation: spouse.occupation.trim() || undefined,
            occupationCode: spouse.occupationCode.trim() || undefined,
            marriageRegime: spouse.marriageRegime,
            marriageDate: spouse.marriageDate || undefined,
            declarationStrategy: spouse.declarationStrategy,
            commonAssetsStrategy: spouse.commonAssetsStrategy,
          }
        : undefined,
      dependents: dependents
        .filter((d) => d.name.trim() && d.cpf)
        .map((d) => ({
          name: d.name.trim(),
          cpf: d.cpf,
          birthDate: d.birthDate || undefined,
          relationship: d.relationship,
          belongsToSpouse: d.belongsToSpouse,
        })),
      accounts: accountsToCreate,
      fontes: fontes
        .filter((f) => f.name.trim())
        .map((f) => ({
          type: f.type,
          name: f.name.trim(),
          cnpj: f.cnpj || undefined,
          cpf: f.cpf || undefined,
        })),
      incomes: incomes
        .filter((i) => i.amount > 0 && i.description.trim().length > 0)
        .map((i) => ({
          description: i.description.trim(),
          amount: i.amount,
          day: i.day,
          accountRef: refOfIdx(i.accountIdx, existingAccounts.length),
          fonteIdx: i.fonteIdx >= 0 ? i.fonteIdx : undefined,
          irrfAmount: i.irrfAmount > 0 ? i.irrfAmount : undefined,
          inssAmount: i.inssAmount > 0 ? i.inssAmount : undefined,
        })),
      expenses: expenses
        .filter((e) => e.amount > 0 && e.description.trim().length > 0)
        .map((e) => ({
          description: e.description.trim(),
          amount: e.amount,
          day: e.day,
          accountRef: refOfIdx(e.accountIdx, existingAccounts.length),
          categoryHint: e.categoryHint,
        })),
      goal: goal.enabled && goal.targetAmount > 0
        ? {
            type: goal.type,
            name: goal.name.trim(),
            targetAmount: goal.targetAmount,
            currency: goal.currency,
            targetDate: goal.targetDate || undefined,
          }
        : undefined,
    };

    startTransition(async () => {
      const r = await runOnboarding(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Tudo pronto. Bem-vindo ao seu painel.");
      router.push("/dashboard");
      router.refresh();
    });
  };

  const steps = [
    { label: "Você", done: step > 0 || (titular.cpf.length > 0 && titular.fullName.length > 0) },
    { label: "Cônjuge", done: step > 1 },
    { label: "Dependentes", done: step > 2 },
    { label: "Contas", done: step > 3 || existingAccounts.length + accountsToCreate.length > 0 },
    { label: "Fontes", done: step > 4 },
    { label: "Renda", done: step > 5 || incomes.some((i) => i.amount > 0) },
    { label: "Final", done: false },
  ];

  const lastStep = steps.length - 1;
  const canAdvance = step === 0 ? titular.cpf.length === 11 && titular.fullName.trim().length > 0 : true;

  return (
    <div>
      {/* Stepper visual */}
      <ol className="flex items-center gap-1.5 mb-7 flex-wrap">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "w-7 h-7 rounded-full grid place-items-center text-[12px] font-mono font-medium transition-colors",
                step === i
                  ? "bg-navy-700 text-white"
                  : s.done
                    ? "bg-olive-600 text-white"
                    : "bg-surface-muted text-faint-foreground hover:bg-bone-200 dark:hover:bg-ink-700",
              )}
              aria-label={`Passo ${i + 1}: ${s.label}`}
            >
              {s.done && step !== i ? <Check className="w-3.5 h-3.5" strokeWidth={2.2} /> : i + 1}
            </button>
            <span
              className={cn(
                "text-[12px]",
                step === i ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < lastStep ? <span className="text-faint-foreground mx-0.5">·</span> : null}
          </li>
        ))}
      </ol>

      {/* Conteúdo por step */}
      {step === 0 ? (
        <StepTitular titular={titular} setTitular={setTitular} />
      ) : step === 1 ? (
        <StepSpouse spouse={spouse} setSpouse={setSpouse} />
      ) : step === 2 ? (
        <StepDependents
          dependents={dependents}
          setDependents={setDependents}
          spouseEnabled={spouse.enabled}
          spouseName={spouse.fullName}
          titularName={titular.fullName}
        />
      ) : step === 3 ? (
        <StepAccounts
          existingAccounts={existingAccounts}
          accountsToCreate={accountsToCreate}
          setAccountsToCreate={setAccountsToCreate}
        />
      ) : step === 4 ? (
        <StepFontes fontes={fontes} setFontes={setFontes} />
      ) : step === 5 ? (
        <StepIncomes
          incomes={incomes}
          setIncomes={setIncomes}
          accounts={allAccountOptions}
          fontes={fontes}
        />
      ) : (
        <StepFinal
          expenses={expenses}
          setExpenses={setExpenses}
          accounts={allAccountOptions}
          existingCategories={existingCategories}
          goal={goal}
          setGoal={setGoal}
        />
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
          Voltar
        </Button>
        {step < lastStep ? (
          <Button
            variant="primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            title={!canAdvance ? "Preencha nome e CPF do titular" : undefined}
          >
            Próximo
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
          </Button>
        ) : (
          <Button variant="primary" onClick={handleFinish} disabled={pending}>
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
            {pending ? "Configurando…" : "Concluir e ir pro painel"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Referência ao slot do account no payload — "existing-<id>" ou "new-<idx>" */
function refOfIdx(idx: number, existingCount: number): string {
  if (idx < existingCount) return `existing-${idx}`;
  return `new-${idx - existingCount}`;
}

function fmtCPF(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/* ============================== STEP 0 — Titular =========================== */

function StepTitular({
  titular,
  setTitular,
}: {
  titular: TitularState;
  setTitular: React.Dispatch<React.SetStateAction<TitularState>>;
}) {
  const cpfDigits = titular.cpf.replace(/\D/g, "");
  const cpfValid = cpfDigits.length === 11;

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Quem é você?
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Dados básicos pra montar sua declaração de IR automaticamente ao longo do ano.
        Tudo fica privado — usado só na geração do .DEC e em relatórios pro contador (se você autorizar).
      </p>

      <div className="space-y-4">
        <Field label="Nome completo" htmlFor="onb-titular-name" required>
          <Input
            id="onb-titular-name"
            value={titular.fullName}
            onChange={(e) => setTitular({ ...titular, fullName: e.target.value })}
            placeholder="João da Silva"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF" htmlFor="onb-titular-cpf" required>
            <Input
              id="onb-titular-cpf"
              value={fmtCPF(titular.cpf)}
              onChange={(e) =>
                setTitular({ ...titular, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })
              }
              placeholder="000.000.000-00"
              className={cn("font-mono", cpfDigits.length > 0 && !cpfValid && "border-rust-400")}
              maxLength={14}
            />
            {cpfDigits.length > 0 && !cpfValid ? (
              <p className="text-[11px] text-rust-600 mt-1">CPF precisa ter 11 dígitos.</p>
            ) : null}
          </Field>
          <Field label="Data de nascimento" htmlFor="onb-titular-birth">
            <Input
              id="onb-titular-birth"
              type="date"
              value={titular.birthDate}
              onChange={(e) => setTitular({ ...titular, birthDate: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Ocupação principal" htmlFor="onb-titular-occ" hint="Ex.: Engenheiro de software">
            <Input
              id="onb-titular-occ"
              value={titular.occupation}
              onChange={(e) => setTitular({ ...titular, occupation: e.target.value })}
            />
          </Field>
          <Field label="Código Receita" htmlFor="onb-titular-occcode" hint="4 dígitos">
            <Input
              id="onb-titular-occcode"
              value={titular.occupationCode}
              onChange={(e) =>
                setTitular({ ...titular, occupationCode: e.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              placeholder="0405"
              className="font-mono"
              maxLength={4}
            />
          </Field>
        </div>

        <p className="text-[11.5px] text-faint-foreground">
          Não sabe o código de ocupação? Você pode preencher depois em <code>/ir/configuracoes</code> — não é bloqueante.
        </p>
      </div>
    </div>
  );
}

/* ============================== STEP 1 — Cônjuge =========================== */

function StepSpouse({
  spouse,
  setSpouse,
}: {
  spouse: SpouseState;
  setSpouse: React.Dispatch<React.SetStateAction<SpouseState>>;
}) {
  const showMarriageDate = spouse.marriageRegime === "comunhao_parcial" || spouse.marriageRegime === "comunhao_universal";

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Você é casado ou em união estável?
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Se sim, o app pode preparar 2 declarações (uma sua, uma do(a) cônjuge) e
        recomendar qual paga menos. Bens são divididos automaticamente conforme o regime.
      </p>

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setSpouse({ ...spouse, enabled: false })}
          className={cn(
            "flex-1 rounded-[10px] border px-4 py-3 text-left transition-colors",
            !spouse.enabled
              ? "border-navy-700 bg-navy-50 dark:bg-navy-900/30"
              : "border-border hover:bg-surface-muted",
          )}
        >
          <div className="font-medium text-[14px] text-foreground">Solteiro / Não declarar</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            Eu declaro sozinho. Sem cônjuge ou regime.
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSpouse({ ...spouse, enabled: true })}
          className={cn(
            "flex-1 rounded-[10px] border px-4 py-3 text-left transition-colors",
            spouse.enabled
              ? "border-navy-700 bg-navy-50 dark:bg-navy-900/30"
              : "border-border hover:bg-surface-muted",
          )}
        >
          <div className="font-medium text-[14px] text-foreground">Sim, tenho cônjuge</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            Preciso preparar declaração do casal (junta ou separada).
          </div>
        </button>
      </div>

      {spouse.enabled ? (
        <div className="space-y-4 rounded-[10px] border border-border bg-surface-muted/40 p-4">
          <Field label="Nome completo do(a) cônjuge" htmlFor="onb-spouse-name" required>
            <Input
              id="onb-spouse-name"
              value={spouse.fullName}
              onChange={(e) => setSpouse({ ...spouse, fullName: e.target.value })}
              placeholder="Maria da Silva"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF" htmlFor="onb-spouse-cpf" required>
              <Input
                id="onb-spouse-cpf"
                value={fmtCPF(spouse.cpf)}
                onChange={(e) =>
                  setSpouse({ ...spouse, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })
                }
                placeholder="000.000.000-00"
                className="font-mono"
                maxLength={14}
              />
            </Field>
            <Field label="Data de nascimento" htmlFor="onb-spouse-birth">
              <Input
                id="onb-spouse-birth"
                type="date"
                value={spouse.birthDate}
                onChange={(e) => setSpouse({ ...spouse, birthDate: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field label="Ocupação" htmlFor="onb-spouse-occ">
              <Input
                id="onb-spouse-occ"
                value={spouse.occupation}
                onChange={(e) => setSpouse({ ...spouse, occupation: e.target.value })}
              />
            </Field>
            <Field label="Código Receita" htmlFor="onb-spouse-occcode">
              <Input
                id="onb-spouse-occcode"
                value={spouse.occupationCode}
                onChange={(e) =>
                  setSpouse({
                    ...spouse,
                    occupationCode: e.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
                className="font-mono"
                maxLength={4}
              />
            </Field>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
              Regime de bens
            </div>

            <Field label="Regime" htmlFor="onb-spouse-regime" required>
              <Select
                value={spouse.marriageRegime}
                onValueChange={(v) =>
                  setSpouse({ ...spouse, marriageRegime: v as MarriageRegime })
                }
              >
                <SelectTrigger id="onb-spouse-regime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIME_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {showMarriageDate ? (
              <Field
                label="Data do casamento"
                htmlFor="onb-spouse-mdate"
                required={spouse.marriageRegime === "comunhao_parcial"}
                hint="Bens adquiridos antes desta data ficam particulares de cada um"
              >
                <Input
                  id="onb-spouse-mdate"
                  type="date"
                  value={spouse.marriageDate}
                  onChange={(e) => setSpouse({ ...spouse, marriageDate: e.target.value })}
                />
              </Field>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================== STEP 2 — Dependentes ====================== */

function StepDependents({
  dependents,
  setDependents,
  spouseEnabled,
  spouseName,
  titularName,
}: {
  dependents: DependentRow[];
  setDependents: React.Dispatch<React.SetStateAction<DependentRow[]>>;
  spouseEnabled: boolean;
  spouseName: string;
  titularName: string;
}) {
  const addRow = () => {
    setDependents((arr) => [
      ...arr,
      { name: "", cpf: "", birthDate: "", relationship: "filho", belongsToSpouse: false },
    ]);
  };
  const updateAt = (i: number, patch: Partial<DependentRow>) => {
    setDependents((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  const removeAt = (i: number) => {
    setDependents((arr) => arr.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Dependentes?
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Filhos, enteados, pais idosos. Cada dependente vale R$ 2.275,08 de dedução
        no modelo completo. <b>CPF é obrigatório desde 2019</b> — sem ele a declaração é rejeitada.
        Pode deixar vazio se não tiver.
      </p>

      {dependents.length === 0 ? (
        <p className="text-[12.5px] text-faint-foreground italic mb-3">
          Nenhum dependente. Clique abaixo pra adicionar.
        </p>
      ) : (
        <ul className="space-y-2 mb-3">
          {dependents.map((d, i) => (
            <li key={i} className="rounded-[8px] border border-border bg-surface p-3 space-y-3">
              <div className="grid grid-cols-[2fr_1.2fr_auto] gap-2">
                <Input
                  placeholder="Nome completo"
                  value={d.name}
                  onChange={(e) => updateAt(i, { name: e.target.value })}
                />
                <Input
                  placeholder="000.000.000-00"
                  value={fmtCPF(d.cpf)}
                  onChange={(e) =>
                    updateAt(i, { cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })
                  }
                  className="font-mono"
                  maxLength={14}
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-faint-foreground hover:text-rust-600 p-1.5"
                  aria-label="Remover"
                >
                  <X className="w-4 h-4" strokeWidth={1.7} />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_1.2fr_1.5fr] gap-2">
                <Input
                  type="date"
                  value={d.birthDate}
                  onChange={(e) => updateAt(i, { birthDate: e.target.value })}
                  title="Data de nascimento"
                />
                <Select
                  value={d.relationship}
                  onValueChange={(v) =>
                    updateAt(i, { relationship: v as IRDependentRelationship })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPENDENT_RELATIONSHIPS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {spouseEnabled ? (
                  <Select
                    value={d.belongsToSpouse ? "spouse" : "titular"}
                    onValueChange={(v) => updateAt(i, { belongsToSpouse: v === "spouse" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="titular">
                        Entra na declaração: {titularName || "você"}
                      </SelectItem>
                      <SelectItem value="spouse">
                        Entra na declaração: {spouseName || "cônjuge"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-[11.5px] text-faint-foreground self-center pl-2">
                    Entra na sua declaração
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button size="sm" variant="ghost" onClick={addRow}>
        <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} />
        Adicionar dependente
      </Button>
    </div>
  );
}

/* ============================== STEP 3 — Contas ========================== */

function StepAccounts({
  existingAccounts,
  accountsToCreate,
  setAccountsToCreate,
}: {
  existingAccounts: Account[];
  accountsToCreate: Array<{
    name: string;
    institution: string;
    type: Account["type"];
    initialBalance: number;
  }>;
  setAccountsToCreate: React.Dispatch<
    React.SetStateAction<
      Array<{
        name: string;
        institution: string;
        type: Account["type"];
        initialBalance: number;
      }>
    >
  >;
}) {
  const addFromPreset = (p: (typeof PRESET_ACCOUNTS)[number]) => {
    setAccountsToCreate((arr) => [...arr, { ...p, initialBalance: 0 }]);
  };
  const addCustom = () => {
    setAccountsToCreate((arr) => [
      ...arr,
      { name: "", institution: "", type: "checking", initialBalance: 0 },
    ]);
  };
  const removeAt = (i: number) => {
    setAccountsToCreate((arr) => arr.filter((_, idx) => idx !== i));
  };
  const updateAt = (i: number, patch: Partial<(typeof accountsToCreate)[number]>) => {
    setAccountsToCreate((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Quais contas você usa?
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-3 leading-relaxed">
        Conta corrente, cartão, corretora — todos os endereços onde seu dinheiro mora.
        Pode adicionar mais depois em <code>/contas</code>.
      </p>
      <div className="mb-5 rounded-[8px] border border-navy-700/30 bg-navy-100/40 dark:bg-navy-700/15 px-3.5 py-2.5">
        <p className="text-[12px] leading-relaxed text-navy-900 dark:text-navy-200">
          <b>Saldo inicial = saldo de hoje.</b> Coloca o valor que aparece no app da
          sua corretora/banco <em>agora</em>. Não precisa reconstituir histórico — o
          app marca hoje como <em>marco zero</em>. Receitas e despesas que você cadastrar
          a partir daqui afetam o saldo daqui pra frente.
        </p>
      </div>

      {existingAccounts.length > 0 ? (
        <div className="mb-5 rounded-[8px] bg-surface-muted px-4 py-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-2">
            Já cadastradas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {existingAccounts.map((a) => (
              <Badge key={a.id} tone="navy">
                {a.name} · {a.institution}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-2">
          Adição rápida — clique nos seus bancos
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_ACCOUNTS.map((p) => (
            <button
              key={`${p.name}-${p.institution}`}
              type="button"
              onClick={() => addFromPreset(p)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[7px] border border-border-strong bg-surface text-[12px] text-foreground hover:bg-surface-muted transition-colors"
            >
              + {p.institution}
              <span className="text-faint-foreground text-[10.5px]">
                · {labelForType(p.type)}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2">
          <Button size="sm" variant="ghost" onClick={addCustom}>
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} /> outra conta
          </Button>
        </div>
      </div>

      {accountsToCreate.length > 0 ? (
        <ul className="space-y-2">
          {accountsToCreate.map((a, i) => (
            <li
              key={i}
              className="rounded-[8px] border border-border bg-surface p-3 grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 items-center"
            >
              <Input
                placeholder="Apelido"
                value={a.name}
                onChange={(e) => updateAt(i, { name: e.target.value })}
              />
              <Input
                placeholder="Instituição"
                value={a.institution}
                onChange={(e) => updateAt(i, { institution: e.target.value })}
              />
              <Select
                value={a.type}
                onValueChange={(v) => updateAt(i, { type: v as Account["type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="credit_card">Cartão</SelectItem>
                  <SelectItem value="investment">Corretora</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
              <MoneyInput
                name={`acc-bal-${i}`}
                defaultValue={a.initialBalance}
                onValueChange={(v) => updateAt(i, { initialBalance: v })}
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-faint-foreground hover:text-rust-600"
                aria-label="Remover"
              >
                <X className="w-4 h-4" strokeWidth={1.7} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ============================== STEP 4 — Fontes Pagadoras ================ */

function StepFontes({
  fontes,
  setFontes,
}: {
  fontes: FonteRow[];
  setFontes: React.Dispatch<React.SetStateAction<FonteRow[]>>;
}) {
  const addRow = (type: FontePagadoraType = "clt") => {
    setFontes((arr) => [...arr, { type, name: "", cnpj: "", cpf: "" }]);
  };
  const updateAt = (i: number, patch: Partial<FonteRow>) => {
    setFontes((arr) => arr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const removeAt = (i: number) => {
    setFontes((arr) => arr.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Onde sua renda vem?
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Empresas onde você (ou cônjuge) trabalha, inquilinos que pagam aluguel, sua PJ própria.
        Cadastrando aqui, no IR a Receita já vê "Empresa X CNPJ Y" com IRRF/INSS corretos.
        Pode adicionar mais depois em <code>/ir/configuracoes</code>.
      </p>

      {fontes.length === 0 ? (
        <div className="rounded-[8px] bg-surface-muted/50 border border-dashed border-border-strong p-5 mb-4 text-center">
          <p className="text-[12.5px] text-muted-foreground mb-3">
            Nenhuma fonte cadastrada. Pode pular ou adicionar agora.
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {FONTE_TYPES.slice(0, 3).map((t) => (
              <Button key={t.value} size="sm" variant="ghost" onClick={() => addRow(t.value)}>
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} />
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-2 mb-3">
          {fontes.map((f, i) => (
            <li key={i} className="rounded-[8px] border border-border bg-surface p-3 space-y-2">
              <div className="grid grid-cols-[1.2fr_2fr_auto] gap-2">
                <Select
                  value={f.type}
                  onValueChange={(v) => updateAt(i, { type: v as FontePagadoraType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nome (Empresa X, João da Silva…)"
                  value={f.name}
                  onChange={(e) => updateAt(i, { name: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-faint-foreground hover:text-rust-600 p-1.5"
                  aria-label="Remover"
                >
                  <X className="w-4 h-4" strokeWidth={1.7} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="CNPJ (se PJ)"
                  value={fmtCNPJ(f.cnpj)}
                  onChange={(e) =>
                    updateAt(i, { cnpj: e.target.value.replace(/\D/g, "").slice(0, 14) })
                  }
                  className="font-mono"
                  maxLength={18}
                />
                <Input
                  placeholder="CPF (se PF)"
                  value={fmtCPF(f.cpf)}
                  onChange={(e) =>
                    updateAt(i, { cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })
                  }
                  className="font-mono"
                  maxLength={14}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {fontes.length > 0 ? (
        <Button size="sm" variant="ghost" onClick={() => addRow()}>
          <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} />
          outra fonte
        </Button>
      ) : null}
    </div>
  );
}

/* ============================== STEP 5 — Renda =========================== */

function StepIncomes({
  incomes,
  setIncomes,
  accounts,
  fontes,
}: {
  incomes: IncomeRow[];
  setIncomes: React.Dispatch<React.SetStateAction<IncomeRow[]>>;
  accounts: Array<{ name: string; institution: string; type: Account["type"]; id: string }>;
  fontes: FonteRow[];
}) {
  const addRow = () => {
    setIncomes((arr) => [
      ...arr,
      {
        description: "Outra renda",
        amount: 0,
        day: 5,
        accountIdx: 0,
        fonteIdx: -1,
        irrfAmount: 0,
        inssAmount: 0,
      },
    ]);
  };
  const removeAt = (i: number) => {
    setIncomes((arr) => arr.filter((_, idx) => idx !== i));
  };
  const updateAt = (i: number, patch: Partial<IncomeRow>) => {
    setIncomes((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  if (accounts.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic">
        Adicione pelo menos uma conta no passo de Contas pra cadastrar rendas.
      </p>
    );
  }

  return (
    <div>
      <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
        Sua renda mensal
      </h2>
      <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
        Salário, freelance, aluguel recebido. Liga à fonte pagadora pro IR ficar
        agrupado corretamente. IRRF/INSS é o valor que cai no contracheque (médio).
      </p>

      <ul className="space-y-3">
        {incomes.map((i, idx) => (
          <li key={idx} className="rounded-[8px] border border-border bg-surface p-3 space-y-2">
            <div className="grid grid-cols-[1.5fr_1fr_70px_1.5fr_auto] gap-2 items-center">
              <Input
                placeholder="Salário CLT"
                value={i.description}
                onChange={(e) => updateAt(idx, { description: e.target.value })}
              />
              <MoneyInput
                name={`income-${idx}`}
                defaultValue={i.amount}
                onValueChange={(v) => updateAt(idx, { amount: v })}
              />
              <Input
                type="number"
                min={1}
                max={31}
                value={i.day}
                onChange={(e) =>
                  updateAt(idx, { day: Math.max(1, Math.min(31, Number(e.target.value))) })
                }
                title="Dia do mês"
              />
              <Select
                value={String(i.accountIdx)}
                onValueChange={(v) => updateAt(idx, { accountIdx: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a, ai) => (
                    <SelectItem key={a.id} value={String(ai)}>
                      {a.name} · {a.institution}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="text-faint-foreground hover:text-rust-600"
                aria-label="Remover"
              >
                <X className="w-4 h-4" strokeWidth={1.7} />
              </button>
            </div>
            {fontes.length > 0 ? (
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 items-center pl-1">
                <Select
                  value={String(i.fonteIdx)}
                  onValueChange={(v) => updateAt(idx, { fonteIdx: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fonte pagadora (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">— sem fonte específica</SelectItem>
                    {fontes.map((f, fi) => (
                      <SelectItem key={fi} value={String(fi)}>
                        {f.name || "(sem nome)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MoneyInput
                  name={`income-irrf-${idx}`}
                  defaultValue={i.irrfAmount}
                  onValueChange={(v) => updateAt(idx, { irrfAmount: v })}
                  placeholder="IRRF mensal"
                />
                <MoneyInput
                  name={`income-inss-${idx}`}
                  defaultValue={i.inssAmount}
                  onValueChange={(v) => updateAt(idx, { inssAmount: v })}
                  placeholder="INSS mensal"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" onClick={addRow} className="mt-3">
        <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} /> outra renda
      </Button>
    </div>
  );
}

/* ============================== STEP 6 — Final (Despesas + Meta) ========= */

function StepFinal({
  expenses,
  setExpenses,
  accounts,
  existingCategories,
  goal,
  setGoal,
}: {
  expenses: ExpenseRow[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseRow[]>>;
  accounts: Array<{ name: string; institution: string; type: Account["type"]; id: string }>;
  existingCategories: Category[];
  goal: GoalState;
  setGoal: React.Dispatch<React.SetStateAction<GoalState>>;
}) {
  void existingCategories;
  const GOAL_TYPES_ORDER: GoalType[] = [
    "emergencia",
    "casa",
    "veiculo",
    "viagem",
    "aposentadoria",
    "educacao",
    "projeto",
    "outro",
  ];

  const addPreset = (p: (typeof PRESET_EXPENSES)[number]) => {
    setExpenses((arr) => [...arr, { ...p, accountIdx: 0 }]);
  };
  const addCustom = () => {
    setExpenses((arr) => [
      ...arr,
      { description: "", amount: 0, day: 5, accountIdx: 0, categoryHint: "" },
    ]);
  };
  const removeAt = (i: number) => {
    setExpenses((arr) => arr.filter((_, idx) => idx !== i));
  };
  const updateAt = (i: number, patch: Partial<ExpenseRow>) => {
    setExpenses((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  return (
    <div className="space-y-7">
      <div className="rounded-[8px] border border-gold-600/40 bg-gold-100/30 dark:bg-gold-700/10 px-4 py-3.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gold-700 dark:text-gold-200 font-medium mb-1.5">
          Próximo passo · IR retroativo
        </div>
        <p className="text-[12.5px] leading-relaxed">
          Depois de concluir, vai em <code>/ir/{new Date().getFullYear()}</code>. Se você cadastrou
          recorrências de salário/despesa que <em>começam em meses anteriores</em>, o app
          detecta as lacunas e mostra um botão <b>&quot;Preencher tudo&quot;</b> que cadastra
          os meses passados como <b>históricos pra IR</b> (sem mexer no saldo das contas).
          Assim sua declaração de fev/{new Date().getFullYear() + 1} fica pronta sem reconstituir histórico operacional.
        </p>
      </div>
      <div>
        <h2 className="font-display text-[20px] tracking-[-0.015em] font-medium mb-2">
          Despesas fixas + meta
        </h2>
        <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
          Aluguel, internet, plano de saúde — coisas que repetem todo mês. E uma meta
          inicial opcional. Tudo editável depois.
        </p>
      </div>

      <div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mb-2">
          Despesas — sugestões rápidas
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_EXPENSES.map((p) => (
            <button
              key={p.description}
              type="button"
              onClick={() => addPreset(p)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[7px] border border-border-strong bg-surface text-[12px] text-foreground hover:bg-surface-muted transition-colors"
            >
              + {p.description}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={addCustom}>
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} /> outra
          </Button>
        </div>

        {expenses.length > 0 ? (
          <ul className="space-y-2">
            {expenses.map((e, idx) => (
              <li
                key={idx}
                className="rounded-[8px] border border-border bg-surface p-3 grid grid-cols-[1.5fr_1fr_70px_1.5fr_auto] gap-2 items-center"
              >
                <Input
                  placeholder="Descrição"
                  value={e.description}
                  onChange={(ev) => updateAt(idx, { description: ev.target.value })}
                />
                <MoneyInput
                  name={`exp-${idx}`}
                  defaultValue={e.amount}
                  onValueChange={(v) => updateAt(idx, { amount: v })}
                />
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={e.day}
                  onChange={(ev) =>
                    updateAt(idx, { day: Math.max(1, Math.min(31, Number(ev.target.value))) })
                  }
                  title="Dia do mês"
                />
                <Select
                  value={String(e.accountIdx)}
                  onValueChange={(v) => updateAt(idx, { accountIdx: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a, ai) => (
                      <SelectItem key={a.id} value={String(ai)}>
                        {a.name} · {a.institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="text-faint-foreground hover:text-rust-600"
                  aria-label="Remover"
                >
                  <X className="w-4 h-4" strokeWidth={1.7} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="border-t border-border pt-5">
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={goal.enabled}
            onChange={(e) => setGoal({ ...goal, enabled: e.target.checked })}
            className="accent-navy-700"
          />
          <span className="text-[13px] text-foreground font-medium">
            Definir uma meta inicial (opcional)
          </span>
        </label>

        {goal.enabled ? (
          <div className="space-y-3 rounded-[10px] border border-border bg-surface-muted/40 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo" htmlFor="onb-goal-type">
                <Select
                  value={goal.type}
                  onValueChange={(v) => setGoal({ ...goal, type: v as GoalType })}
                >
                  <SelectTrigger id="onb-goal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {GOAL_TYPE_ICONS[t]} {GOAL_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nome" htmlFor="onb-goal-name" required>
                <Input
                  id="onb-goal-name"
                  value={goal.name}
                  onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_100px_1fr] gap-3">
              <Field label="Valor" htmlFor="onb-goal-target" required>
                <MoneyInput
                  name="onb-goal-target"
                  currency={goal.currency}
                  defaultValue={goal.targetAmount}
                  onValueChange={(v) => setGoal({ ...goal, targetAmount: v })}
                />
              </Field>
              <Field label="Moeda" htmlFor="onb-goal-currency">
                <Select
                  value={goal.currency}
                  onValueChange={(v) => setGoal({ ...goal, currency: v as "BRL" | "EUR" | "USD" })}
                >
                  <SelectTrigger id="onb-goal-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">R$ BRL</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                    <SelectItem value="USD">US$ USD</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data alvo" htmlFor="onb-goal-date" hint="Opcional">
                <Input
                  id="onb-goal-date"
                  type="date"
                  value={goal.targetDate}
                  onChange={(e) => setGoal({ ...goal, targetDate: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function labelForType(t: Account["type"]): string {
  if (t === "checking") return "corrente";
  if (t === "savings") return "poupança";
  if (t === "credit_card") return "cartão";
  if (t === "investment") return "corretora";
  return "dinheiro";
}
