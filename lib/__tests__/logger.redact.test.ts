import { describe, it, expect, vi } from "vitest";

// Sentry é no-op nos testes (sem DSN), mas mockamos pra não tocar a rede.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
}));

import { redact } from "@/lib/logger";

describe("redact", () => {
  it("mascara chaves sensíveis conhecidas", () => {
    const out = redact({
      email: "a@b.com",
      cpf: "123",
      amount: 9999,
      nome: "Marcelo",
    }) as Record<string, unknown>;
    expect(out.email).toBe("[redacted]");
    expect(out.cpf).toBe("[redacted]");
    expect(out.amount).toBe("[redacted]");
    expect(out.nome).toBe("Marcelo");
  });

  it("é case-insensitive nas chaves", () => {
    const out = redact({ Senha: "x", TOKEN: "y" }) as Record<string, unknown>;
    expect(out.Senha).toBe("[redacted]");
    expect(out.TOKEN).toBe("[redacted]");
  });

  it("desce recursivamente em objetos e arrays", () => {
    const out = redact({
      user: { email: "a@b.com", id: "u1" },
      items: [{ valor: 10 }, { valor: 20 }],
    }) as { user: Record<string, unknown>; items: Record<string, unknown>[] };
    expect(out.user.email).toBe("[redacted]");
    expect(out.user.id).toBe("u1");
    expect(out.items[0].valor).toBe("[redacted]");
    expect(out.items[1].valor).toBe("[redacted]");
  });

  it("respeita o limite de profundidade sem estourar", () => {
    let deep: Record<string, unknown> = { email: "leak@x.com" };
    for (let i = 0; i < 10; i++) deep = { child: deep };
    expect(() => redact(deep)).not.toThrow();
  });

  it("passa primitivos e null intactos", () => {
    expect(redact(null)).toBe(null);
    expect(redact(42)).toBe(42);
    expect(redact("texto")).toBe("texto");
  });
});
