import { describe, it, expect } from "vitest";
import { computeBillWindow } from "@/services/credit-card";

/**
 * Tests de computeBillWindow — janela da fatura aberta de cartão.
 *
 * Semântica (close_day INCLUSIVO, bancos BR): compras ATÉ o close_day (incluso)
 * entram na fatura que fecha nesse dia. O ciclo vai do dia SEGUINTE ao close
 * anterior até o close atual (incluso).
 *
 * Valores esperados derivados À MÃO (anti-viés), não copiados do output.
 */

// Helper: today em UTC puro pra não depender de timezone local.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("computeBillWindow — casos normais de sanidade", () => {
  it("(a) close=26 due=5, hoje=20/05/2026 (ainda não fechou)", () => {
    // d=20 <= thisMonthClose=26 → não fechou; target = Maio/2026.
    // closeD=min(26,31)=26 → close/periodEnd=2026-05-26.
    // due=5 NÃO > close=26 → vence no mês seguinte ao fechamento: Jun/2026, dia 5.
    // prev = Abr/2026, prevClose=min(26,30)=26 < 30 → periodStart = 27/04.
    const w = computeBillWindow(26, 5, utc(2026, 5, 20));
    expect(w.closeDate).toBe("2026-05-26");
    expect(w.periodEnd).toBe("2026-05-26");
    expect(w.periodStart).toBe("2026-04-27");
    expect(w.dueDate).toBe("2026-06-05");
  });

  it("(b) close=26 due=5, hoje=27/05/2026 (já fechou, d>close → próximo ciclo)", () => {
    // d=27 > thisMonthClose=26 → já fechou; target avança pra Jun/2026.
    // closeD=min(26,30)=26 → close/periodEnd=2026-06-26.
    // due=5 NÃO > close=26 → vence Jul/2026 dia 5.
    // prev = Mai/2026, prevClose=min(26,31)=26 < 31 → periodStart = 27/05.
    const w = computeBillWindow(26, 5, utc(2026, 5, 27));
    expect(w.closeDate).toBe("2026-06-26");
    expect(w.periodEnd).toBe("2026-06-26");
    expect(w.periodStart).toBe("2026-05-27");
    expect(w.dueDate).toBe("2026-07-05");
  });

  it("due > close: vencimento cai no MESMO mês do fechamento", () => {
    // close=10, due=20. hoje=05/03/2026 (d=5 <= 10 → não fechou). target=Mar/2026.
    // closeD=10 → 2026-03-10. due=20 > close=10 → mesmo mês: 2026-03-20.
    // prev=Fev/2026, prevClose=min(10,28)=10 < 28 → periodStart=2026-02-11.
    const w = computeBillWindow(10, 20, utc(2026, 3, 5));
    expect(w.closeDate).toBe("2026-03-10");
    expect(w.periodEnd).toBe("2026-03-10");
    expect(w.periodStart).toBe("2026-02-11");
    expect(w.dueDate).toBe("2026-03-20");
  });
});

describe("computeBillWindow — BORDA fim de mês (fix do overlap, close=31)", () => {
  it("(c) fatura que fecha em Fev/2026: periodEnd=28/02, periodStart=01/02 (NÃO 29/01)", () => {
    // hoje=15/02/2026: thisMonthClose=min(31,28)=28; d=15<=28 → não fechou. target=Fev/2026.
    // closeD=min(31,28)=28 → periodEnd=2026-02-28.
    // prev=Jan/2026: prevClose=min(31,31)=31, prevLastDay=31 → 31 NÃO < 31
    //   → periodStart = dia 1 do target = 2026-02-01 (não 2026-01-29!).
    const w = computeBillWindow(31, 10, utc(2026, 2, 15));
    expect(w.periodEnd).toBe("2026-02-28");
    expect(w.periodStart).toBe("2026-02-01");
  });

  it("close=31: ciclo de Janeiro/2026 = [01/01, 31/01]", () => {
    // hoje=15/01/2026: thisMonthClose=min(31,31)=31; d=15<=31 → não fechou. target=Jan/2026.
    // closeD=31 → periodEnd=2026-01-31.
    // prev=Dez/2025: prevClose=31, prevLastDay=31 → NÃO < → periodStart = dia 1 = 2026-01-01.
    const w = computeBillWindow(31, 10, utc(2026, 1, 15));
    expect(w.periodEnd).toBe("2026-01-31");
    expect(w.periodStart).toBe("2026-01-01");
  });

  it("close=31: ciclo de Março/2026 = [01/03, 31/03]", () => {
    // hoje=15/03/2026: target=Mar/2026. closeD=31 → periodEnd=2026-03-31.
    // prev=Fev/2026: prevClose=min(31,28)=28, prevLastDay=28 → 28 NÃO < 28
    //   → periodStart = dia 1 = 2026-03-01.
    const w = computeBillWindow(31, 10, utc(2026, 3, 15));
    expect(w.periodEnd).toBe("2026-03-31");
    expect(w.periodStart).toBe("2026-03-01");
  });

  it("close=31: dois ciclos consecutivos NÃO compartilham dias (Jan↔Fev)", () => {
    // Jan termina 31/jan; Fev começa 01/fev. Sem overlap.
    const jan = computeBillWindow(31, 10, utc(2026, 1, 15));
    const fev = computeBillWindow(31, 10, utc(2026, 2, 15));
    expect(jan.periodEnd).toBe("2026-01-31");
    expect(fev.periodStart).toBe("2026-02-01");
    // periodStart de Fev deve ser EXATAMENTE periodEnd de Jan + 1 dia (sem buraco, sem overlap).
    expect(addDaysISO(jan.periodEnd, 1)).toBe(fev.periodStart);
  });
});

describe("computeBillWindow — invariante: sem overlap E sem buraco entre ciclos", () => {
  // Pra cada close_day, varre meses consecutivos e checa continuidade:
  // periodStart(ciclo N+1) === periodEnd(ciclo N) + 1 dia.
  // Usa hoje = dia 15 (< close pra closes pequenos, mas pra closes grandes ainda
  // não fechou na maioria) garantindo que target === mês de hoje.
  const closeDays = [5, 15, 26, 28, 30, 31];

  for (const close of closeDays) {
    it(`close=${close}: continuidade entre ciclos consecutivos (mar→ago/2026)`, () => {
      // hoje no dia 1 de cada mês garante d=1 <= thisMonthClose → target=mês atual,
      // exceto se close=0 (não é o caso). Assim ciclo de cada mês = mês corrente.
      let prevEnd: string | null = null;
      for (let month = 3; month <= 8; month++) {
        const w = computeBillWindow(close, 10, utc(2026, month, 1));
        // periodStart sempre <= periodEnd
        expect(w.periodStart <= w.periodEnd).toBe(true);
        if (prevEnd !== null) {
          // Sem overlap e sem buraco: start atual = fim anterior + 1 dia.
          expect(w.periodStart).toBe(addDaysISO(prevEnd, 1));
        }
        prevEnd = w.periodEnd;
      }
    });
  }
});

// Soma `days` a uma data ISO YYYY-MM-DD em UTC. Implementação independente da
// função sob teste (não reusa helpers internos do módulo).
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
