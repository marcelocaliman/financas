import Link from "next/link";
import { Download, Trash2, Shield, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { listConsents, TERMS_VERSION, PRIVACY_VERSION } from "@/services/lgpd";
import { ConsentToggle } from "@/components/lgpd/consent-toggle";
import { ExportDataButton } from "@/components/lgpd/export-data-button";
import { DeleteAccountForm } from "@/components/lgpd/delete-account-form";

export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const consents = await listConsents();

  return (
    <>
      <PageHeader
        eyebrow="LGPD · seus direitos"
        title={
          <>
            Privacidade e <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">dados.</em>
          </>
        }
        subtitle="Aqui vc controla os dados que confiou ao Finanças. Exporta, apaga ou ajusta consentimentos a qualquer momento — direitos garantidos pela Lei 13.709/2018 (LGPD)."
      />

      {/* Direitos garantidos */}
      <Panel className="mb-5 border-navy-700/30">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />
          <div className="text-[13px] leading-relaxed">
            <b>Seus direitos como titular dos dados</b> (LGPD art. 18):
            confirmação do tratamento, acesso, correção, anonimização,
            portabilidade, eliminação, informação sobre compartilhamento,
            informação sobre não consentir, revogação de consentimento.
            <Link
              href="/privacidade"
              className="text-navy-700 dark:text-navy-300 ml-1"
            >
              Ler política completa →
            </Link>
          </div>
        </div>
      </Panel>

      {/* Consentimentos */}
      <Panel className="mb-5">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1">
          Seus consentimentos
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
          Revogue a qualquer momento. Termos e privacidade são obrigatórios pra
          usar o app; marketing/analytics são opcionais.
        </p>
        <ul className="space-y-3">
          {consents.map((c) => (
            <li key={c.type} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-foreground">
                  {consentLabel(c.type)}
                </div>
                <div className="font-mono text-[10.5px] text-faint-foreground mt-0.5">
                  {c.granted
                    ? `Aceito em ${c.grantedAt ? new Date(c.grantedAt).toLocaleString("pt-BR") : "—"} (v${c.version ?? "?"})`
                    : c.revokedAt
                      ? `Revogado em ${new Date(c.revokedAt).toLocaleString("pt-BR")}`
                      : "Nunca aceito"}
                </div>
                {(c.type === "terms_of_service" || c.type === "privacy_policy") &&
                c.version &&
                c.version !== (c.type === "terms_of_service" ? TERMS_VERSION : PRIVACY_VERSION) ? (
                  <div className="font-mono text-[10.5px] text-rust-600 mt-0.5">
                    Versão atual é v
                    {c.type === "terms_of_service" ? TERMS_VERSION : PRIVACY_VERSION}.
                    Re-aceite necessário.
                  </div>
                ) : null}
              </div>
              <ConsentToggle
                type={c.type}
                granted={c.granted}
                version={
                  c.type === "terms_of_service"
                    ? TERMS_VERSION
                    : c.type === "privacy_policy"
                      ? PRIVACY_VERSION
                      : "1.0"
                }
                required={
                  c.type === "terms_of_service" || c.type === "privacy_policy"
                }
              />
            </li>
          ))}
        </ul>
      </Panel>

      {/* Export dados */}
      <Panel className="mb-5">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-1 inline-flex items-center gap-2">
          <Download className="w-4 h-4 text-olive-700 dark:text-olive-500" strokeWidth={1.7} />
          Exportar meus dados
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3 leading-relaxed">
          Baixa um arquivo JSON com todos os dados que vc confiou ao Finanças:
          perfil, contas, transações, metas, investimentos, consentimentos.
          LGPD art. 18 V (portabilidade).
        </p>
        <ExportDataButton />
      </Panel>

      {/* Política de Privacidade + Termos (links) */}
      <Panel className="mb-5">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-foreground mb-3 inline-flex items-center gap-2">
          <FileText className="w-4 h-4 text-navy-700 dark:text-navy-300" strokeWidth={1.7} />
          Documentos legais
        </div>
        <ul className="space-y-2 text-[13px]">
          <li className="flex items-center justify-between">
            <Link href="/termos" className="text-navy-700 dark:text-navy-300 hover:underline">
              Termos de Uso
            </Link>
            <Badge tone="neutral">v{TERMS_VERSION}</Badge>
          </li>
          <li className="flex items-center justify-between">
            <Link href="/privacidade" className="text-navy-700 dark:text-navy-300 hover:underline">
              Política de Privacidade
            </Link>
            <Badge tone="neutral">v{PRIVACY_VERSION}</Badge>
          </li>
        </ul>
      </Panel>

      {/* Apagar conta */}
      <Panel className="border-rust-600/30">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em] text-rust-600 mb-1 inline-flex items-center gap-2">
          <Trash2 className="w-4 h-4" strokeWidth={1.7} />
          Apagar minha conta
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3 leading-relaxed">
          Eliminação definitiva de todos os dados pessoais (LGPD art. 18 VI).
          Não dá pra reverter. Vc receberá uma cópia dos dados por email antes
          (se confirmar). O pedido é processado em até 15 dias.
        </p>
        <DeleteAccountForm />
      </Panel>
    </>
  );
}

function consentLabel(type: string): string {
  const map: Record<string, string> = {
    terms_of_service: "Termos de Uso",
    privacy_policy: "Política de Privacidade",
    data_processing: "Tratamento de dados (LGPD)",
    marketing_emails: "Receber emails de marketing",
    analytics_cookies: "Cookies de analytics",
  };
  return map[type] ?? type;
}
