import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
}));

import {
  resilientFetch,
  safeFetch,
  safeJson,
  ExternalFetchError,
  __resetBreakers,
} from "@/lib/external/resilient-fetch";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  __resetBreakers();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("resilientFetch", () => {
  it("retorna a resposta no caminho feliz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: 1 })));
    const res = await resilientFetch("https://api.example.com/x", { retries: 0 });
    expect(res.status).toBe(200);
  });

  it("faz retry em 503 e sucede na 2ª tentativa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const res = await resilientFetch("https://api.example.com/retry", {
      retries: 2,
      backoffMs: 1,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lança ExternalFetchError ao esgotar retries em 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(
      resilientFetch("https://api.example.com/down", { retries: 1, backoffMs: 1 }),
    ).rejects.toBeInstanceOf(ExternalFetchError);
  });

  it("não faz retry em 4xx não-retryável", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      resilientFetch("https://api.example.com/missing", { retries: 3, backoffMs: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("safeFetch / safeJson", () => {
  it("safeFetch nunca lança — degrada com ok:false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const r = await safeFetch("https://api.example.com/net", { retries: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ExternalFetchError);
  });

  it("safeJson devolve o corpo parseado quando ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ valor: 42 })));
    const r = await safeJson<{ valor: number }>("https://api.example.com/j", { retries: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.valor).toBe(42);
  });
});

describe("circuit breaker", () => {
  it("abre após o limiar e passa a rejeitar sem chamar fetch", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    // 5 falhas consecutivas (threshold) — cada chamada sem retry.
    for (let i = 0; i < 5; i++) {
      await safeFetch("https://flaky.example.com/x", { retries: 0, backoffMs: 1 });
    }
    const callsAfterOpen = fetchMock.mock.calls.length;
    // Com o breaker aberto, a próxima não deve chamar fetch.
    const r = await safeFetch("https://flaky.example.com/x", { retries: 0 });
    expect(r.ok).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(callsAfterOpen);
  });
});
