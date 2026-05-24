import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAccountantContext } from "@/services/accountant-auth";
import { AcceptInviteAction } from "@/components/accountant/accept-invite-action";

export const dynamic = "force-dynamic";

export default async function AceitarConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <Panel className="!py-12 text-center">
        <p className="text-[13px] text-muted-foreground">Token ausente.</p>
      </Panel>
    );
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Service role pra ler o convite (RLS bloqueia anon e mesmo contador
  // que ainda não é do household). Token é o secret — quem tem ele tem
  // direito de ver os dados do convite.
  const { data: invite } = await adminClient
    .from("accountant_invites")
    .select("email, expires_at, accepted_at, revoked_at, years_allowed, household_id")
    .eq("token", token)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const accountantCtx = await getCurrentAccountantContext();

  // Convite inválido ou já aceito/revogado
  if (!invite) {
    return (
      <>
        <PageHeader
          eyebrow="Convite"
          title={<>Convite <em className="not-italic font-display italic text-rust-600">inválido</em></>}
          subtitle="Esse link não existe mais. Peça ao titular pra gerar um novo convite."
        />
      </>
    );
  }
  if (invite.accepted_at) {
    return (
      <>
        <PageHeader
          eyebrow="Convite"
          title={<>Convite <em className="not-italic font-display italic text-gold-700">já usado</em></>}
          subtitle="Esse convite foi aceito anteriormente. Verifique seu painel."
        />
        <Link href="/contador" className="text-navy-700 dark:text-navy-300 text-[13px]">
          Ir pro painel →
        </Link>
      </>
    );
  }
  if (invite.revoked_at) {
    return (
      <>
        <PageHeader
          eyebrow="Convite"
          title={<>Convite <em className="not-italic font-display italic text-rust-600">cancelado</em></>}
          subtitle="O titular cancelou esse convite antes de ser aceito. Peça um novo."
        />
      </>
    );
  }
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <>
        <PageHeader
          eyebrow="Convite"
          title={<>Convite <em className="not-italic font-display italic text-rust-600">expirado</em></>}
          subtitle="O prazo desse convite acabou. Peça um novo."
        />
      </>
    );
  }

  // Convite válido. Caminho A: não logado → ir pra cadastro/login com email pré-preenchido
  if (!user) {
    return (
      <>
        <PageHeader
          eyebrow="Convite válido"
          title={
            <>
              Você foi convidado para acessar{" "}
              <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
                dados de IRPF
              </em>
            </>
          }
          subtitle={`Para aceitar, faça login ou crie uma conta com o email ${invite.email}.`}
        />
        <Panel className="!p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge tone="navy">IRPF {invite.years_allowed.join(", ")}</Badge>
            <Badge tone="olive">
              Válido até{" "}
              {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
            </Badge>
          </div>
          <p className="text-[13px] text-muted-foreground mb-4">
            Como você ainda não tem conta no Finanças, é preciso criar uma usando
            esse mesmo email. Depois do cadastro, volte pra este link pra
            finalizar a aceitação.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/cadastro?email=${encodeURIComponent(invite.email)}&accountant=1&redirectTo=${encodeURIComponent(`/contador/aceitar?token=${token}`)}`}
              className="inline-flex items-center px-4 py-2 rounded-[7px] bg-ink-950 text-white text-[13px] hover:bg-ink-800"
            >
              Criar conta de contador
            </Link>
            <Link
              href={`/login?email=${encodeURIComponent(invite.email)}&redirectTo=${encodeURIComponent(`/contador/aceitar?token=${token}`)}`}
              className="inline-flex items-center px-4 py-2 rounded-[7px] border border-border-strong text-[13px] hover:bg-surface-muted"
            >
              Já tenho conta
            </Link>
          </div>
        </Panel>
      </>
    );
  }

  // Logado mas sem perfil de contador → onboarding
  if (!accountantCtx) {
    redirect("/contador/onboarding");
  }

  // Email do convite vs email logado
  const emailMatches =
    invite.email.toLowerCase() === (accountantCtx.email ?? "").toLowerCase();
  if (!emailMatches) {
    return (
      <>
        <PageHeader
          eyebrow="Email diferente"
          title={
            <>
              Esse convite é para outro{" "}
              <em className="not-italic font-display italic text-rust-600">email</em>
            </>
          }
          subtitle={`O convite foi enviado para ${invite.email}, mas você está logado como ${accountantCtx.email}. Faça logout e entre com o email certo.`}
        />
      </>
    );
  }

  // Tudo certo → aceitar
  return (
    <>
      <PageHeader
        eyebrow="Confirmar acesso"
        title={
          <>
            Aceitar convite de{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              IRPF
            </em>
          </>
        }
        subtitle="Você terá acesso somente-leitura aos dados liberados. O titular pode revogar a qualquer momento."
      />
      <Panel className="!p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge tone="navy">IRPF {invite.years_allowed.join(", ")}</Badge>
          <Badge tone="olive">
            Válido até {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
          </Badge>
        </div>
        <AcceptInviteAction token={token} />
      </Panel>
    </>
  );
}
