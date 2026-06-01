import { NextResponse } from "next/server";
import { generateDec } from "@/services/ir/dec-export";
import { getRendimentosReport } from "@/services/ir/rendimentos";
import { getCurrentUserContext } from "@/services/auth";
import {
  getCurrentAccountantContext,
  assertAccountantAccess,
  logAccountantAction,
} from "@/services/accountant-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? "", 10);
  const householdIdParam = url.searchParams.get("householdId");
  const filerIdParam = url.searchParams.get("filerId");
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;

  // ---- Tenta como contador primeiro
  const accountantCtx = await getCurrentAccountantContext();
  if (accountantCtx) {
    if (!householdIdParam) {
      return NextResponse.json(
        { error: "householdId obrigatório quando contador." },
        { status: 400 },
      );
    }
    const access = await assertAccountantAccess(householdIdParam, year);
    if (!access) {
      return NextResponse.json({ error: "Sem acesso a esse ano." }, { status: 403 });
    }

    // Busca CPF via admin (RLS bloquearia)
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from("ir_settings")
      .select("cpf_titular")
      .eq("household_id", householdIdParam)
      .maybeSingle();
    const cpf = settings?.cpf_titular ?? "";
    if (!cpf) {
      return NextResponse.json(
        { error: "CPF do titular não cadastrado. Solicite ao cliente preencher." },
        { status: 400 },
      );
    }

    // Gate D8 também pro contador: não exporta declaração com renda não
    // classificada (mesmo bloqueio do titular — evita transmitir incompleto).
    const acctRendCheck = await getRendimentosReport(year, householdIdParam);
    if (acctRendCheck.naoClassificados.total > 0) {
      return NextResponse.json(
        {
          error:
            `Há R$ ${acctRendCheck.naoClassificados.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ` +
            `em renda não classificada nesta declaração. O titular precisa resolver no modo revisão antes da exportação.`,
        },
        { status: 409 },
      );
    }

    await logAccountantAction({
      householdId: householdIdParam,
      action: url.searchParams.get("format") === "txt" ? "export_txt" : "export_dec",
      targetYear: year,
      ip,
      details: { format: url.searchParams.get("format") ?? "dec" },
    });

    const bundle = await generateDec({
      year,
      cpf,
      nome: access.titularName ?? access.household.name,
      householdId: householdIdParam,
      accountantWatermark: {
        fullName: accountantCtx.profile.full_name,
        crc:
          accountantCtx.profile.crc_number && accountantCtx.profile.crc_state
            ? `CRC-${accountantCtx.profile.crc_state} ${accountantCtx.profile.crc_number}`
            : (accountantCtx.profile.crc_number ?? undefined),
        ip: ip ?? undefined,
      },
    });
    return NextResponse.json(bundle);
  }

  // ---- Caso normal — titular (ou cônjuge via filerId)
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();

  // Se filerId foi passado, busca CPF/nome direto do filer.
  // Senão, fallback pro CPF do ir_settings (compat com fluxo antigo).
  let cpf = "";
  let nome = ctx.profile.display_name;

  if (filerIdParam) {
    const { data: filer } = await supabase
      .from("ir_filers")
      .select("cpf, full_name")
      .eq("id", filerIdParam)
      .maybeSingle();
    if (!filer) {
      return NextResponse.json({ error: "Declarante não encontrado." }, { status: 404 });
    }
    cpf = filer.cpf;
    nome = filer.full_name;
  } else {
    const { data: settings } = await supabase
      .from("ir_settings")
      .select("cpf_titular")
      .maybeSingle();
    cpf = settings?.cpf_titular ?? "";
  }

  if (!cpf) {
    return NextResponse.json(
      { error: "Cadastre CPF do titular em Configurações antes de exportar." },
      { status: 400 },
    );
  }

  // Gate D8: não exporta declaração com renda não classificada — evita
  // transmitir números incompletos. O usuário resolve em /ir/[year]/revisao.
  const rendCheck = await getRendimentosReport(year, ctx.household.id, filerIdParam ?? undefined);
  if (rendCheck.naoClassificados.total > 0) {
    return NextResponse.json(
      {
        error:
          `Há R$ ${rendCheck.naoClassificados.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ` +
          `em renda não classificada. Resolva no modo revisão (/ir/${year}/revisao) antes de exportar.`,
      },
      { status: 409 },
    );
  }

  try {
    const bundle = await generateDec({
      year,
      cpf,
      nome,
      filerId: filerIdParam ?? undefined,
    });
    return NextResponse.json(bundle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
