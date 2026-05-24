/**
 * Códigos da Receita Federal para a declaração IRPF.
 *
 * Fonte: Perguntão IRPF (Receita Federal, edições anuais) + tabela de
 * códigos do programa IRPF. Códigos costumam ser estáveis ano-a-ano,
 * mas confira o leiaute do ano corrente antes de transmitir.
 */

import type { AccountType, AssetType, PhysicalAssetCategory } from "@/types/database";

// ============================================================================
// Bens e Direitos (Ficha "Bens e Direitos")
// ============================================================================
// Grupos novos do leiaute 2024+:
//   01 Imóveis | 02 Bens móveis | 03 Veículos/aeronaves/embarcações
//   04 Aplicações em Renda Variável | 05 Aplicações em Renda Fixa
//   06 Depósito à vista e numerário | 07 Fundos
//   08 Criptoativos | 09 Outros bens
// Códigos internos vão dentro do grupo. Esquema antigo (sem grupo) ainda
// aceito no programa pra retroatividade.

export type BemCode = {
  /** Código numérico Receita (2 dígitos) */
  code: string;
  /** Descrição oficial */
  label: string;
  /** Grupo Receita 2024+ (2 dígitos) */
  group: string;
  /** Discriminação livre — o que pôr no campo (template) */
  discriminationHint?: string;
};

/** Catálogo dos códigos mais comuns pra pessoa física */
export const BEM_CODES: Record<string, BemCode> = {
  // Grupo 01 — Imóveis
  "11": { code: "11", label: "Apartamento", group: "01",
    discriminationHint: "Endereço, matrícula, cartório, % de participação" },
  "12": { code: "12", label: "Casa", group: "01",
    discriminationHint: "Endereço, matrícula, cartório, % de participação" },
  "13": { code: "13", label: "Terreno", group: "01" },
  "14": { code: "14", label: "Terra nua", group: "01" },
  "15": { code: "15", label: "Sala / conjunto", group: "01" },
  "19": { code: "19", label: "Outros bens imóveis", group: "01" },

  // Grupo 02 — Bens móveis
  "21": { code: "21", label: "Veículo automotor terrestre (carro/moto)", group: "02",
    discriminationHint: "Marca, modelo, ano, placa, RENAVAM" },
  "22": { code: "22", label: "Aeronave", group: "02" },
  "23": { code: "23", label: "Embarcação", group: "02" },
  "25": { code: "25", label: "Joia, quadro, objeto de arte, antiguidade", group: "02" },
  "26": { code: "26", label: "Linha telefônica", group: "02" },
  "29": { code: "29", label: "Outros bens móveis", group: "02" },

  // Grupo 04 — Aplicações em Renda Variável
  "31": { code: "31", label: "Ações (inclusive listadas em bolsa)", group: "04",
    discriminationHint: "Ticker, qtd, custo médio. CNPJ da empresa." },
  "32": { code: "32", label: "Quotas ou quinhões de capital", group: "04" },
  "39": { code: "39", label: "Outras participações societárias", group: "04" },
  "73": { code: "73", label: "Fundo de Investimento Imobiliário (FII)", group: "04",
    discriminationHint: "Ticker, qtd, custo médio. CNPJ do fundo." },
  "74": { code: "74", label: "ETF", group: "04",
    discriminationHint: "Ticker, qtd, custo médio. CNPJ do fundo." },

  // Grupo 05 — Aplicações em Renda Fixa
  "45": { code: "45", label: "Caderneta de poupança", group: "06",
    discriminationHint: "Banco, agência, nº conta. CNPJ da instituição." },
  "46": { code: "46", label: "Ouro / ativo financeiro", group: "04" },
  "47": { code: "47", label: "Mercado financeiro (CDB, RDB, Letras)", group: "05",
    discriminationHint: "Banco/emissor, CNPJ, descrição (CDB Itaú 110% CDI)." },
  "48": { code: "48", label: "Aplicação em títulos públicos (Tesouro Direto)", group: "05",
    discriminationHint: "Tipo do título (Tesouro Selic, IPCA+ etc), vencimento." },
  "49": { code: "49", label: "Outras aplicações renda fixa (LCI/LCA/CRI/CRA)", group: "05",
    discriminationHint: "Tipo, banco/emissor, CNPJ." },

  // Grupo 06 — Depósito à vista
  "61": { code: "61", label: "Depósito em conta corrente / conta-pagamento", group: "06",
    discriminationHint: "Banco, agência, nº conta. CNPJ da instituição." },
  "62": { code: "62", label: "Conta em moeda estrangeira (no exterior)", group: "06",
    discriminationHint: "País, banco, conta, moeda." },
  "63": { code: "63", label: "Dinheiro em espécie — moeda nacional", group: "06" },
  "64": { code: "64", label: "Dinheiro em espécie — moeda estrangeira", group: "06" },

  // Grupo 07 — Fundos
  "71": { code: "71", label: "Fundo de Renda Fixa (longo/curto prazo)", group: "07" },
  "72": { code: "72", label: "Fundo de Ações", group: "07" },
  "75": { code: "75", label: "Fundo Multimercado", group: "07" },
  "79": { code: "79", label: "Outros fundos", group: "07" },

  // Grupo 08 — Criptoativos
  "81": { code: "81", label: "Criptoativo Bitcoin (BTC)", group: "08" },
  "82": { code: "82", label: "Criptoativos categoria Altcoins (ETH, ADA…)", group: "08" },
  "83": { code: "83", label: "Criptoativos categoria Stablecoins (USDT, USDC…)", group: "08" },
  "89": { code: "89", label: "Outros criptoativos", group: "08" },

  // Grupo 09 — Outros bens
  "91": { code: "91", label: "Plano de previdência PGBL (tributação completa)", group: "09" },
  "92": { code: "92", label: "VGBL", group: "09" },
  "97": { code: "97", label: "Direitos / crédito a receber", group: "09" },
  "99": { code: "99", label: "Outros bens e direitos", group: "09" },
};

/**
 * Inferência automática de código Receita pra contas bancárias.
 */
export function inferAccountCode(type: AccountType): string {
  switch (type) {
    case "checking":
      return "61";
    case "savings":
      return "45";
    case "cash":
      return "63";
    case "investment":
      return "47"; // sub-conta de corretora, usuário pode editar
    case "credit_card":
      return ""; // cartão de crédito NÃO é bem (pode ser passivo, fora da declaração)
  }
}

/**
 * Inferência pra ativos (investments).
 * Fixed income público (Tesouro) → 48; privado (CDB/LCI/LCA) → 47/49; ações → 31; FII → 73; ETF → 74; crypto → 81/82/83.
 */
export function inferInvestmentCode(
  assetType: AssetType,
  taxRegime: "regressive" | "exempt" | string,
  ticker?: string,
): string {
  switch (assetType) {
    case "fixed_income_public":
      return "48";
    case "fixed_income_private":
      // LCI/LCA/CRI/CRA isentos → 49; CDB/RDB tributados → 47
      return taxRegime === "exempt" ? "49" : "47";
    case "stock":
      return "31";
    case "fii":
      return "73";
    case "etf":
      return "74";
    case "crypto": {
      const t = (ticker ?? "").toUpperCase();
      if (t.startsWith("BTC")) return "81";
      if (["USDT", "USDC", "DAI", "BUSD"].some((s) => t.startsWith(s))) return "83";
      return "82";
    }
    case "option":
      return "99"; // opções não têm código próprio de Bens (são fluxo, não saldo)
  }
}

export function inferPhysicalCode(category: PhysicalAssetCategory): string {
  switch (category) {
    case "real_estate":
      return "11"; // apto (padrão; usuário pode editar pra 12=casa/13=terreno)
    case "vehicle":
      return "21";
    case "electronics":
    case "furniture":
    case "tools":
      return "29";
    case "jewelry":
    case "art":
      return "25";
    case "other":
      return "99";
  }
}

// ============================================================================
// Rendimentos Isentos (códigos da Ficha "Rendimentos Isentos e Não Tributáveis")
// ============================================================================
// Os mais comuns:
//   09 Lucros e dividendos recebidos
//   12 Rendimentos de poupança e LCI/LCA/CRI/CRA
//   13 Capital das apólices de seguros / pecúlio
//   24 Outros (descreva)

export const RENDIMENTO_ISENTO_CODES: Record<string, string> = {
  "09": "Lucros e dividendos recebidos",
  "10": "Valor do trabalho assalariado em moeda estrangeira (servidores no exterior)",
  "12": "Rendimento de caderneta de poupança e LCI/LCA/CRI/CRA",
  "13": "Capital das apólices de seguros / pecúlio",
  "14": "Transferências patrimoniais — meação e dissolução",
  "18": "Incorporação de reservas ao capital (bonificação)",
  "20": "Ganhos líquidos em renda variável (operações até R$ 20k/mês em ações)",
  "21": "Restituição de IR de anos anteriores",
  "22": "Outras isenções (especificar)",
  "24": "Bolsas de estudo (pesquisa, professor)",
  "26": "Doações e heranças",
  "99": "Outros",
};

// ============================================================================
// Rendimentos sujeitos a tributação EXCLUSIVA na fonte
// ============================================================================
export const RENDIMENTO_EXCLUSIVO_CODES: Record<string, string> = {
  "01": "13º salário",
  "06": "Rendimentos de aplicações financeiras (CDB, FII rendimentos, etc)",
  "08": "Participação nos lucros (PLR)",
  "10": "Juros sobre Capital Próprio (JCP)",
  "12": "Ganhos líquidos em renda variável (acima da isenção)",
  "99": "Outros",
};

// ============================================================================
// Pagamentos Efetuados — códigos da ficha
// ============================================================================
import type { IRDeductibleKind } from "@/types/database";

export const PAGAMENTO_CODES: Record<IRDeductibleKind, { code: string; label: string }> = {
  plano_saude: { code: "26", label: "Planos de saúde / Seguro saúde" },
  hospital: { code: "10", label: "Despesas com hospital, exames laboratoriais" },
  medico: { code: "11", label: "Médico no Brasil" },
  dentista: { code: "12", label: "Dentista no Brasil" },
  psicologo: { code: "17", label: "Psicólogo no Brasil" },
  outros_saude: { code: "13", label: "Outros profissionais de saúde" },
  educacao_titular: { code: "01", label: "Instrução do contribuinte" },
  educacao_dependente: { code: "02", label: "Instrução de dependente" },
  inss_titular: { code: "50", label: "Previdência Social — pago pelo titular" },
  inss_domestico: { code: "51", label: "Previdência Social — empregado doméstico" },
  pgbl: { code: "36", label: "Contribuição a entidade aberta de previdência (PGBL)" },
  previdencia_privada: { code: "37", label: "Outras contribuições previdência privada" },
  pensao_alimenticia: { code: "30", label: "Pensão alimentícia judicial" },
  doacao_eca: { code: "40", label: "Doações ao Estatuto da Criança e Adolescente" },
  doacao_cultural: { code: "44", label: "Doações culturais / Lei Rouanet" },
  outros: { code: "99", label: "Outros (especificar)" },
};

// ============================================================================
// CNPJ conhecidos das instituições financeiras BR — atalho pra autopreencher
// ============================================================================
export const KNOWN_BANK_CNPJS: Record<string, string> = {
  // Bancos
  "Itaú Unibanco": "60.701.190/0001-04",
  "Itaú": "60.701.190/0001-04",
  "Banco do Brasil": "00.000.000/0001-91",
  "Bradesco": "60.746.948/0001-12",
  "Santander": "90.400.888/0001-42",
  "Caixa Econômica Federal": "00.360.305/0001-04",
  "Caixa": "00.360.305/0001-04",
  "Nubank": "18.236.120/0001-58",
  "Nu Pagamentos": "18.236.120/0001-58",
  "Inter": "00.416.968/0001-01",
  "C6 Bank": "31.872.495/0001-72",
  "Banco Original": "92.894.922/0001-08",
  "Banco PAN": "59.285.411/0001-13",
  "BTG Pactual": "30.306.294/0001-45",
  "Safra": "58.160.789/0001-28",
  "Sicoob": "02.038.232/0001-64",
  "Sicredi": "03.046.391/0001-73",
  // Corretoras
  "XP Investimentos": "02.332.886/0001-04",
  "XP": "02.332.886/0001-04",
  "Rico": "13.434.335/0001-60",
  "Clear": "02.658.435/0001-37",
  "Modal": "30.722.287/0001-03",
  "Genial": "27.652.684/0001-62",
  "Toro": "29.162.769/0001-98",
  "ÁGORA": "74.014.747/0001-35",
  "Easynvest / NuInvest": "62.169.875/0001-79",
  "NuInvest": "62.169.875/0001-79",
  "Avenue": "33.892.501/0001-66",
  "Warren": "92.875.780/0001-31",
  "Órama": "13.293.225/0001-25",
};

/**
 * Tenta achar CNPJ pelo nome da instituição. Match case-insensitive
 * e substring (ex.: "Banco Itaú S.A." casa com "Itaú").
 */
export function lookupBankCNPJ(institution: string): string | null {
  if (!institution) return null;
  const norm = institution.toLowerCase();
  for (const [name, cnpj] of Object.entries(KNOWN_BANK_CNPJS)) {
    if (norm.includes(name.toLowerCase())) return cnpj;
  }
  return null;
}
