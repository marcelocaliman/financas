import "server-only";
import { getBensReport, type BensReport } from "@/services/ir/bens";
import { getRendimentosReport, type RendimentosReport } from "@/services/ir/rendimentos";
import { getRendaVariavelReport } from "@/services/ir/renda-variavel";

/**
 * ⚠️  AVISO IMPORTANTE — leia antes de usar
 *
 * O arquivo .DEC oficial do programa IRPF da Receita Federal é binário,
 * proprietário e com checksum/versionamento que só o PGD (Programa Gerador
 * da Declaração) consegue gerar/ler. Reproduzir esse formato externamente
 * não é viável sem engenharia reversa profunda — e ainda assim quebraria
 * a cada nova versão anual.
 *
 * O que o app gera AQUI é um "Relatório técnico estruturado" inspirado nos
 * layouts da DIRF/CIDE: pipe-delimited, R01/R27/R51/R71/R72/R73/R99. Útil
 * pra contador conferir, mas NÃO importa diretamente no programa IRPF.
 *
 * Caminhos práticos de uso:
 *   1) O `humanReadable` (TXT formatado) — usuário copia seção por seção
 *      no programa IRPF. É a forma confiável que SEMPRE funciona.
 *   2) Importação de Bens via CSV no formato XP/Itaú — o programa IRPF
 *      aceita CSV/TXT padrão B3 pra alguns campos (TODO: implementar).
 *   3) Esperar o PGD do ano (jan/fev) e digitar manualmente os ~10
 *      registros principais (atalho com o TXT acima).
 *
 * Pra produção de verdade, considerar:
 *   - Lib `irpf-parser` (não-oficial, comunidade)
 *   - API do contador (entrega XML padrão ECF, depois ele gera o DEC)
 *   - Continuar com o TXT humano (escolha atual)
 */

function pad(s: string | number, n: number, char = " ", side: "left" | "right" = "right"): string {
  const str = String(s);
  if (str.length >= n) return str.slice(0, n);
  const fill = char.repeat(n - str.length);
  return side === "right" ? str + fill : fill + str;
}

function moneyToReceita(v: number): string {
  // Receita usa centavos sem separador (15000 = R$ 150,00)
  return Math.round(Math.abs(v) * 100).toString();
}

/** Igual a moneyToReceita mas preserva o sinal (prejuízo de renda variável). */
export function signedMoneyToReceita(v: number): string {
  const digits = Math.round(Math.abs(v) * 100).toString();
  return v < 0 ? `-${digits}` : digits;
}

function clean(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[|\r\n]/g, " ")
    .trim()
    .slice(0, max);
}

/** CNPJ/CPF só com dígitos (remove pontuação ANTES de cortar — senão trunca inválido). */
export function cleanDoc(s: string | null | undefined, max = 14): string {
  if (!s) return "";
  return s.replace(/\D/g, "").slice(0, max);
}

export type DecBundle = {
  filename: string;
  content: string;
  /** Texto plano, formato humano legível, pra cópia direta nas seções */
  humanReadable: string;
};

export async function generateDec(args: {
  year: number;
  cpf: string;
  nome: string;
  householdId?: string;
  /** Quando presente, gera DEC do filer específico (declaração separada) */
  filerId?: string;
  /** Marca d'água quando exportado por contador (LGPD evidence) */
  accountantWatermark?: { fullName: string; crc?: string; ip?: string };
}): Promise<DecBundle> {
  const [bens, rendimentos, rv] = await Promise.all([
    getBensReport(args.year, args.householdId, args.filerId),
    getRendimentosReport(args.year, args.householdId, args.filerId),
    getRendaVariavelReport(args.year, args.householdId, args.filerId),
  ]);

  const lines: string[] = [];

  // ============================================================
  // R01 — Cabeçalho identificador
  // ============================================================
  const cpfDigits = (args.cpf || "").replace(/\D/g, "").padStart(11, "0");
  const exercicio = args.year + 1; // exercício = ano-base + 1
  lines.push(
    [
      "R01",
      pad(cpfDigits, 11, "0", "left"),
      pad(exercicio.toString(), 4),
      pad(args.year.toString(), 4),
      clean(args.nome, 60),
      "BR", // país
    ].join("|"),
  );

  // ============================================================
  // R27 — Bens e Direitos
  // ============================================================
  for (const group of bens.byGroup) {
    for (const item of group.items) {
      lines.push(
        [
          "R27",
          pad(group.group, 2, "0", "left"),
          pad(item.code, 2, "0", "left"),
          "105", // BR (105 = Brasil)
          cleanDoc(item.cnpj, 14),
          clean(item.discrimination, 510),
          moneyToReceita(item.previousYearValue),
          moneyToReceita(item.currentYearValue),
        ].join("|"),
      );
    }
  }

  // ============================================================
  // R28 — Dívidas e Ônus Reais (saldo em 31/12; obrigatório > R$ 5.000)
  // ============================================================
  for (const d of bens.dividas.items) {
    lines.push(
      [
        "R28",
        clean(d.kindLabel, 40),
        cleanDoc(d.creditorCnpjCpf, 14),
        clean(d.creditorName, 60),
        clean(d.description, 510),
        moneyToReceita(d.currentBalance),
        d.currentBalance > 5000 ? "S" : "N", // declaração obrigatória
      ].join("|"),
    );
  }

  // ============================================================
  // R51 — Rendimentos Tributáveis Recebidos de PJ
  // ============================================================
  for (const r of rendimentos.tributaveis.rows) {
    lines.push(
      [
        "R51",
        cleanDoc(r.payerCnpjCpf, 14),
        clean(r.payerName, 60),
        moneyToReceita(r.grossAmount),
        moneyToReceita(r.thirteenth),
        moneyToReceita(r.inss),
        moneyToReceita(r.irrf),
      ].join("|"),
    );
  }

  // ============================================================
  // R71 — Rendimentos Isentos e Não Tributáveis
  // ============================================================
  for (const r of rendimentos.isentos.rows) {
    lines.push(
      [
        "R71",
        pad(r.receitaCode ?? "99", 2, "0", "left"),
        cleanDoc(r.payerCnpjCpf, 14),
        clean(r.payerName, 60),
        clean(r.description, 60),
        moneyToReceita(r.grossAmount),
      ].join("|"),
    );
  }

  // ============================================================
  // R72 — Rendimentos Sujeitos à Tributação Exclusiva
  // ============================================================
  for (const r of rendimentos.exclusivos.rows) {
    lines.push(
      [
        "R72",
        pad(r.receitaCode ?? "99", 2, "0", "left"),
        cleanDoc(r.payerCnpjCpf, 14),
        clean(r.payerName, 60),
        clean(r.description, 60),
        moneyToReceita(r.grossAmount),
        moneyToReceita(r.irrf), // IRRF retido — antes omitido (impedia conciliação)
      ].join("|"),
    );
  }

  // ============================================================
  // R73 — Renda Variável (resumo mensal swing/day/fii)
  // ============================================================
  const allMonths = [...rv.swing, ...rv.dayTrade, ...rv.fii, ...rv.options].filter(
    (m) => m.grossSales > 0 || m.grossProfit !== 0,
  );
  for (const m of allMonths) {
    lines.push(
      [
        "R73",
        pad(m.month.toString(), 2, "0", "left"),
        m.kind, // swing | day_trade | fii | options
        moneyToReceita(m.grossSales),
        signedMoneyToReceita(m.grossProfit), // preserva sinal do prejuízo
        moneyToReceita(m.taxableBase),
        moneyToReceita(m.irrfRetained),
        moneyToReceita(m.taxDue),
        m.isExempt ? "S" : "N",
      ].join("|"),
    );
  }

  // ============================================================
  // R99 — Trailer (conta TODAS as linhas, incluindo o próprio R99)
  // ============================================================
  lines.push(["R99", pad((lines.length + 1).toString(), 6, "0", "left")].join("|"));

  const content = lines.join("\n") + "\n";
  const filename = `IRPF_${args.year}_${cpfDigits}.DEC`;

  const watermark = args.accountantWatermark
    ? `\n# ────────────────────────────────────────────────────────────────────\n# Exportado por: ${args.accountantWatermark.fullName}${args.accountantWatermark.crc ? ` (${args.accountantWatermark.crc})` : ""} via Finanças\n# Em: ${new Date().toISOString()}${args.accountantWatermark.ip ? `\n# IP: ${args.accountantWatermark.ip}` : ""}\n# Acesso autorizado pelo titular conforme LGPD.\n# ────────────────────────────────────────────────────────────────────\n`
    : "";

  return {
    filename,
    content: content + (watermark ? `\n${watermark}` : ""),
    humanReadable: watermark + generateHumanReadable(args.year, bens, rendimentos, rv),
  };
}

/**
 * Versão "para humanos" — formato texto Markdown-like organizado por seções
 * do IRPF. Esse é o que tem maior chance de uso real: o usuário copia e
 * cola seção por seção no programa IRPF.
 */
function generateHumanReadable(
  year: number,
  bens: BensReport,
  rend: RendimentosReport,
  rv: Awaited<ReturnType<typeof getRendaVariavelReport>>,
): string {
  const lines: string[] = [];
  const sep = "─".repeat(78);

  lines.push(`# DECLARAÇÃO IRPF — Ano-base ${year}`);
  if (bens.fxNote) lines.push(`# ${bens.fxNote}`);
  lines.push("");

  // === BENS ===
  lines.push(sep);
  lines.push(`BENS E DIREITOS — Situação em 31/12 (R$)`);
  lines.push(sep);
  for (const g of bens.byGroup) {
    lines.push(`\n[Grupo ${g.group} — ${g.groupLabel}]`);
    for (const item of g.items) {
      lines.push(`  • Código ${item.code} (${item.codeLabel})`);
      if (item.cnpj) lines.push(`    CNPJ: ${item.cnpj}`);
      lines.push(`    Discriminação: ${item.discrimination}`);
      lines.push(
        `    Situação em 31/12/${year - 1}: R$ ${item.previousYearValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      );
      lines.push(
        `    Situação em 31/12/${year}: R$ ${item.currentYearValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      );
    }
    lines.push(
      `  Subtotal grupo ${g.group}: R$ ${g.totalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    );
  }
  lines.push(
    `\nTOTAL DE BENS: R$ ${bens.totals.current.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  );
  lines.push(
    `Variação patrimonial: R$ ${bens.totals.delta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  );

  // === DÍVIDAS E ÔNUS REAIS ===
  if (bens.dividas.items.length > 0) {
    lines.push("\n" + sep);
    lines.push(`DÍVIDAS E ÔNUS REAIS — Saldo em 31/12 (R$)`);
    lines.push(
      `Obs: declaração obrigatória pra saldos > R$ 5.000. Total declarável: ${bens.dividas.declarableCount} de ${bens.dividas.items.length}.`,
    );
    lines.push(sep);
    for (const d of bens.dividas.items) {
      const isDeclarable = d.currentBalance > 5000;
      lines.push(`\n• [${d.kindLabel}]${isDeclarable ? " ⚠️ DECLARAR" : " (opcional)"}`);
      lines.push(`  Credor: ${d.creditorName}${d.creditorCnpjCpf ? ` (${d.creditorCnpjCpf})` : ""}`);
      lines.push(`  Discriminação: ${d.description}`);
      lines.push(
        `  Saldo em 31/12: R$ ${d.currentBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` +
          (d.ownershipPct < 100 ? ` (${d.ownershipPct}% do total)` : ""),
      );
    }
    lines.push(
      `\nTotal de dívidas: R$ ${bens.dividas.totalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    );
  }

  // === RENDIMENTOS TRIBUTÁVEIS PJ ===
  lines.push("\n" + sep);
  lines.push(`RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA`);
  lines.push(sep);
  for (const r of rend.tributaveis.rows) {
    lines.push(`• ${r.payerName} ${r.payerCnpjCpf ? `(${r.payerCnpjCpf})` : ""}`);
    lines.push(`  Rendimento: R$ ${r.grossAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    if (r.inss > 0) lines.push(`  Contribuição previdenciária: R$ ${r.inss.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    if (r.irrf > 0) lines.push(`  IR retido: R$ ${r.irrf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    if (r.thirteenth > 0) lines.push(`  13º (já líquido): R$ ${r.thirteenth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }
  lines.push(
    `\nTotal rendimentos tributáveis: R$ ${rend.tributaveis.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  );
  lines.push(
    `Total IRRF: R$ ${rend.tributaveis.totalIrrf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  );

  // === ISENTOS ===
  lines.push("\n" + sep);
  lines.push(`RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS`);
  lines.push(sep);
  for (const r of rend.isentos.rows) {
    lines.push(
      `• [${r.receitaCode}] ${r.description} — ${r.payerName}${r.payerCnpjCpf ? ` (${r.payerCnpjCpf})` : ""}`,
    );
    lines.push(`  Valor: R$ ${r.grossAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }
  lines.push(
    `\nTotal isentos: R$ ${rend.isentos.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  );

  // === EXCLUSIVOS ===
  lines.push("\n" + sep);
  lines.push(`RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA / DEFINITIVA`);
  lines.push(sep);
  for (const r of rend.exclusivos.rows) {
    lines.push(
      `• [${r.receitaCode}] ${r.description} — ${r.payerName}${r.payerCnpjCpf ? ` (${r.payerCnpjCpf})` : ""}`,
    );
    lines.push(`  Valor: R$ ${r.grossAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    if (r.irrf > 0) lines.push(`  IR retido: R$ ${r.irrf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }

  // === RENDA VARIÁVEL ===
  lines.push("\n" + sep);
  lines.push(`RENDA VARIÁVEL — APURAÇÃO MENSAL`);
  lines.push(sep);
  for (const kind of ["swing", "day_trade", "fii", "options"] as const) {
    const months =
      kind === "swing" ? rv.swing
        : kind === "day_trade" ? rv.dayTrade
          : kind === "fii" ? rv.fii
            : rv.options;
    const monthsWithSales = months.filter((m) => m.grossSales > 0);
    if (monthsWithSales.length === 0) continue;
    const label =
      kind === "swing" ? "Swing trade (ações)"
        : kind === "day_trade" ? "Day trade"
          : kind === "fii" ? "FII"
            : "Opções";
    lines.push(`\n[${label}]`);
    for (const m of monthsWithSales) {
      const monthName = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][m.month - 1];
      lines.push(`  ${monthName}/${year}:`);
      lines.push(`    Vendas: R$ ${m.grossSales.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      lines.push(`    Lucro: R$ ${m.grossProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      if (m.carryforwardUsedThisMonth > 0) {
        lines.push(`    Prejuízos compensados: R$ ${m.carryforwardUsedThisMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      }
      lines.push(`    Base de cálculo: R$ ${m.taxableBase.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      lines.push(`    DARF: R$ ${m.taxDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (venc ${m.dueDate})`);
      if (m.isExempt) lines.push(`    ★ Isento — vendas mensais ≤ R$ 20.000`);
    }
  }
  lines.push(
    `\nPrejuízos a compensar em ${year + 1}:`,
    `  Swing: R$ ${rv.finalCarryforward.swing.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `  Day trade: R$ ${rv.finalCarryforward.day_trade.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `  FII: R$ ${rv.finalCarryforward.fii.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  );

  return lines.join("\n") + "\n";
}
