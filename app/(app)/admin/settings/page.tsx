import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/services/lgpd";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Plataforma · configurações"
        title={
          <>
            Configurações <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">do sistema</em>
          </>
        }
        subtitle="Constantes de plataforma, versões legais, integrações externas, feature flags."
      />

      <div className="space-y-5">
        {/* Versões legais */}
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Versões legais
          </div>
          <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
            Quando vc atualizar os Termos ou a Política de Privacidade, incremente
            a versão em <code>services/lgpd.ts</code>. Todos os usuários serão
            forçados a re-aceitar no próximo login (banner de consentimento).
          </p>
          <dl className="space-y-2 text-[13px] font-mono">
            <div className="flex justify-between items-center">
              <dt className="text-muted-foreground">Termos de Uso</dt>
              <dd>
                <Badge tone="navy">v{TERMS_VERSION}</Badge>
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-muted-foreground">Política de Privacidade</dt>
              <dd>
                <Badge tone="navy">v{PRIVACY_VERSION}</Badge>
              </dd>
            </div>
          </dl>
        </Panel>

        {/* Integrações externas */}
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Integrações externas
          </div>
          <dl className="space-y-3 text-[13px]">
            <IntegrationRow
              name="Supabase"
              status="connected"
              url={process.env.NEXT_PUBLIC_SUPABASE_URL ?? null}
            />
            <IntegrationRow
              name="brapi.dev"
              status={process.env.BRAPI_TOKEN ? "connected" : "not_configured"}
              url="https://brapi.dev"
            />
            <IntegrationRow
              name="Banco Central (BCB)"
              status="connected"
              url="https://api.bcb.gov.br"
            />
            <IntegrationRow name="Stripe" status="not_configured" />
            <IntegrationRow name="Resend (email)" status="not_configured" />
            <IntegrationRow name="OpenAI" status={process.env.OPENAI_API_KEY ? "connected" : "not_configured"} />
            <IntegrationRow name="Anthropic" status={process.env.ANTHROPIC_API_KEY ? "connected" : "not_configured"} />
          </dl>
        </Panel>

        {/* Modelo de cobrança */}
        <Panel>
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3">
            Modelo de cobrança
          </div>
          <p className="text-[12.5px] text-muted-foreground mb-3">
            Status atual:{" "}
            <b className="text-foreground">
              Tudo gratuito (validação de produto)
            </b>
            .
          </p>
          <ul className="space-y-2 text-[13px] text-muted-foreground">
            <li>
              ✓ Todos os novos cadastros vêm com{" "}
              <code>subscription_tier=&apos;free&apos;</code> e{" "}
              <code>status=&apos;active&apos;</code>
            </li>
            <li>
              ✓ Nenhuma feature está gated por plano (definir gating ao iniciar
              cobrança)
            </li>
            <li>
              ✓ Estrutura Stripe pronta nos campos{" "}
              <code>stripe_customer_id</code> /{" "}
              <code>stripe_subscription_id</code>
            </li>
          </ul>
        </Panel>

        {/* Compliance LGPD */}
        <Panel className="border-olive-600/30">
          <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3 inline-flex items-center gap-2">
            Compliance LGPD
            <Badge tone="olive">Estruturado</Badge>
          </div>
          <ul className="space-y-1.5 text-[13px] text-muted-foreground">
            <li>✓ Consentimento explícito (terms + privacy) registrado por usuário com IP/UA</li>
            <li>✓ Direito de acesso (art. 18 II): export JSON disponível em /configuracoes/privacidade</li>
            <li>✓ Direito de eliminação (art. 18 VI): self-service + admin via /admin</li>
            <li>✓ Direito de portabilidade (art. 18 V): export estruturado JSON</li>
            <li>✓ Audit log imutável de ações admin (governance + segurança)</li>
            <li>⚠ Falta: política de privacidade revisada por advogado antes de SaaS público</li>
            <li>⚠ Falta: DPO (Encarregado de Dados) designado oficialmente — obrigatório se vc tratar dados em escala</li>
            <li>⚠ Falta: aviso de violação de dados (procedure pra notificar ANPD + titulares se houver vazamento)</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}

function IntegrationRow({
  name,
  status,
  url,
}: {
  name: string;
  status: "connected" | "not_configured" | "error";
  url?: string | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-foreground font-medium">{name}</div>
        {url ? (
          <div className="font-mono text-[10.5px] text-faint-foreground truncate max-w-[400px]">
            {url}
          </div>
        ) : null}
      </div>
      <Badge
        tone={
          status === "connected"
            ? "olive"
            : status === "error"
              ? "rust"
              : "neutral"
        }
      >
        {status === "connected"
          ? "conectado"
          : status === "error"
            ? "erro"
            : "não configurado"}
      </Badge>
    </div>
  );
}
