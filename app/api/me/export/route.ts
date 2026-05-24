import { NextResponse } from "next/server";
import { exportUserData } from "@/services/lgpd";
import { getCurrentUserContext } from "@/services/auth";

/**
 * Endpoint self-service: usuário baixa seus PRÓPRIOS dados (LGPD art. 18 V).
 * Validação via auth normal — RLS + getCurrentUserContext garantem que vc
 * só baixa o que é seu.
 */
export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await exportUserData();
  if (!data) {
    return NextResponse.json({ error: "no data" }, { status: 404 });
  }

  const filename = `financas-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
