import { describe, it, expect } from "vitest";
import {
  PLANS,
  PAID_TIERS,
  getPlan,
  priceIdFor,
  tierForPriceId,
  TRIAL_DAYS,
} from "@/lib/billing/plans";

const ENV = {
  STRIPE_PRICE_PRO_MONTHLY: "price_pro_123",
  STRIPE_PRICE_FAMILY_MONTHLY: "price_fam_456",
};

describe("catálogo de planos", () => {
  it("free não tem price; pagos têm env de price", () => {
    expect(PLANS.free.stripePriceEnv).toBeNull();
    expect(PLANS.pro.stripePriceEnv).toBe("STRIPE_PRICE_PRO_MONTHLY");
    expect(PAID_TIERS).toEqual(["pro", "family"]);
  });

  it("free é mais restrito que pro que família", () => {
    expect(PLANS.free.features.ai).toBe(false);
    expect(PLANS.pro.features.ai).toBe(true);
    expect(PLANS.free.limits.maxMembers).toBeLessThan(PLANS.family.limits.maxMembers);
    expect(PLANS.pro.limits.maxAccounts).toBe(Infinity);
  });

  it("trial é 14 dias", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe("getPlan", () => {
  it("desconhecido/null cai pra free", () => {
    expect(getPlan(null).tier).toBe("free");
    expect(getPlan("inexistente").tier).toBe("free");
    expect(getPlan("pro").tier).toBe("pro");
  });
});

describe("priceIdFor / tierForPriceId (round-trip)", () => {
  it("resolve o price id do env", () => {
    expect(priceIdFor("pro", ENV)).toBe("price_pro_123");
    expect(priceIdFor("free", ENV)).toBeNull();
  });
  it("mapeia price id de volta pro tier", () => {
    expect(tierForPriceId("price_pro_123", ENV)).toBe("pro");
    expect(tierForPriceId("price_fam_456", ENV)).toBe("family");
    expect(tierForPriceId("price_desconhecido", ENV)).toBe("free");
    expect(tierForPriceId(null, ENV)).toBe("free");
  });
});
