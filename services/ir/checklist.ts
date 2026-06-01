import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listFilers, getRegimeContext } from "@/services/ir/filers";
import { getBensReport } from "@/services/ir/bens";
import { convertOrSame } from "@/lib/financial/currency";
import { getRateMapAt } from "@/services/currency";

/** Limite CBE/Bacen: declaração obrigatória se bens no exterior >= USD 1M em 31/12 */
const CBE_THRESHOLD_USD = 1_000_000;

/**
 * Checklist de prontidão pra exportar a declaração IRPF.
 *
 * Cada check é uma verificação que pode ser:
 *   - "ok": tudo certo
 *   - "warning": pode exportar mas algo é recomendável (ex.: cadastrar fonte pagadora)
 *   - "error": NÃO deve exportar — programa da Receita vai rejeitar (ex.: CPF inválido)
 *
 * Resultado é renderizado na página IR antes do botão de exportar.
 */

export type CheckSeverity = "ok" | "warning" | "error";
export type CheckItem = {
  id: string;
  severity: CheckSeverity;
  title: string;
  detail?: string;
  /** Link interno pra resolver o item (ex.: ir até /ir/[year]/configuracoes) */
  link?: { href: string; label: string };
};

export type ChecklistReport = {
  year: number;
  items: CheckItem[];
  counts: { ok: number; warning: number; error: number };
  /** true se não há erros — exportação segura */
  readyToExport: boolean;
};

function validateCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 11111111111 etc.
  // Dígito 1
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  // Dígito 2
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

export async function getChecklistReport(
  year: number,
  householdId?: string,
): Promise<ChecklistReport> {
  const supabase = await createClient();
  const items: CheckItem[] = [];

  const [
    filers,
    regime,
    bens,
    { data: deps },
    { data: pays },
    { data: settings },
    { data: txsWithoutFonte },
  ] = await Promise.all([
    listFilers(householdId),
    getRegimeContext(householdId),
    getBensReport(year, householdId),
    supabase.from("ir_dependents").select("*").eq("is_active", true),
    supabase.from("ir_deductible_payments").select("*").eq("year", year),
    supabase.from("ir_settings").select("*").maybeSingle(),
    supabase
      .from("transactions")
      .select("id, description, amount_account, date, recurring_rule_id")
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .eq("kind", "income")
      .eq("exclude_from_ir", false)
      .is("fonte_pagadora_id", null)
      .limit(100),
  ]);

  const configHref = `/ir/${year}/configuracoes`;

  // ============================================================
  // FILERS — CPF
  // ============================================================
  if (filers.length === 0) {
    items.push({
      id: "no_filers",
      severity: "error",
      title: "Nenhum declarante cadastrado",
      detail: "É preciso ao menos 1 declarante com CPF válido.",
      link: { href: configHref, label: "Cadastrar declarante" },
    });
  }
  for (const f of filers) {
    if (!validateCPF(f.cpf)) {
      items.push({
        id: `cpf_invalid:${f.id}`,
        severity: "error",
        title: `CPF inválido — ${f.full_name}`,
        detail: `O CPF "${f.cpf}" não passa na validação dos dígitos. Programa da Receita vai rejeitar.`,
        link: { href: configHref, label: "Corrigir CPF" },
      });
    }
    if (!f.birth_date) {
      items.push({
        id: `birth_missing:${f.id}`,
        severity: "warning",
        title: `Data de nascimento ausente — ${f.full_name}`,
        link: { href: configHref, label: "Preencher" },
      });
    }
    if (!f.occupation_code) {
      items.push({
        id: `occupation_missing:${f.id}`,
        severity: "warning",
        title: `Código de ocupação ausente — ${f.full_name}`,
        detail: "A Receita exige código de 4 dígitos da tabela de ocupações.",
        link: { href: configHref, label: "Preencher" },
      });
    }
  }

  // ============================================================
  // CASAMENTO — coerência
  // ============================================================
  if (regime.regime === "comunhao_parcial" && !regime.marriageDate) {
    items.push({
      id: "marriage_date_missing",
      severity: "error",
      title: "Data do casamento ausente",
      detail:
        "Regime de comunhão parcial exige a data — bens pré-casamento ficam particulares automaticamente.",
      link: { href: configHref, label: "Definir data" },
    });
  }

  // ============================================================
  // DEPENDENTES — CPF obrigatório para qualquer idade desde 2019
  // ============================================================
  for (const d of (deps ?? [])) {
    if (!d.cpf) {
      items.push({
        id: `dep_cpf_missing:${d.id}`,
        severity: "error",
        title: `CPF do dependente ausente — ${d.name}`,
        detail: "Desde 2019 a Receita exige CPF de TODOS os dependentes, mesmo recém-nascidos.",
        link: { href: configHref, label: "Preencher CPF" },
      });
    } else if (!validateCPF(d.cpf)) {
      items.push({
        id: `dep_cpf_invalid:${d.id}`,
        severity: "error",
        title: `CPF do dependente inválido — ${d.name}`,
        link: { href: configHref, label: "Corrigir" },
      });
    }
    if (filers.length >= 2 && !d.belongs_to_filer_id) {
      items.push({
        id: `dep_filer_missing:${d.id}`,
        severity: "error",
        title: `Dependente sem declaração atribuída — ${d.name}`,
        detail:
          "Casal com 2 declarações: cada dependente precisa pertencer a UMA delas (escolha a que maximiza dedução).",
        link: { href: configHref, label: "Atribuir" },
      });
    }
    if (!d.birth_date) {
      items.push({
        id: `dep_birth_missing:${d.id}`,
        severity: "warning",
        title: `Data de nascimento do dependente ausente — ${d.name}`,
        link: { href: configHref, label: "Preencher" },
      });
    } else if (["filho", "filha", "enteado"].includes(d.relationship)) {
      // Regra de idade (Lei 9.250/95 art. 35): filho/enteado é dependente até 21
      // anos, ou até 24 se cursando ensino superior/técnico (flag is_student).
      const age = year - parseInt(d.birth_date.slice(0, 4), 10);
      const isStudent = (d as { is_student?: boolean }).is_student ?? false;
      if (age > 24) {
        items.push({
          id: `dep_age_over24:${d.id}`,
          severity: "warning",
          title: `Dependente ${d.name} tem ${age} anos — fora da regra de idade`,
          detail:
            "Filho/enteado deduz como dependente só até 21 anos (ou 24 cursando ensino superior/técnico). Acima disso, a dedução pode cair na malha — confira se ainda se enquadra (ex.: incapacidade).",
          link: { href: configHref, label: "Revisar" },
        });
      } else if (age > 21 && !isStudent) {
        items.push({
          id: `dep_age_student:${d.id}`,
          severity: "warning",
          title: `Dependente ${d.name} tem ${age} anos — marque "estudante"`,
          detail:
            "Entre 22 e 24 anos, filho/enteado só é dependente se estiver cursando ensino superior ou escola técnica. Marque a flag de estudante (ou remova a dedução).",
          link: { href: configHref, label: "Marcar estudante" },
        });
      }
    }
  }

  // ============================================================
  // PAGAMENTOS DEDUTÍVEIS — CNPJ/CPF do recipient é obrigatório
  // ============================================================
  for (const p of (pays ?? [])) {
    if (!p.recipient_cnpj_cpf) {
      items.push({
        id: `pay_cnpj_missing:${p.id}`,
        severity: "error",
        title: `Pagamento "${p.description}" sem CNPJ/CPF do beneficiário`,
        detail:
          "A Receita exige CNPJ/CPF de TODO pagamento dedutível. Sem isso, perde a dedução em caso de malha.",
        link: { href: configHref, label: "Corrigir" },
      });
    }
    // Saúde/educação dependente: precisa ter beneficiary preenchido
    const isDependentKind =
      p.kind === "educacao_dependente" ||
      (p.is_dependent_payment && ["plano_saude", "medico", "hospital", "dentista", "psicologo"].includes(p.kind));
    if (isDependentKind && !p.beneficiary) {
      items.push({
        id: `pay_beneficiary_missing:${p.id}`,
        severity: "warning",
        title: `Pagamento de dependente sem nome do dependente — ${p.description}`,
        link: { href: configHref, label: "Preencher" },
      });
    }
  }

  // ============================================================
  // BENS — CNPJ em ações/FIIs/ETFs/RF privada (grupos 04/05)
  // ============================================================
  const bensNeedCnpj = bens.byGroup
    .filter((g) => ["04", "05", "06", "07"].includes(g.group))
    .flatMap((g) => g.items);
  const bensMissingCnpj = bensNeedCnpj.filter(
    (b) => !b.cnpj || b.cnpj === "—",
  );
  if (bensMissingCnpj.length > 0) {
    const sample = bensMissingCnpj
      .slice(0, 3)
      .map((b) => b.discrimination.split(/[·\-]/)[0]?.trim() ?? "")
      .filter(Boolean)
      .join(", ");
    items.push({
      id: "bens_cnpj_missing",
      severity: "warning",
      title: `${bensMissingCnpj.length} bem(ns) sem CNPJ na declaração`,
      detail:
        `Renda variável e fixa privada exigem CNPJ. Faltam em: ${sample}${bensMissingCnpj.length > 3 ? "…" : ""}. ` +
        "Tickers do catálogo são preenchidos automaticamente — verifique os manuais.",
      link: { href: `/ir/${year}#bens`, label: "Ver Bens e Direitos" },
    });
  }

  // ============================================================
  // RENDA — transações income sem fonte pagadora
  // ============================================================
  if ((txsWithoutFonte ?? []).length > 0) {
    const ruleIds = Array.from(
      new Set(
        (txsWithoutFonte ?? [])
          .map((t) => (t as { recurring_rule_id: string | null }).recurring_rule_id)
          .filter((x): x is string => !!x),
      ),
    );
    const fromRecurring = (txsWithoutFonte ?? []).filter(
      (t) => (t as { recurring_rule_id: string | null }).recurring_rule_id,
    ).length;
    const avulsas = (txsWithoutFonte ?? []).length - fromRecurring;
    // Quando todos vêm da mesma recorrência, link direto pra ela.
    // Caso contrário, link pra lista com âncora no primeiro item problemático.
    const firstRuleId = ruleIds[0];
    items.push({
      id: "tx_no_fonte",
      severity: "warning",
      title: `${txsWithoutFonte!.length} recebimento(s) sem fonte pagadora`,
      detail:
        fromRecurring > 0
          ? `${fromRecurring} vêm de ${ruleIds.length === 1 ? "1 recorrência" : `${ruleIds.length} recorrências`} sem fonte cadastrada — edite a recorrência (ex.: salário) e linke a fonte; isso conserta TODAS as próximas. ${avulsas > 0 ? `${avulsas} são lançamentos avulsos — edite cada um em /transacoes.` : ""}`
          : "Recebimentos sem fonte pagadora caem em 'Outros' no IR e não geram IRRF/INSS corretos. Cadastre as empresas em /ir/configuracoes e ligue.",
      link: firstRuleId
        ? { href: `/recorrentes#rule-${firstRuleId}`, label: "Editar recorrência" }
        : { href: `/transacoes?kind=income&showHistorical=1`, label: "Revisar transações" },
    });
  }

  // ============================================================
  // DOAÇÕES — limite total 6% do imposto devido (ECA + Idoso + Lei Rouanet + Esporte)
  // ============================================================
  const totalDonations = (pays ?? [])
    .filter((p) => p.kind === "doacao_eca" || p.kind === "doacao_cultural")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  if (totalDonations > 0) {
    // Estimativa simplificada: 6% da renda tributável média do BR (faixa 22.5%)
    // Refinado seria computar imposto devido completo e checar contra ele.
    // Aqui apenas avisa quando o valor é grande e merece checagem.
    items.push({
      id: "donation_limit_check",
      severity: "warning",
      title: `Doações dedutíveis (R$ ${totalDonations.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) — verifique limite 6%`,
      detail:
        "Lei 9.250/95 art. 22: doações ECA + Idoso + Lei Rouanet + Lei do Esporte + Pronas + Pronon ficam limitadas a 6% do imposto devido. O valor acima desse limite NÃO deduz e fica perdido. Confirme com o seu contador.",
      link: { href: `/ir/${year}`, label: "Ver cálculo" },
    });
  }

  // ============================================================
  // CBE — Bens no exterior >= USD 1M (obrigação Bacen separada)
  // ============================================================
  const { data: foreignAccs } = await (householdId
    ? supabase
        .from("accounts")
        .select("current_balance, currency")
        .eq("is_active", true)
        .eq("is_exterior", true)
        .eq("household_id", householdId)
    : supabase
        .from("accounts")
        .select("current_balance, currency")
        .eq("is_active", true)
        .eq("is_exterior", true));

  if ((foreignAccs ?? []).length > 0) {
    const rates = await getRateMapAt(`${year}-12-31`);
    let totalUsd = 0;
    for (const a of foreignAccs ?? []) {
      const valBRL = convertOrSame(Number(a.current_balance ?? 0), a.currency, "BRL", rates);
      const valUSD = convertOrSame(valBRL, "BRL", "USD", rates);
      totalUsd += valUSD;
    }
    if (totalUsd >= CBE_THRESHOLD_USD) {
      items.push({
        id: "cbe_obligation",
        severity: "warning",
        title: `Bens no exterior ≥ USD 1 milhão — declaração CBE obrigatória ao Bacen`,
        detail:
          `Saldos no exterior: ~USD ${totalUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}. ` +
          `Além do IRPF, você precisa entregar a CBE (Capitais Brasileiros no Exterior) ao Banco Central ` +
          `entre fevereiro e 5 de abril. Multa por atraso: R$ 250 a R$ 250 mil.`,
        link: { href: "https://www.bcb.gov.br/cbe", label: "Sobre CBE" },
      });
    }
  }

  // ============================================================
  // CONFIG — modelo de declaração
  // ============================================================
  if (!settings) {
    items.push({
      id: "settings_missing",
      severity: "warning",
      title: "Configurações IR não definidas",
      detail: "Defina o modelo (simples/completo/auto) e demais preferências.",
      link: { href: configHref, label: "Configurar" },
    });
  }

  // ============================================================
  // OK geral
  // ============================================================
  if (items.length === 0) {
    items.push({
      id: "all_ok",
      severity: "ok",
      title: "Tudo certo!",
      detail: "Sua declaração está pronta pra exportar.",
    });
  }

  const counts = {
    ok: items.filter((i) => i.severity === "ok").length,
    warning: items.filter((i) => i.severity === "warning").length,
    error: items.filter((i) => i.severity === "error").length,
  };

  return {
    year,
    items,
    counts,
    readyToExport: counts.error === 0,
  };
}
