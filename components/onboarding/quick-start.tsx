"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Sparkles, PencilLine, Upload, ScanLine, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { runOnboarding, skipOnboarding } from "@/services/onboarding.actions";
import { cn } from "@/lib/utils/cn";
import type { Tables } from "@/types/database";

type Account = Tables<"accounts">;
type AccountToCreate = {
  name: string;
  institution: string;
  type: Account["type"];
  initialBalance: number;
  billCloseDay?: number;
  billDueDay?: number;
  creditLimit?: number;
};

const PRESET_ACCOUNTS: Array<{ name: string; institution: string; type: Account["type"] }> = [
  { name: "Conta Corrente", institution: "Nubank", type: "checking" },
  { name: "Conta Corrente", institution: "Itaú", type: "checking" },
  { name: "Conta Corrente", institution: "Inter", type: "checking" },
  { name: "Conta Corrente", institution: "Bradesco", type: "checking" },
  { name: "Conta Corrente", institution: "Banco do Brasil", type: "checking" },
  { name: "Conta Corrente", institution: "C6 Bank", type: "checking" },
  { name: "Cartão de crédito", institution: "Nubank", type: "credit_card" },
  { name: "Cartão de crédito", institution: "Itaú", type: "credit_card" },
  { name: "Investimentos", institution: "XP", type: "investment" },
  { name: "Investimentos", institution: "Avenue", type: "investment" },
  { name: "Dinheiro vivo", institution: "Carteira", type: "cash" },
];

function labelForType(t: Account["type"]): string {
  if (t === "checking") return "corrente";
  if (t === "savings") return "poupança";
  if (t === "credit_card") return "cartão";
  if (t === "investment") return "corretora";
  return "dinheiro";
}

/**
 * Onboarding "valor primeiro": cadastra as contas → cai no painel e VÊ o IR se
 * montar. O setup fiscal pesado (CPF, dependentes, fontes) fica pra depois,
 * convidado pelo SetupBanner do dashboard. Pra quem quer o setup completo de
 * cara, /welcome?full=1 abre o wizard detalhado.
 */
export function QuickStart({ existingAccounts }: { existingAccounts: Account[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<AccountToCreate[]>([]);
  const [pending, startTransition] = useTransition();

  const totalAccounts = existingAccounts.length + accounts.length;

  const addPreset = (p: (typeof PRESET_ACCOUNTS)[number]) =>
    setAccounts((arr) => [...arr, { ...p, initialBalance: 0 }]);
  const addCustom = () =>
    setAccounts((arr) => [...arr, { name: "", institution: "", type: "checking", initialBalance: 0 }]);
  const removeAt = (i: number) => setAccounts((arr) => arr.filter((_, idx) => idx !== i));
  const updateAt = (i: number, patch: Partial<AccountToCreate>) =>
    setAccounts((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const finish = () => {
    startTransition(async () => {
      const r =
        accounts.length > 0
          ? await runOnboarding({ accounts, incomes: [], expenses: [] })
          : await skipOnboarding();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div>
      {/* Passos */}
      <div className="flex items-center gap-2 mb-6">
        {["Suas contas", "Pronto"].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={cn(
              "flex items-center gap-1.5 text-[12.5px]",
              i === step ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "w-5 h-5 rounded-full grid place-items-center text-[11px] font-mono",
                i <= step ? "bg-ink-950 text-white dark:bg-bone-100 dark:text-ink-950" : "bg-surface-muted text-faint-foreground",
              )}
            >
              {i + 1}
            </span>
            {label}
            {i === 0 ? <ArrowRight className="w-3 h-3 text-faint-foreground ml-1" strokeWidth={1.7} /> : null}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <div>
          <h2 className="font-display text-[22px] tracking-[-0.015em] font-medium mb-2">
            Onde está seu dinheiro?
          </h2>
          <p className="text-[13.5px] text-muted-foreground mb-4 leading-relaxed">
            Cadastre suas contas — corrente, cartão, corretora. É só onde o dinheiro
            mora; tudo é manual e fica dentro do app. Pode adicionar/editar depois em{" "}
            <code className="font-mono text-[12px]">/contas</code>.
          </p>

          <div className="mb-5 rounded-[8px] border border-navy-700/30 bg-navy-100/40 dark:bg-navy-700/15 px-3.5 py-2.5">
            <p className="text-[12px] leading-relaxed text-navy-900 dark:text-navy-200">
              <b>Saldo inicial = saldo de hoje.</b> Coloque o valor que aparece no app do
              seu banco/corretora <em>agora</em>. O app marca hoje como marco zero — você
              não precisa reconstituir histórico.
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
                  onClick={() => addPreset(p)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[7px] border border-border-strong bg-surface text-[12px] text-foreground hover:bg-surface-muted transition-colors"
                >
                  + {p.institution}
                  <span className="text-faint-foreground text-[10.5px]">· {labelForType(p.type)}</span>
                </button>
              ))}
            </div>
            <div className="mt-2">
              <Button size="sm" variant="ghost" onClick={addCustom}>
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.8} /> outra conta
              </Button>
            </div>
          </div>

          {accounts.length > 0 ? (
            <ul className="space-y-2 mb-2">
              {accounts.map((a, i) => (
                <li key={i} className="rounded-[8px] border border-border bg-surface p-3 space-y-2">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    <Input placeholder="Apelido" value={a.name} onChange={(e) => updateAt(i, { name: e.target.value })} />
                    <Input placeholder="Instituição" value={a.institution} onChange={(e) => updateAt(i, { institution: e.target.value })} />
                    <Select value={a.type} onValueChange={(v) => updateAt(i, { type: v as Account["type"] })}>
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
                    <MoneyInput name={`acc-bal-${i}`} defaultValue={a.initialBalance} onValueChange={(v) => updateAt(i, { initialBalance: v })} />
                    <button type="button" onClick={() => removeAt(i)} className="text-faint-foreground hover:text-rust-600" aria-label="Remover">
                      <X className="w-4 h-4" strokeWidth={1.7} />
                    </button>
                  </div>
                  {a.type === "credit_card" ? (
                    <div className="grid grid-cols-3 gap-2 pl-2 border-l-2 border-navy-700/30 ml-2">
                      <div>
                        <label className="text-[11px] font-mono text-faint-foreground block mb-1">Fecha dia</label>
                        <Input type="number" min={1} max={31} placeholder="27" value={a.billCloseDay ?? ""} onChange={(e) => updateAt(i, { billCloseDay: e.target.value ? parseInt(e.target.value, 10) : undefined })} />
                      </div>
                      <div>
                        <label className="text-[11px] font-mono text-faint-foreground block mb-1">Vence dia</label>
                        <Input type="number" min={1} max={31} placeholder="5" value={a.billDueDay ?? ""} onChange={(e) => updateAt(i, { billDueDay: e.target.value ? parseInt(e.target.value, 10) : undefined })} />
                      </div>
                      <div>
                        <label className="text-[11px] font-mono text-faint-foreground block mb-1">Limite (opcional)</label>
                        <MoneyInput name={`acc-limit-${i}`} defaultValue={a.creditLimit ?? 0} onValueChange={(v) => updateAt(i, { creditLimit: v })} />
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={finish} disabled={pending} className="text-[12.5px] text-faint-foreground hover:text-foreground">
              Pular por agora
            </button>
            <Button variant="primary" onClick={() => setStep(1)} disabled={totalAccounts === 0}>
              Continuar
              <ArrowRight className="w-3.5 h-3.5 ml-1" strokeWidth={2} />
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.7} />
            É só isso pra começar
          </div>
          <h2 className="font-display text-[22px] tracking-[-0.015em] font-medium mb-2">
            Agora é lançar — e o resto se monta sozinho
          </h2>
          <p className="text-[13.5px] text-muted-foreground mb-5 leading-relaxed">
            Conforme você registra receitas e despesas, o painel preenche seu fluxo, seu
            patrimônio e a <b className="text-foreground">estimativa do seu IRPF</b> — tudo
            automático. Três jeitos de lançar:
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <PathCard icon={<PencilLine className="w-4 h-4" strokeWidth={1.7} />} title="Na mão" desc="Botão + no canto, ou ⌘K. Rápido pro dia a dia." />
            <PathCard icon={<Upload className="w-4 h-4" strokeWidth={1.7} />} title="Importar CSV" desc="Sobe o extrato do banco e categoriza em lote." />
            <PathCard icon={<ScanLine className="w-4 h-4" strokeWidth={1.7} />} title="Documento (IA)" desc="Joga fatura/holerite/extrato no Inbox e a IA extrai." highlight />
          </div>

          <div className="rounded-[8px] bg-surface-muted px-4 py-3 mb-6">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              <b className="text-foreground">Seus dados de IR</b> (CPF, dependentes, fontes
              pagadoras) você completa quando quiser — o painel te lembra. Isso deixa a
              declaração ainda mais automática, mas não trava você de começar agora.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setStep(0)} disabled={pending} className="text-[12.5px] text-faint-foreground hover:text-foreground">
              Voltar
            </button>
            <Button variant="primary" onClick={finish} disabled={pending}>
              {pending ? "Preparando…" : "Ir pro meu painel"}
              <ArrowRight className="w-3.5 h-3.5 ml-1" strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PathCard({
  icon,
  title,
  desc,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border p-4",
        highlight
          ? "border-navy-700/40 bg-navy-100/40 dark:bg-navy-700/15"
          : "border-border bg-surface",
      )}
    >
      <div className={cn("w-8 h-8 rounded-[8px] grid place-items-center mb-2", highlight ? "bg-navy-700/15 text-navy-700 dark:text-navy-300" : "bg-surface-muted text-foreground")}>
        {icon}
      </div>
      <div className="font-medium text-[13.5px] text-foreground">{title}</div>
      <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</div>
    </div>
  );
}
