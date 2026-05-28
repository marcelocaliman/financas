import { NextResponse, type NextRequest } from "next/server";
import { geocodeDestination } from "@/lib/geocoding";

/**
 * GET /api/geocode?q=Lisboa,+Portugal
 * Wrapper sobre Nominatim. Server-side pra controlar User-Agent
 * + rate limit + cache. Retorna { latitude, longitude, country_code, display_name }
 * ou 404 se não achou.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: "q obrigatório" }, { status: 400 });
  }
  const result = await geocodeDestination(q);
  if (!result) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json(result);
}
