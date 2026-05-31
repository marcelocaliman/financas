import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { aiKey, ipKey, authKey } from "@/lib/rate-limit";

describe("helpers de chave de rate-limit", () => {
  it("aiKey codifica ação + household", () => {
    expect(aiKey("run-audit", "hh-123")).toBe("ai:run-audit:hh:hh-123");
  });
  it("ipKey codifica rota + ip", () => {
    expect(ipKey("/api/quotes", "1.2.3.4")).toBe("ip:/api/quotes:1.2.3.4");
  });
  it("authKey codifica ação + identificador", () => {
    expect(authKey("signin", "a@b.com")).toBe("auth:signin:a@b.com");
  });
  it("chaves de households diferentes não colidem", () => {
    expect(aiKey("x", "a")).not.toBe(aiKey("x", "b"));
  });
});
