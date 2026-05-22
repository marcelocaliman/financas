import { NextResponse, type NextRequest } from "next/server";
import { searchAssets } from "@/services/asset-lookup";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 12);
  const { results, liveTesouro } = await searchAssets(q, limit);
  return NextResponse.json({ results, liveTesouro });
}
