import { NextResponse } from "next/server";
import { exportUserData } from "@/services/lgpd";

/**
 * Backup completo do household em JSON. Inclui contas, transactions,
 * investments, recorrências, bens, IR, splits, etc. Tudo que pertence
 * ao household atual.
 *
 * Cliente: faz fetch, gera blob, baixa como `financas-backup-{date}.json`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await exportUserData();
  if (!data) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="financas-backup-${today}.json"`,
    },
  });
}
