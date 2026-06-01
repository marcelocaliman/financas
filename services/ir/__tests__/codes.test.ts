import { describe, it, expect } from "vitest";
import {
  inferAccountCode,
  inferInvestmentCode,
  inferPhysicalCode,
  lookupBankCNPJ,
  BEM_CODES,
  PAGAMENTO_CODES,
} from "@/services/ir/codes";

describe("inferAccountCode", () => {
  it("checking → 61 (conta corrente)", () => {
    expect(inferAccountCode("checking")).toBe("61");
  });
  it("savings → 45 (poupança)", () => {
    expect(inferAccountCode("savings")).toBe("45");
  });
  it("cash → 63 (dinheiro em espécie)", () => {
    expect(inferAccountCode("cash")).toBe("63");
  });
  it("investment → 61 (caixa em corretora vai pra Grupo 06 numerário, não código 47 que é CDB)", () => {
    expect(inferAccountCode("investment")).toBe("61");
  });
  it("credit_card → vazio (não é bem)", () => {
    expect(inferAccountCode("credit_card")).toBe("");
  });
});

describe("inferInvestmentCode", () => {
  it("Tesouro Direto → 48", () => {
    expect(inferInvestmentCode("fixed_income_public", "regressive")).toBe("48");
  });
  it("CDB → 47", () => {
    expect(inferInvestmentCode("fixed_income_private", "regressive")).toBe("47");
  });
  it("LCI/LCA (exempt) → 49", () => {
    expect(inferInvestmentCode("fixed_income_private", "exempt")).toBe("49");
  });
  it("Ação → 31", () => {
    expect(inferInvestmentCode("stock", "regressive")).toBe("31");
  });
  it("FII → 73", () => {
    expect(inferInvestmentCode("fii", "regressive")).toBe("73");
  });
  it("ETF → 74", () => {
    expect(inferInvestmentCode("etf", "regressive")).toBe("74");
  });
  it("Crypto BTC → 81", () => {
    expect(inferInvestmentCode("crypto", "regressive", "BTC")).toBe("81");
  });
  it("Crypto USDT → 83 (stablecoin)", () => {
    expect(inferInvestmentCode("crypto", "regressive", "USDT")).toBe("83");
  });
  it("Crypto ETH (default altcoin) → 82", () => {
    expect(inferInvestmentCode("crypto", "regressive", "ETH")).toBe("82");
  });
});

describe("inferPhysicalCode", () => {
  it("imóvel → 11 (apartamento default)", () => {
    expect(inferPhysicalCode("real_estate")).toBe("11");
  });
  it("veículo → 21", () => {
    expect(inferPhysicalCode("vehicle")).toBe("21");
  });
  it("joia/arte → 25", () => {
    expect(inferPhysicalCode("jewelry")).toBe("25");
    expect(inferPhysicalCode("art")).toBe("25");
  });
  it("outros bens → 29 ou 99", () => {
    expect(inferPhysicalCode("electronics")).toBe("29");
    expect(inferPhysicalCode("other")).toBe("99");
  });
});

describe("lookupBankCNPJ", () => {
  it("encontra Itaú em substring case-insensitive", () => {
    expect(lookupBankCNPJ("Banco Itaú S.A.")).toBe("60.701.190/0001-04");
    expect(lookupBankCNPJ("ITAU UNIBANCO")).toBe("60.701.190/0001-04");
  });
  it("encontra Nubank", () => {
    expect(lookupBankCNPJ("Nubank")).toBe("18.236.120/0001-58");
  });
  it("encontra XP", () => {
    expect(lookupBankCNPJ("XP Investimentos S/A")).toBe("02.332.886/0001-04");
  });
  it("retorna null pra instituição desconhecida", () => {
    expect(lookupBankCNPJ("Banco Imaginário XYZ")).toBeNull();
  });
  it("retorna null pra vazio", () => {
    expect(lookupBankCNPJ("")).toBeNull();
  });
});

describe("BEM_CODES catálogo", () => {
  it("tem códigos críticos definidos", () => {
    expect(BEM_CODES["11"].label).toContain("Apartamento");
    expect(BEM_CODES["31"].label).toContain("Ações");
    expect(BEM_CODES["47"].label).toContain("CDB");
    expect(BEM_CODES["73"].label).toContain("FII");
    expect(BEM_CODES["61"].label).toContain("Depósito em conta corrente");
  });
  it("todos têm grupo de 2 dígitos", () => {
    for (const code of Object.values(BEM_CODES)) {
      expect(code.group).toMatch(/^\d{2}$/);
    }
  });

  it("grupos seguem o leiaute 2024+ (correção da auditoria)", () => {
    // Participações societárias → 03 (antes 04)
    expect(BEM_CODES["31"].group).toBe("03");
    expect(BEM_CODES["32"].group).toBe("03");
    expect(BEM_CODES["39"].group).toBe("03");
    // Aplicações e investimentos → 04 (renda fixa antes em 05)
    expect(BEM_CODES["47"].group).toBe("04");
    expect(BEM_CODES["48"].group).toBe("04");
    expect(BEM_CODES["49"].group).toBe("04");
    // Fundos (FII/ETF) → 07 (antes 04)
    expect(BEM_CODES["73"].group).toBe("07");
    expect(BEM_CODES["74"].group).toBe("07");
    // Créditos → 05
    expect(BEM_CODES["97"].group).toBe("05");
    // Cripto → 08
    expect(BEM_CODES["81"].group).toBe("08");
    // Catch-all é 99, não 09
    expect(BEM_CODES["99"].group).toBe("99");
  });

  it("não usa o grupo inexistente '09'", () => {
    for (const code of Object.values(BEM_CODES)) {
      expect(code.group).not.toBe("09");
    }
  });
});

describe("PAGAMENTO_CODES catálogo", () => {
  it("cobre todos os IRDeductibleKind", () => {
    expect(PAGAMENTO_CODES.plano_saude).toBeDefined();
    expect(PAGAMENTO_CODES.medico).toBeDefined();
    expect(PAGAMENTO_CODES.pgbl).toBeDefined();
    expect(PAGAMENTO_CODES.educacao_titular).toBeDefined();
    expect(PAGAMENTO_CODES.inss_titular).toBeDefined();
  });
});
