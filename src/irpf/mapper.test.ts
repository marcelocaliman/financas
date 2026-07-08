import { describe, it, expect } from "vitest";
import { irpfSeedMapper } from "./mapper";
import { codeName, groupName, isForeignCurrency, DIVIDAS_CODES } from "./codes";
import { buildSeedTaxItems } from "@/finance/irpf-seed";
import type { Asset, Liability } from "@/domain/types";

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: "a1", name: "Ativo", classId: "acoes", currency: "BRL", amount: 1000, ...over,
});
const liab = (over: Partial<Liability> = {}): Liability => ({
  id: "l1", name: "Financiamento do apê", typeId: "financiamento-imobiliario", currency: "BRL", amount: 200000, ...over,
});

describe("irpfSeedMapper (classe → código oficial)", () => {
  it("mapeia as pegadinhas corretamente", () => {
    const g = (classId: string) => {
      const it = irpfSeedMapper.asset(asset({ classId }), 2025);
      return `${it.group}/${it.code}`;
    };
    expect(g("acoes")).toBe("03/01");        // Participações Societárias, NÃO 04
    expect(g("renda-fixa")).toBe("04/02");   // títulos tributáveis
    expect(g("fiis")).toBe("07/03");         // FII em Fundos
    expect(g("multimercado")).toBe("07/13");
    expect(g("cripto")).toBe("08/01");       // Bitcoin
    expect(g("caixa")).toBe("06/01");        // conta-corrente
    expect(g("previdencia")).toBe("99/06");  // VGBL
    expect(g("commodities")).toBe("04/05");  // ouro
    expect(g("imoveis")).toBe("01/12");
  });

  it("classe desconhecida cai em 99/99 (Outros)", () => {
    const it = irpfSeedMapper.asset(asset({ classId: "inexistente" }), 2025);
    expect(`${it.group}/${it.code}`).toBe("99/99");
  });

  it("bem no exterior guarda moeda de origem + país e NÃO tem BRL calculado", () => {
    const it = irpfSeedMapper.asset(asset({ classId: "acoes", currency: "USD", regionId: "eua", amount: 5000 }), 2025);
    expect(it.currency).toBe("USD");
    expect(it.country).toBe("eua");
    expect(it.valorAnoBase).toBe(5000);           // na moeda de origem
    expect(it.valorBrlAnoBase).toBeUndefined();   // BRL é sempre manual
    expect(isForeignCurrency(it.currency)).toBe(true);
  });

  it("discriminação tem lacunas explícitas e nunca inventa CNPJ", () => {
    const it = irpfSeedMapper.asset(asset({ classId: "caixa", institution: "Nubank" }), 2025);
    expect(it.discriminacao).toContain("Nubank");
    expect(it.discriminacao).toContain("[preencher: CNPJ]");
  });

  it("passivo vira ficha de Dívidas com o código do tipo", () => {
    const it = irpfSeedMapper.debt(liab(), 2025);
    expect(it.kind).toBe("debt");
    expect(it.code).toBe("11"); // estabelecimento bancário
    expect(it.valorAnoBase).toBe(200000);
  });

  it("o mapeador real pluga no motor de seed sem mudar a idempotência", () => {
    const out = buildSeedTaxItems(2025, [asset({ classId: "fiis" })], [liab()], [], irpfSeedMapper);
    expect(out).toHaveLength(2);
    expect(out.find((i) => i.kind === "asset")?.group).toBe("07");
  });
});

describe("tabela de códigos", () => {
  it("nomes oficiais batem", () => {
    expect(groupName("03")).toBe("Participações Societárias");
    expect(codeName("03", "01")).toBe("Ações (inclusive as listadas em bolsa)");
    expect(codeName("99", "06")).toContain("VGBL");
    expect(codeName("", "11", "debt")).toBe("Estabelecimento bancário comercial");
  });
  it("ficha de dívidas tem os 6 códigos oficiais", () => {
    expect(DIVIDAS_CODES.map((c) => c.code)).toEqual(["11", "12", "13", "14", "15", "16"]);
  });
});
