import { NextResponse } from "next/server";
import { simulateSale } from "@/services/ir/sale-simulator";
import { getCurrentUserContext } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

  const { investmentId, qty, unitPrice, saleDate, isDayTrade } = body;
  if (!investmentId || !qty || !unitPrice || !saleDate) {
    return NextResponse.json(
      { error: "Campos obrigatórios: investmentId, qty, unitPrice, saleDate" },
      { status: 400 },
    );
  }

  const result = await simulateSale({
    investmentId,
    qty: Number(qty),
    unitPrice: Number(unitPrice),
    saleDate,
    isDayTrade: !!isDayTrade,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
