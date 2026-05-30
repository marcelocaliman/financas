import { describe, it, expect } from "vitest";
import {
  findDuplicate,
  type ExistingTx,
  type DedupeCandidate,
} from "@/services/import-dedupe";

// Fixtures mínimas: findDuplicate lê de tx -> id, account_id, kind, date,
// amount_account, description. recurring_rule_id existe no tipo mas não é
// lido pela função (incluído só pra satisfazer o tipo, ou via cast).
function tx(overrides: Partial<ExistingTx>): ExistingTx {
  return {
    id: "tx1",
    account_id: "acc1",
    kind: "expense",
    date: "2026-05-15",
    amount_account: 550,
    description: "CLAUDE.AI SUBSCRIPTION",
    recurring_rule_id: null,
    ...overrides,
  } as ExistingTx;
}

function candidate(overrides: Partial<DedupeCandidate>): DedupeCandidate {
  return {
    account_id: "acc1",
    kind: "expense",
    date: "2026-05-16",
    amount_account: 550,
    description: "Claude AI charge",
    ...overrides,
  } as DedupeCandidate;
}

describe("findDuplicate", () => {
  // (a) match básico:
  // - account_id "acc1" == "acc1" OK
  // - kind "expense" == "expense" OK
  // - data: 2026-05-16 vs 2026-05-15 => 1 dia <= 3 OK
  // - valor: |550-550|=0 <= max(1, 550*0.05=27.5)=27.5 OK
  // - desc: keyword "claude" (6 chars, não-stopword) compartilhado OK
  // => retorna a tx existente
  it("(a) retorna a tx quando conta/kind/data±3/valor±tol/keyword batem", () => {
    const existing = [tx({})];
    const result = findDuplicate(candidate({}), existing);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("tx1");
  });

  // (b) consumedIds contém o id da única existente casável => pulada => null
  it("(b) retorna null quando a única match já foi consumida", () => {
    const existing = [tx({})];
    const consumed = new Set<string>(["tx1"]);
    const result = findDuplicate(candidate({}), existing, consumed);
    expect(result).toBeNull();
  });

  // (c) duas existentes idênticas e casáveis; tx1 consumida.
  // Loop: tx1 está em consumedIds => continue; tx2 passa todos os filtros
  // => retorna tx2.
  it("(c) com duas existentes iguais e a primeira consumida, retorna a segunda", () => {
    const existing = [tx({ id: "tx1" }), tx({ id: "tx2" })];
    const consumed = new Set<string>(["tx1"]);
    const result = findDuplicate(candidate({}), existing, consumed);
    expect(result?.id).toBe("tx2");
  });

  // (d) conta diferente => filtro account_id derruba => null.
  // E kind diferente => filtro kind derruba => null.
  it("(d) retorna null quando a conta difere", () => {
    const existing = [tx({})];
    const result = findDuplicate(candidate({ account_id: "accX" }), existing);
    expect(result).toBeNull();
  });

  it("(d') retorna null quando o kind difere", () => {
    const existing = [tx({})];
    const result = findDuplicate(candidate({ kind: "income" }), existing);
    expect(result).toBeNull();
  });

  // (e) valor fora da tolerância.
  // tolerance = max(1, |tx.amount_account|*0.05) = max(1, 550*0.05=27.5) = 27.5
  // candidate 600 => |550-600|=50 > 27.5 => null
  it("(e) retorna null quando o valor está fora da tolerância", () => {
    const existing = [tx({ amount_account: 550 })];
    const result = findDuplicate(candidate({ amount_account: 600 }), existing);
    expect(result).toBeNull();
  });

  // (f) data > 3 dias.
  // 2026-05-20 vs 2026-05-15 => 5 dias > 3 => null
  it("(f) retorna null quando a diferença de data passa de 3 dias", () => {
    const existing = [tx({ date: "2026-05-15" })];
    const result = findDuplicate(candidate({ date: "2026-05-20" }), existing);
    expect(result).toBeNull();
  });

  // sanidade extra: borda exata de data (3 dias) ainda casa.
  // 2026-05-18 vs 2026-05-15 => 3 dias <= 3 => OK
  it("sanidade: data exatamente a 3 dias ainda casa", () => {
    const existing = [tx({ date: "2026-05-15" })];
    const result = findDuplicate(candidate({ date: "2026-05-18" }), existing);
    expect(result?.id).toBe("tx1");
  });

  // sanidade extra: sem consumedIds, a primeira de duas matches é retornada.
  it("sanidade: sem consumedIds retorna a primeira existente casável", () => {
    const existing = [tx({ id: "txA" }), tx({ id: "txB" })];
    const result = findDuplicate(candidate({}), existing);
    expect(result?.id).toBe("txA");
  });
});
