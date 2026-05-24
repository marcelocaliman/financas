import { NextResponse } from "next/server";
import { generateDec } from "@/services/ir/dec-export";
import { getCurrentUserContext } from "@/services/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? "", 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("ir_settings")
    .select("cpf_titular")
    .maybeSingle();

  const cpf = settings?.cpf_titular ?? "";
  if (!cpf) {
    return NextResponse.json(
      { error: "Cadastre CPF do titular em Configurações antes de exportar." },
      { status: 400 },
    );
  }

  try {
    const bundle = await generateDec({
      year,
      cpf,
      nome: ctx.profile.display_name,
    });
    return NextResponse.json(bundle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
