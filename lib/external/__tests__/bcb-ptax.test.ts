import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
}));

import { fetchPtaxCompra } from "@/lib/external/bcb-ptax";
import { __resetBreakers } from "@/lib/external/resilient-fetch";

function ptaxResponse(value: unknown[]): Response {
  return new Response(JSON.stringify({ value }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => __resetBreakers());
afterEach(() => vi.restoreAllMocks());

describe("fetchPtaxCompra", () => {
  it("retorna a cotação de compra da data quando há boletim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ptaxResponse([{ cotacaoCompra: 6.1917, cotacaoVenda: 6.1923, dataHoraCotacao: "2024-12-31" }]),
      ),
    );
    const r = await fetchPtaxCompra("USD", "2024-12-31");
    expect(r).not.toBeNull();
    expect(r!.rate).toBeCloseTo(6.1917, 4);
    expect(r!.date).toBe("2024-12-31");
  });

  it("anda pra trás quando a data não tem boletim (feriado)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ptaxResponse([])) // 01-01 vazio
      .mockResolvedValueOnce(ptaxResponse([])) // 31-12 vazio (ex.: domingo)
      .mockResolvedValueOnce(
        ptaxResponse([{ cotacaoCompra: 5.5, cotacaoVenda: 5.51, dataHoraCotacao: "2023-12-29" }]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchPtaxCompra("EUR", "2024-01-01");
    expect(r!.rate).toBe(5.5);
    expect(r!.date).toBe("2023-12-30"); // 01-01 menos 2 dias
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retorna null quando nada é encontrado na janela", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ptaxResponse([])));
    const r = await fetchPtaxCompra("GBP", "2024-12-31", 2);
    expect(r).toBeNull();
  });
});
