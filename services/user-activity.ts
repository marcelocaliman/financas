import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Log de atividade do usuário no household. Lista as últimas N mudanças
 * agregando updated_at de várias tabelas (transactions, recorrências,
 * investments, contas, metas, dívidas, IR).
 *
 * Não é audit log estrito — não captura DELETE nem mostra "campo antigo".
 * É mais um "stream de atividade recente" pra contexto.
 */

export type ActivityItem = {
  table: string;
  id: string;
  label: string;
  action: "criado" | "atualizado";
  timestamp: string;
  href: string;
};

export async function getRecentActivity(limit = 30): Promise<ActivityItem[]> {
  const supabase = await createClient();

  const [txs, recs, invs, accs, goals, debts, deds, splits] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, description, date, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("recurring_rules")
      .select("id, description, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("investments")
      .select("id, ticker, name, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("accounts")
      .select("id, name, institution, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("goals")
      .select("id, name, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("debts")
      .select("id, description, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("ir_deductible_payments")
      .select("id, description, created_at, updated_at, year")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("transaction_splits")
      .select("id, transaction_id, description, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const items: ActivityItem[] = [];

  for (const t of txs.data ?? []) {
    const created = t.created_at as string;
    const updated = (t.updated_at as string) ?? created;
    items.push({
      table: "Transação",
      id: t.id as string,
      label: t.description as string,
      action: updated === created ? "criado" : "atualizado",
      timestamp: updated,
      href: `/transacoes?month=${(t.date as string).slice(0, 7)}`,
    });
  }
  for (const r of recs.data ?? []) {
    const c = r.created_at as string;
    const u = (r.updated_at as string) ?? c;
    items.push({
      table: "Recorrência",
      id: r.id as string,
      label: r.description as string,
      action: u === c ? "criado" : "atualizado",
      timestamp: u,
      href: `/recorrentes#rule-${r.id}`,
    });
  }
  for (const i of invs.data ?? []) {
    const c = i.created_at as string;
    const u = (i.updated_at as string) ?? c;
    items.push({
      table: "Investimento",
      id: i.id as string,
      label: `${i.ticker} · ${i.name}`,
      action: u === c ? "criado" : "atualizado",
      timestamp: u,
      href: `/investimentos`,
    });
  }
  for (const a of accs.data ?? []) {
    const c = a.created_at as string;
    const u = (a.updated_at as string) ?? c;
    items.push({
      table: "Conta",
      id: a.id as string,
      label: `${a.institution} · ${a.name}`,
      action: u === c ? "criado" : "atualizado",
      timestamp: u,
      href: `/contas`,
    });
  }
  for (const g of goals.data ?? []) {
    const c = g.created_at as string;
    const u = (g.updated_at as string) ?? c;
    items.push({
      table: "Meta",
      id: g.id as string,
      label: g.name as string,
      action: u === c ? "criado" : "atualizado",
      timestamp: u,
      href: `/metas`,
    });
  }
  for (const d of debts.data ?? []) {
    const c = d.created_at as string;
    const u = (d.updated_at as string) ?? c;
    items.push({
      table: "Dívida",
      id: d.id as string,
      label: d.description as string,
      action: u === c ? "criado" : "atualizado",
      timestamp: u,
      href: `/dividas`,
    });
  }
  for (const p of deds.data ?? []) {
    const c = p.created_at as string;
    const u = (p.updated_at as string) ?? c;
    items.push({
      table: "Dedutível IR",
      id: p.id as string,
      label: p.description as string,
      action: u === c ? "criado" : "atualizado",
      timestamp: u,
      href: `/ir/${p.year}/configuracoes`,
    });
  }
  for (const s of splits.data ?? []) {
    items.push({
      table: "Split",
      id: s.id as string,
      label: (s.description as string) ?? "Split de transação",
      action: "criado",
      timestamp: s.created_at as string,
      href: `/transacoes`,
    });
  }

  return items
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
