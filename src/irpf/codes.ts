// Tabela CANÔNICA de grupos e códigos do IRPF — Bens e Direitos + Dívidas e Ônus Reais.
// Reflete o layout do DIRPF 2026 (ano-base 2025), o último publicado — fontes oficiais: manual MIR
// (gov.br/receitafederal .../manual-mir/patrimonio) e "Perguntas e Respostas IRPF 2026" da Receita.
// OS CÓDIGOS MUDAM POR EXERCÍCIO → conferir contra o layout oficial antes de cada temporada. O motor
// lê ESTA tabela; ela é a fonte da verdade (e o que o usuário/contador confere).

export const CODES_LAYOUT = "DIRPF 2026 (ano-base 2025)";

export interface IrpfCode {
  code: string;
  name: string;
}
export interface IrpfGroup {
  group: string; // "01".."99"
  name: string;
  codes: IrpfCode[];
}

/** Ficha "Bens e Direitos" — grupos e códigos. */
export const BENS_GROUPS: IrpfGroup[] = [
  { group: "01", name: "Bens Imóveis", codes: [
    { code: "11", name: "Apartamento" },
    { code: "12", name: "Casa" },
    { code: "13", name: "Terreno" },
    { code: "14", name: "Imóvel rural" },
    { code: "15", name: "Sala ou conjunto" },
    { code: "19", name: "Garagem avulsa" },
    { code: "99", name: "Outros bens imóveis" },
  ] },
  { group: "02", name: "Bens Móveis", codes: [
    { code: "01", name: "Veículo automotor terrestre (carro, moto, caminhão)" },
    { code: "02", name: "Aeronave" },
    { code: "03", name: "Embarcação" },
    { code: "05", name: "Quadro, objeto de arte, de coleção, antiguidade" },
    { code: "06", name: "Joia" },
    { code: "99", name: "Outros bens móveis" },
  ] },
  { group: "03", name: "Participações Societárias", codes: [
    { code: "01", name: "Ações (inclusive as listadas em bolsa)" },
    { code: "02", name: "Quotas ou quinhões de capital" },
    { code: "99", name: "Outras participações societárias" },
  ] },
  { group: "04", name: "Aplicações e Investimentos", codes: [
    { code: "01", name: "Depósito em conta poupança" },
    { code: "02", name: "Títulos públicos e privados sujeitos à tributação (Tesouro Direto, CDB, RDB e outros)" },
    { code: "03", name: "Títulos isentos de tributação (LCI, LCA, CRI, CRA, debêntures de infraestrutura e outros)" },
    { code: "04", name: "Ativos negociados em bolsa no Brasil (exceto ações e fundos)" },
    { code: "05", name: "Ouro, ativo financeiro" },
    { code: "99", name: "Outras aplicações e investimentos" },
  ] },
  { group: "05", name: "Créditos", codes: [
    { code: "01", name: "Empréstimos concedidos" },
    { code: "02", name: "Crédito decorrente de alienação" },
    { code: "99", name: "Outros créditos" },
  ] },
  { group: "06", name: "Depósitos à Vista e Numerário", codes: [
    { code: "01", name: "Depósito em conta-corrente ou conta pagamento" },
    { code: "10", name: "Dinheiro em espécie — moeda nacional" },
    { code: "11", name: "Dinheiro em espécie — moeda estrangeira" },
    { code: "99", name: "Outros depósitos à vista" },
  ] },
  { group: "07", name: "Fundos", codes: [
    { code: "01", name: "Fundos de investimento sujeitos à tributação periódica (come-cotas)" },
    { code: "03", name: "Fundos de Investimento Imobiliário (FII)" },
    { code: "04", name: "Fundos de Investimento em Ações e Fundos Mútuos de Privatização" },
    { code: "06", name: "FIP, FIDC, ETF" },
    { code: "13", name: "Fundo multimercado" },
    { code: "99", name: "Fundos de investimento no exterior" },
  ] },
  { group: "08", name: "Criptoativos", codes: [
    { code: "01", name: "Bitcoin (BTC)" },
    { code: "02", name: "Altcoins (outras criptomoedas)" },
    { code: "03", name: "Stablecoins" },
    { code: "10", name: "NFTs" },
    { code: "99", name: "Outros criptoativos" },
  ] },
  { group: "99", name: "Outros Bens e Direitos", codes: [
    { code: "06", name: "VGBL — Vida Gerador de Benefício Livre" },
    { code: "07", name: "Juros sobre capital próprio creditado, mas não pago" },
    { code: "99", name: "Outros bens e direitos" },
  ] },
];

/** Ficha "Dívidas e Ônus Reais" — só códigos (não tem grupo). */
export const DIVIDAS_CODES: IrpfCode[] = [
  { code: "11", name: "Estabelecimento bancário comercial" },
  { code: "12", name: "Sociedades de crédito, financiamento e investimento" },
  { code: "13", name: "Outras pessoas jurídicas" },
  { code: "14", name: "Pessoas físicas" },
  { code: "15", name: "Empréstimos contraídos no exterior" },
  { code: "16", name: "Outras dívidas e ônus reais" },
];

const bensByGroup = new Map(BENS_GROUPS.map((g) => [g.group, g]));

/** Nome oficial do grupo de Bens ("" p/ dívidas). */
export function groupName(group: string): string {
  return bensByGroup.get(group)?.name ?? "";
}

/** Nome oficial de um código. `kind:"debt"` busca na ficha de dívidas (ignora o grupo). */
export function codeName(group: string, code: string, kind: "asset" | "debt" = "asset"): string {
  const list = kind === "debt" ? DIVIDAS_CODES : (bensByGroup.get(group)?.codes ?? []);
  return list.find((c) => c.code === code)?.name ?? "";
}

/** Um bem é do exterior pela MOEDA (≠ BRL) — gatilho da valoração especial (custo na data da compra). */
export function isForeignCurrency(currency: string): boolean {
  return currency !== "BRL";
}
