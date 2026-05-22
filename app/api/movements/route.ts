import { NextResponse, type NextRequest } from "next/server";
import { listMovements } from "@/services/movements";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const investmentId = req.nextUrl.searchParams.get("investmentId");
  if (!investmentId) {
    return NextResponse.json({ movements: [] });
  }
  try {
    const movements = await listMovements(investmentId);
    return NextResponse.json({ movements });
  } catch {
    return NextResponse.json({ movements: [] }, { status: 500 });
  }
}
