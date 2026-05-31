import { NextResponse, type NextRequest } from "next/server";
import { capturePtaxForYearEnd } from "@/services/ptax";

/**
 * Cron: captura a PTAX de 31/12 (BCB) pra valorar Bens no IR (decisão D14).
 * Gated por BCB_PTAX_ENABLED. Por padrão captura o 31/12 do ANO ANTERIOR
 * (ano-base da declaração que está sendo feita); aceita ?year=YYYY.
 *
 * Agendar em vercel.json no início do ano (ex.: "0 12 5 1 *" — 5/jan).
 */
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const enabled =
    process.env.BCB_PTAX_ENABLED === "true" || process.env.BCB_PTAX_ENABLED === "1";
  if (!enabled) {
    return NextResponse.json({ skipped: "BCB_PTAX_ENABLED desligado" });
  }

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  // Default: ano anterior (ano-base). Sem Date.now() — derivamos do header de
  // data do Vercel ou exigimos ?year. Aqui aceitamos ?year e, na falta,
  // tentamos o ano corrente-1 a partir do request (fallback seguro).
  let year: number;
  if (yearParam) {
    year = parseInt(yearParam, 10);
  } else {
    const reqDate = req.headers.get("date");
    const y = reqDate ? new Date(reqDate).getUTCFullYear() : NaN;
    if (Number.isNaN(y)) {
      return NextResponse.json(
        { error: "informe ?year=YYYY (ano-base)" },
        { status: 400 },
      );
    }
    year = y - 1;
  }
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "ano inválido" }, { status: 400 });
  }

  const result = await capturePtaxForYearEnd(year);
  return NextResponse.json(result);
}
