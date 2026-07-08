import { CLASS, LIABILITY_TYPE } from "@/domain/taxonomy";
import type { Asset, Liability } from "@/domain/types";
import type { TaxItem } from "@/domain/irpf";
import type { TaxSeedMapper } from "@/finance/irpf-seed";

// Mapa "classe do patrimônio → grupo/código do IRPF" (SUGESTÃO editável na UI) + templates de
// discriminação. Todas as escolhas conferidas contra a tabela oficial (ver ./codes.ts).

/**
 * Escolhas com pegadinha embutida:
 *  - ações → 03/01 (Participações Societárias), NÃO grupo 04.
 *  - renda-fixa → 04/02 (tributáveis: Tesouro/CDB). Isentos (LCI/LCA) = 04/03 → usuário ajusta.
 *  - FIIs → 07/03 · multimercado → 07/13 (grupo Fundos).
 *  - previdência → 99/06 (VGBL). PGBL NÃO é bem (é dedução) → a UI alerta.
 *  - cripto → 08/01 (Bitcoin, default) · ouro/commodities → 04/05 · caixa → 06/01.
 */
export const CLASS_TO_CODE: Record<string, { group: string; code: string }> = {
  [CLASS.rendaFixa]: { group: "04", code: "02" },
  [CLASS.acoes]: { group: "03", code: "01" },
  [CLASS.fiis]: { group: "07", code: "03" },
  [CLASS.multimercado]: { group: "07", code: "13" },
  [CLASS.previdencia]: { group: "99", code: "06" },
  [CLASS.cripto]: { group: "08", code: "01" },
  [CLASS.commodities]: { group: "04", code: "05" },
  [CLASS.caixa]: { group: "06", code: "01" },
  [CLASS.imoveis]: { group: "01", code: "12" },
  [CLASS.bens]: { group: "02", code: "01" },
  [CLASS.privateEquity]: { group: "03", code: "02" },
  [CLASS.outros]: { group: "99", code: "99" },
};

/**
 * Refinamento por SUBTIPO (mais preciso que a classe) — só os casos de alta confiança; o resto cai no
 * default da classe. Ids seguem `${classId}-${índice}` da taxonomia. Tudo editável.
 */
export const SUBTYPE_TO_CODE: Record<string, { group: string; code: string }> = {
  // Renda fixa ISENTA → 04/03 (o default da classe é 04/02, tributável).
  "renda-fixa-5": { group: "04", code: "03" }, // LCI
  "renda-fixa-6": { group: "04", code: "03" }, // LCA
  "renda-fixa-7": { group: "04", code: "03" }, // CRI
  "renda-fixa-8": { group: "04", code: "03" }, // CRA
  "renda-fixa-10": { group: "04", code: "03" }, // Debênture incentivada
  "renda-fixa-12": { group: "07", code: "01" }, // Fundo de Renda Fixa → Fundos
  "renda-fixa-13": { group: "07", code: "01" }, // Fundo DI → Fundos
  "renda-fixa-17": { group: "07", code: "99" }, // RF internacional (fundo/ETF) → fundo no exterior
  // ETF e fundo de ações são FUNDOS (07), não ações (03).
  "acoes-4": { group: "07", code: "06" }, // ETF de ações
  "acoes-5": { group: "07", code: "04" }, // Fundo de ações
  // FIIs
  "fiis-4": { group: "07", code: "99" }, // REIT internacional → fundo no exterior
  "fiis-5": { group: "07", code: "07" }, // FI-Infra → Fundos em Infraestrutura
  // Previdência: PGBL NÃO é bem (é dedução em Pagamentos) → sem código; a UI/avisos alertam.
  "previdencia-1": { group: "", code: "" }, // PGBL
  // Cripto por tipo (Bitcoin já é 08/01 pelo default).
  "cripto-2": { group: "08", code: "02" }, // Ethereum → altcoin
  "cripto-3": { group: "08", code: "02" }, // Altcoins
  "cripto-4": { group: "08", code: "03" }, // Stablecoin
  // Commodities: ETF de ouro é fundo.
  "commodities-3": { group: "07", code: "06" }, // ETF de ouro/commodities
  // Caixa: POUPANÇA é grupo 04 (não 06).
  "caixa-2": { group: "04", code: "01" }, // Conta poupança
  // Bens móveis por tipo.
  "bens-4": { group: "02", code: "06" }, // Joias e relógios → Joia
  "bens-7": { group: "02", code: "05" }, // Arte e colecionáveis
  // Imóveis por tipo.
  "imoveis-3": { group: "01", code: "13" }, // Terreno
  // Participação direta em empresa → quotas de capital.
  "private-equity-3": { group: "03", code: "02" },
};

/** Tipo de passivo → código da ficha "Dívidas e Ônus Reais" (editável). */
export const LIABILITY_TO_CODE: Record<string, string> = {
  [LIABILITY_TYPE.financiamentoImobiliario]: "11",
  [LIABILITY_TYPE.financiamentoVeiculo]: "11",
  [LIABILITY_TYPE.emprestimoPessoal]: "11",
  [LIABILITY_TYPE.emprestimoConsignado]: "11",
  [LIABILITY_TYPE.cartaoCredito]: "11",
  [LIABILITY_TYPE.chequeEspecial]: "11",
  [LIABILITY_TYPE.creditoEstudantil]: "13",
  [LIABILITY_TYPE.parcelamento]: "13",
  [LIABILITY_TYPE.impostos]: "13",
  [LIABILITY_TYPE.outrasDividas]: "16",
};

// ── Campos ESTRUTURADOS por tipo ─────────────────────────────────────────────
// O usuário preenche campos claros (CNPJ, quantidade, ticker, agência…) e a discriminação (o texto
// que vai ao contador) NASCE deles. Mais inteligente e legível que um texto livre com [preencher].
export interface IrpfField { key: string; label: string; wide?: boolean }

export const FIELDS_BY_GROUP: Record<string, IrpfField[]> = {
  "01": [{ key: "endereco", label: "Endereço", wide: true }, { key: "matricula", label: "Matrícula" }, { key: "area", label: "Área (m²)" }],
  "02": [{ key: "identificacao", label: "Placa / RENAVAM / chassi", wide: true }],
  "03": [{ key: "quantidade", label: "Quantidade" }, { key: "ticker", label: "Ticker" }, { key: "cnpj", label: "CNPJ da empresa" }, { key: "instituicao", label: "Corretora / custódia" }],
  "04": [{ key: "instituicao", label: "Instituição" }, { key: "cnpj", label: "CNPJ da instituição" }],
  "05": [{ key: "instituicao", label: "Devedor" }, { key: "cnpj", label: "CNPJ/CPF do devedor" }],
  "06": [{ key: "banco", label: "Banco" }, { key: "agencia", label: "Agência" }, { key: "conta", label: "Conta" }, { key: "cnpj", label: "CNPJ do banco" }],
  "07": [{ key: "quantidade", label: "Cotas" }, { key: "ticker", label: "Código do fundo" }, { key: "cnpj", label: "CNPJ do fundo" }, { key: "instituicao", label: "Administrador" }],
  "08": [{ key: "quantidade", label: "Quantidade" }, { key: "instituicao", label: "Exchange / carteira" }],
  "99": [{ key: "instituicao", label: "Instituição" }, { key: "cnpj", label: "CNPJ" }],
};
export const FIELDS_DEBT: IrpfField[] = [{ key: "instituicao", label: "Credor" }, { key: "cnpj", label: "CNPJ/CPF do credor" }];

/** Campos EXTRA de um bem vendido/alienado (a coluna do ano-base já é 0; isto vai à discriminação). */
export const DISPOSAL_FIELDS: IrpfField[] = [
  { key: "dataVenda", label: "Data da venda" },
  { key: "valorVenda", label: "Valor da venda" },
  { key: "comprador", label: "Comprador (nome e CPF/CNPJ)", wide: true },
];

/** Campos do item — sempre começa por "Nome/descrição" (que alimenta a discriminação), + os do grupo. */
export function fieldsFor(kind: "asset" | "debt", group: string): IrpfField[] {
  const base = kind === "debt" ? FIELDS_DEBT : (FIELDS_BY_GROUP[group] ?? FIELDS_BY_GROUP["99"]);
  return [{ key: "nome", label: kind === "debt" ? "Nome da dívida" : "Nome / descrição", wide: true }, ...base];
}

/** Frase da alienação anexada à discriminação de um bem vendido — NUNCA inventa comprador. */
export function saleSuffix(f: Record<string, string>): string {
  const parts = [
    f.dataVenda?.trim() ? `alienado em ${f.dataVenda.trim()}` : "alienado no ano",
    f.valorVenda?.trim() ? `por ${f.valorVenda.trim()}` : "",
    `comprador ${f.comprador?.trim() || "[nome e CPF/CNPJ]"}`,
  ].filter(Boolean);
  return ` — VENDIDO: ${parts.join(", ")}. Apurar ganho de capital (GCAP) com o contador.`;
}

/** Monta a discriminação a partir dos campos — lacunas explícitas [campo] pro que falta, NUNCA inventa.
 *  Lê o nome de `f.nome` (ou do parâmetro). É o que o seed E a edição ao vivo usam (fonte única). */
export function composeDiscriminacao(kind: "asset" | "debt", group: string, f: Record<string, string>, name = ""): string {
  const g = (k: string, ph: string) => (f[k]?.trim() ? f[k].trim() : `[${ph}]`);
  const nm = (name || f.nome || "").trim();
  // Bem alienado: anexa a história da venda ao texto normal do bem (a coluna do ano-base já é 0).
  const sold = f.dataVenda != null ? saleSuffix(f) : "";
  if (kind === "debt") return `${nm || "Dívida"} — credor ${g("instituicao", "credor")}, CNPJ/CPF ${g("cnpj", "CNPJ/CPF")}`;
  return baseDiscriminacao(group, nm, f, g) + sold;
}

function baseDiscriminacao(group: string, nm: string, f: Record<string, string>, g: (k: string, ph: string) => string): string {
  switch (group) {
    case "01": return `${nm || "Imóvel"} — endereço ${g("endereco", "endereço")}, matrícula ${g("matricula", "matrícula")}${f.area?.trim() ? `, ${f.area.trim()} m²` : ""}`;
    case "02": return `${nm || "Bem"} — identificação ${g("identificacao", "placa/RENAVAM/chassi")}`;
    case "03": return `${g("quantidade", "qtd")} ações ${f.ticker?.trim() || nm || "[ticker]"}, CNPJ ${g("cnpj", "CNPJ")} — custódia em ${g("instituicao", "corretora")}`;
    case "06": return `Saldo em ${f.banco?.trim() || f.instituicao?.trim() || nm || "conta"} — ag. ${g("agencia", "agência")}, conta ${g("conta", "conta")}, CNPJ ${g("cnpj", "CNPJ")}`;
    case "07": return `${f.quantidade?.trim() ? f.quantidade.trim() + " cotas do " : ""}${nm || "fundo"}${f.ticker?.trim() ? ` (${f.ticker.trim()})` : ""}, CNPJ ${g("cnpj", "CNPJ")} — administrador ${g("instituicao", "administrador")}`;
    case "08": return `${nm || "Criptoativo"}${f.quantidade?.trim() ? ` — ${f.quantidade.trim()} unidades` : ""} — custódia em ${g("instituicao", "exchange/carteira")}`;
    default: return `${nm || "Bem"} — ${g("instituicao", "instituição")}, CNPJ ${g("cnpj", "CNPJ")}`; // 04, 05, 99
  }
}

/** Classes declaradas pelo CUSTO de aquisição (não pelo valor de mercado do dia). */
const COST_BASED = new Set<string>([CLASS.acoes, CLASS.fiis, CLASS.privateEquity, CLASS.cripto, CLASS.commodities, CLASS.imoveis, CLASS.bens]);

/**
 * Mapeador REAL do seed: classe → grupo/código + discriminação por template. Bens no exterior
 * guardam a moeda de origem + o país; o valor em BRL fica MANUAL (a UI mostra o aviso da regra —
 * custo de aquisição na data da compra, que o app não auto-calcula).
 */
/** Bem vendido/baixado NO ano-base (disposedOn no mesmo ano). */
const soldInYear = (a: Asset, baseYear: number) => a.disposedOn != null && Number(a.disposedOn.slice(0, 4)) === baseYear;

export const irpfSeedMapper: TaxSeedMapper = {
  asset: (a, baseYear) => {
    const { group, code } = SUBTYPE_TO_CODE[a.subtypeId ?? ""] ?? CLASS_TO_CODE[a.classId] ?? { group: "99", code: "99" };
    const fields: Record<string, string> = { nome: a.name };
    if (a.ticker) fields.ticker = a.ticker;
    if (a.quantity != null) fields.quantidade = String(a.quantity);
    if (a.institution) fields.instituicao = a.institution;
    if (a.acquiredOn) fields.dataAquisicao = a.acquiredOn;
    // Vendido no ano-base: coluna de 31/12 do ano-base = 0 (não se possui mais); a do ano anterior
    // fica o custo; a discriminação conta a venda; alerta de ganho de capital (o app NÃO calcula).
    const sold = soldInYear(a, baseYear);
    if (sold) {
      fields.dataVenda = a.disposedOn!;
      if (a.disposalValue != null) fields.valorVenda = String(a.disposalValue);
    }
    // Classes de CUSTO (ações, FIIs, imóveis, cripto…) declaram o valor APLICADO — que é o do IRPF.
    // Quando o app tem esse custo, usa ele e NÃO marca "revisar" (já é o valor certo). Nas demais
    // (conta, renda fixa) usa o saldo atual e marca "revisar" (confira se é o de 31/12).
    const useCost = COST_BASED.has(a.classId) && a.cost != null && a.cost > 0;
    return {
      id: `irpf-${baseYear}-a-${a.id}`,
      baseYear,
      kind: "asset",
      group,
      code,
      discriminacao: composeDiscriminacao("asset", group, fields, a.name),
      currency: a.currency,
      valorAnoBase: sold ? 0 : useCost ? a.cost! : a.amount,
      valorAnoAnterior: sold ? a.cost : undefined,
      disposed: sold || undefined,
      needsReview: sold ? false : !useCost,
      country: a.regionId,
      institution: a.institution,
      fields,
      source: "seed-asset",
      sourceId: a.id,
    };
  },
  debt: (l: Liability, baseYear) => ({
    id: `irpf-${baseYear}-l-${l.id}`,
    baseYear,
    kind: "debt",
    group: "",
    code: LIABILITY_TO_CODE[l.typeId] ?? "16",
    discriminacao: composeDiscriminacao("debt", "", { nome: l.name }, l.name),
    currency: l.currency,
    valorAnoBase: l.amount,
    needsReview: true,
    fields: { nome: l.name },
    source: "seed-liability",
    sourceId: l.id,
  }),
};

/** Aplica o tratamento de VENDA a um item já existente (ex.: veio do roll-forward e o bem foi vendido
 *  este ano): zera a coluna do ano-base, mantém a do ano anterior como base (custo), anexa a venda à
 *  discriminação e marca disposed. Preserva a discriminação se o usuário a travou editando à mão. */
export function applyDisposal(item: TaxItem, asset: Asset): TaxItem {
  const fields: Record<string, string> = { ...item.fields, dataVenda: asset.disposedOn ?? item.fields.dataVenda ?? "" };
  if (asset.disposalValue != null) fields.valorVenda = String(asset.disposalValue);
  return {
    ...item,
    disposed: true,
    valorAnoBase: 0,
    valorAnoAnterior: item.valorAnoAnterior ?? item.valorAnoBase ?? asset.cost,
    needsReview: false,
    fields,
    discriminacao: item.discriminacaoLocked ? item.discriminacao : composeDiscriminacao(item.kind, item.group, fields),
  };
}

/** Itens JÁ na lista cujo bem de origem foi vendido este ano mas ainda não estão marcados como
 *  vendidos (ex.: rolaram do ano anterior e a venda aconteceu depois) → versões já com o tratamento. */
export function findUnmarkedDisposals(items: TaxItem[], assets: Asset[], baseYear: number): TaxItem[] {
  const sold = new Map(assets.filter((a) => soldInYear(a, baseYear)).map((a) => [a.id, a]));
  return items
    .filter((i) => !i.disposed && i.sourceId != null && sold.has(i.sourceId))
    .map((i) => applyDisposal(i, sold.get(i.sourceId!)!));
}
