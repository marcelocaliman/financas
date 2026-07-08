import { CLASS, LIABILITY_TYPE } from "@/domain/taxonomy";
import type { Asset, Liability } from "@/domain/types";
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

const inst = (i?: string) => i ?? "[preencher: instituição]";
const cnpj = (f: Record<string, string>) => f.cnpj ?? "[preencher: CNPJ]";

/** Discriminação inicial por grupo — pronta pra copiar, com lacunas EXPLÍCITAS ([preencher: …]).
 *  NUNCA inventa CNPJ/dados; o usuário completa 2–3 campos e o texto fica redondo. */
function discriminacaoAsset(a: Asset, group: string, f: Record<string, string>): string {
  const qtd = f.quantidade;
  const tkr = f.ticker;
  switch (group) {
    case "06": return `Saldo em conta em ${inst(a.institution)} — ag. [preencher], conta [preencher], CNPJ ${cnpj(f)}`;
    case "03": return `${qtd ?? "[preencher: qtd]"} ações ${tkr ?? a.name}, CNPJ ${cnpj(f)} — custódia em ${inst(a.institution)}`;
    case "07": return `${qtd ? qtd + " cotas do " : ""}${a.name}${tkr ? ` (${tkr})` : ""}, CNPJ ${cnpj(f)} — administrador ${inst(a.institution)}`;
    case "08": return `${a.name}${qtd ? ` — ${qtd} unidades` : ""} — custódia em ${a.institution ?? "[preencher: exchange/carteira]"}`;
    case "01": return `${a.name} — endereço [preencher], matrícula [preencher], área [preencher]`;
    case "02": return `${a.name} — identificação (placa/RENAVAM/chassi) [preencher]`;
    default: return `${a.name} — ${inst(a.institution)}, CNPJ ${cnpj(f)}`; // 04, 99, demais
  }
}

/**
 * Mapeador REAL do seed: classe → grupo/código + discriminação por template. Bens no exterior
 * guardam a moeda de origem + o país; o valor em BRL fica MANUAL (a UI mostra o aviso da regra —
 * custo de aquisição na data da compra, que o app não auto-calcula).
 */
export const irpfSeedMapper: TaxSeedMapper = {
  asset: (a, baseYear) => {
    const { group, code } = CLASS_TO_CODE[a.classId] ?? { group: "99", code: "99" };
    const fields: Record<string, string> = {};
    if (a.ticker) fields.ticker = a.ticker;
    if (a.quantity != null) fields.quantidade = String(a.quantity);
    return {
      id: `irpf-${baseYear}-a-${a.id}`,
      baseYear,
      kind: "asset",
      group,
      code,
      discriminacao: discriminacaoAsset(a, group, fields),
      currency: a.currency,
      valorAnoBase: a.amount,
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
    discriminacao: `${l.name} — credor [preencher: instituição], CNPJ/CPF do credor [preencher]`,
    currency: l.currency,
    valorAnoBase: l.amount,
    fields: {},
    source: "seed-liability",
    sourceId: l.id,
  }),
};
