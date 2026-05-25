"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Guia interativo dos 3 cenários de plano de saúde pra IRPF.
 *
 * Plano de saúde tem regras MUITO específicas que mudam dependendo de como
 * você paga. Esse componente ajuda o usuário a identificar e configurar
 * corretamente cada cenário.
 *
 * Cenários:
 *   A — Empresa paga 100% (benefício isento, NÃO deduz)
 *   B — Coparticipação descontada na folha (deduz só a parte sua)
 *   C — Pago direto à operadora (deduz total se beneficiário é dependente IR)
 */

type Scenario = "A" | "B" | "C" | "D";

const SCENARIOS: Record<Scenario, { title: string; subtitle: string }> = {
  A: {
    title: "A · CLT, empresa paga 100%",
    subtitle: "Plano integral como benefício, sem desconto seu",
  },
  B: {
    title: "B · CLT, coparticipação na folha",
    subtitle: "Empresa contrata, desconta parte do salário",
  },
  C: {
    title: "C · Pago direto à operadora",
    subtitle: "Você paga boleto à operadora",
  },
  D: {
    title: "D · Plano empresarial PJ",
    subtitle: "Sua PJ contratou (você é sócio/MEI)",
  },
};

export function HealthPlanScenarioHelper({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState<Scenario | null>(null);

  return (
    <div className="rounded-[10px] border border-navy-200 dark:border-navy-700/40 bg-navy-50/40 dark:bg-navy-900/15 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-navy-50 dark:hover:bg-navy-900/25 transition-colors"
      >
        <Info className="w-4 h-4 text-navy-700 dark:text-navy-300 shrink-0" strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-foreground">
            Como tratar plano de saúde no IR?
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            Guia rápido com 3 cenários — clique pra abrir
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-faint-foreground" strokeWidth={1.7} />
        ) : (
          <ChevronDown className="w-4 h-4 text-faint-foreground" strokeWidth={1.7} />
        )}
      </button>

      {open ? (
        <div className="border-t border-navy-200 dark:border-navy-700/40 px-3 py-3 space-y-2.5">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Plano de saúde tem regras específicas. Identifique o seu cenário olhando no
            contracheque ou no informe de rendimentos anual.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                className={cn(
                  "rounded-[8px] border px-2.5 py-2 text-left text-[11.5px] transition-colors",
                  selected === s
                    ? "border-navy-700 bg-white dark:bg-ink-950"
                    : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                <div className="font-medium text-foreground">{SCENARIOS[s].title}</div>
                <div className="text-faint-foreground text-[10.5px] mt-0.5 leading-tight">
                  {SCENARIOS[s].subtitle}
                </div>
              </button>
            ))}
          </div>

          {selected ? <ScenarioDetail scenario={selected} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ScenarioDetail({ scenario }: { scenario: Scenario }) {
  if (scenario === "A") {
    return (
      <ScenarioCard
        tone="error"
        icon={<AlertTriangle className="w-4 h-4" strokeWidth={1.8} />}
        title="Cenário A — Não deduz, não lance"
        items={[
          "A empresa contratou o plano e arca com 100% — você não pagou nada do bolso.",
          "É benefício isento — NÃO entra na declaração de pagamentos efetuados.",
        ]}
        action={{
          label: "Se você criou recorrência ou pagamento Amil/Unimed/etc:",
          text: "Apague — você não tem despesa real desse plano.",
        }}
      />
    );
  }

  if (scenario === "B") {
    return (
      <ScenarioCard
        tone="warning"
        icon={<AlertTriangle className="w-4 h-4" strokeWidth={1.8} />}
        title="Cenário B — Deduz só a parte descontada"
        items={[
          "Olhe seu contracheque: tem uma linha tipo 'Desconto Assistência Médica' ou 'Plano de Saúde — Coparticipação'.",
          "Esse desconto mensal é o que você pode deduzir (não o valor total contratado pela empresa).",
          "No informe de rendimentos anual da empresa há um campo separado mostrando o total descontado no ano.",
          "Se a esposa é dependente IR sua: deduz a parte dela também. Se ela declara separado: NÃO deduz a parte dela (não é gasto seu pra fins fiscais).",
        ]}
        action={{
          label: "Configuração no app:",
          text:
            "Valor = só sua parte (informe da empresa). CNPJ = da operadora (Amil, Unimed, Bradesco Saúde…) e NÃO da sua empresa empregadora. Beneficiário = você (e dependentes IR se inclui).",
        }}
      />
    );
  }

  if (scenario === "C") {
    return (
      <ScenarioCard
        tone="success"
        icon={<CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />}
        title="Cenário C — Deduz total (quem é dependente)"
        items={[
          "Você paga boleto/cartão direto à operadora — guarde os comprovantes.",
          "O valor TOTAL pago no ano pode ser deduzido.",
          "Mas atenção: a parte da fatura referente a quem NÃO é dependente IR seu não pode ser deduzida.",
          "Se esposa declara separado: a fração dela fica de fora — você paga porque escolheu, mas a Receita só aceita dedução pra quem está na sua declaração.",
        ]}
        action={{
          label: "Configuração no app:",
          text:
            "Valor = total pago no ano MENOS a fração de quem não é dependente seu. CNPJ = da operadora (Amil = 29.309.127/0001-79). Beneficiário = lista quem foi atendido (você e dependentes IR seus).",
        }}
      />
    );
  }

  // Cenário D — Plano empresarial PJ
  return (
    <div className="space-y-2 mt-2">
      <ScenarioCard
        tone="warning"
        icon={<AlertTriangle className="w-4 h-4" strokeWidth={1.8} />}
        title="Cenário D — Plano contratado pela sua PJ"
        items={[
          "A fatura vem em nome da PJ, mas pode ser paga pela PJ OU pela PF — muda tudo no IR.",
          "REGRA-OURO: o mesmo gasto NÃO pode ser deduzido duas vezes (PJ + PF). Confirme com seu contador da PJ se ele computa esse plano como despesa da empresa.",
        ]}
        action={{
          label: "Sub-cenários:",
          text: "Veja abaixo a regra exata por como você paga + regime tributário da sua PJ.",
        }}
      />

      <div className="rounded-[8px] border border-border bg-surface px-3 py-2.5 text-[11.5px] leading-relaxed">
        <div className="font-medium text-foreground mb-2 text-[12px]">D1 — PJ paga 100% (conta PJ → Amil)</div>
        <ul className="text-muted-foreground space-y-0.5">
          <li>• Despesa fica integralmente na PJ.</li>
          <li>• <b>PF não deduz nada</b> — você não pagou do CPF.</li>
          <li>• Caminho mais limpo fiscalmente. Sem risco de fiscalização.</li>
        </ul>
        <div className="mt-1.5 text-[11px] text-faint-foreground">
          <b>No app:</b> NÃO cadastre como recorrência pessoal. Se já cadastrou, apague.
        </div>
      </div>

      <div className="rounded-[8px] border border-border bg-surface px-3 py-2.5 text-[11.5px] leading-relaxed">
        <div className="font-medium text-foreground mb-2 text-[12px]">D2 — PF paga (sai da conta CPF), mas a fatura é PJ</div>
        <ul className="text-muted-foreground space-y-0.5">
          <li>• Pra Receita, na prática <b>quem pagou foi a PF</b> (comprovante PF).</li>
          <li>• A PJ não consegue lançar como despesa dela (não tem comprovante de pagamento PJ).</li>
          <li>• <b>Resultado depende do regime + contador:</b></li>
          <li className="pl-3">↳ <b>Simples Nacional / MEI</b>: regime não usa despesa pra calcular imposto → <b>PF pode deduzir tranquilo</b>.</li>
          <li className="pl-3">↳ <b>Lucro Presumido/Real + contador NÃO deduz na PJ</b> → PF pode deduzir.</li>
          <li className="pl-3">↳ <b>Lucro Presumido/Real + contador DEDUZ na PJ</b> → ⚠️ PF NÃO pode deduzir (dupla dedução, ilegal).</li>
        </ul>
        <div className="mt-1.5 text-[11px] text-faint-foreground">
          <b>No app:</b> recorrência marcada como dedutível. Valor = só sua parte + dependentes IR (exclui esposa/parente que declara separado). CNPJ = operadora (não da sua PJ).
        </div>
      </div>

      <div className="rounded-[8px] border border-border bg-surface px-3 py-2.5 text-[11.5px] leading-relaxed">
        <div className="font-medium text-foreground mb-2 text-[12px]">D3 — PJ paga, mas desconta do seu pró-labore</div>
        <ul className="text-muted-foreground space-y-0.5">
          <li>• A PJ contabiliza como despesa dela MAS depois cobra de você via desconto no pró-labore.</li>
          <li>• Você efetivamente pagou (via folha PJ) → <b>pode deduzir na PF</b>.</li>
          <li>• PJ NÃO pode lançar como despesa própria nesse caso (foi compensada).</li>
        </ul>
        <div className="mt-1.5 text-[11px] text-faint-foreground">
          <b>No app:</b> mesma config do D2 — recorrência dedutível, CNPJ operadora, valor sua parte.
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({
  tone,
  icon,
  title,
  items,
  action,
}: {
  tone: "success" | "warning" | "error";
  icon: React.ReactNode;
  title: string;
  items: string[];
  action: { label: string; text: string };
}) {
  const toneClasses = {
    success: "bg-olive-50 dark:bg-olive-900/20 border-olive-200 dark:border-olive-700/40 text-olive-700 dark:text-olive-100",
    warning: "bg-gold-50 dark:bg-gold-900/20 border-gold-200 dark:border-gold-700/40 text-gold-700 dark:text-gold-100",
    error: "bg-rust-50 dark:bg-rust-900/20 border-rust-200 dark:border-rust-700/40 text-rust-700 dark:text-rust-100",
  }[tone];

  return (
    <div className={cn("rounded-[8px] border px-3 py-2.5 mt-2", toneClasses)}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <div className="flex-1">
          <div className="font-medium text-[12.5px]">{title}</div>
          <ul className="text-[11.5px] mt-1.5 space-y-0.5 leading-relaxed text-foreground">
            {items.map((it, i) => (
              <li key={i}>• {it}</li>
            ))}
          </ul>
          <div className="mt-2.5 pt-2 border-t border-current/20 text-[11.5px] text-foreground">
            <b>{action.label}</b> {action.text}
          </div>
        </div>
      </div>
    </div>
  );
}
