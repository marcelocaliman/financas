import Link from "next/link";
import { redirect } from "next/navigation";
import { Home, ArrowRight, Clock, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentAccountantContext,
  listAccessibleHouseholds,
} from "@/services/accountant-auth";

export const dynamic = "force-dynamic";

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function ContadorDashboard() {
  const ctx = await getCurrentAccountantContext();
  if (!ctx) redirect("/contador/onboarding");

  const accesses = await listAccessibleHouseholds();

  return (
    <>
      <PageHeader
        eyebrow="Painel · contador"
        title={
          <>
            Olá,{" "}
            <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">
              {ctx.profile.full_name.split(" ")[0]}
            </em>
          </>
        }
        subtitle="Aqui ficam todos os clientes que liberaram acesso aos dados de IR. Click pra abrir e preparar a declaração."
      />

      {accesses.length === 0 ? (
        <Panel className="!py-12 text-center">
          <AlertCircle
            className="w-8 h-8 text-faint-foreground mx-auto mb-3"
            strokeWidth={1.5}
          />
          <div className="font-display text-[17px] text-foreground mb-1">
            Nenhum cliente liberou acesso ainda
          </div>
          <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
            Quando um cliente seu compartilhar os dados de IR pelo Finanças, o
            acesso aparece aqui automaticamente.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {accesses.map((a) => {
            const days = daysLeft(a.access.expires_at);
            return (
              <Link
                key={a.access.id}
                href={`/contador/${a.household.id}/ir/${a.access.years_allowed[0]}`}
                className="block group"
              >
                <Panel className="!p-5 hover:border-navy-700/40 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-[10px] bg-navy-700/10 grid place-items-center shrink-0">
                      <Home className="w-5 h-5 text-navy-700 dark:text-navy-300" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-display text-[17px] tracking-[-0.01em] text-foreground">
                          {a.household.name}
                        </span>
                        {a.titularName ? (
                          <span className="font-mono text-[11px] text-faint-foreground">
                            · {a.titularName}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge tone="navy">
                          IRPF {a.access.years_allowed.map((y) => `${y}`).join(", ")}
                        </Badge>
                        <span
                          className={
                            "inline-flex items-center gap-1 text-[11.5px] font-mono " +
                            (days < 7 ? "text-rust-600" : "text-faint-foreground")
                          }
                        >
                          <Clock className="w-3 h-3" strokeWidth={1.8} />
                          {days} {days === 1 ? "dia" : "dias"} restantes (até{" "}
                          {new Date(a.access.expires_at).toLocaleDateString("pt-BR")})
                        </span>
                      </div>
                      {a.access.last_accessed_at ? (
                        <p className="text-[11.5px] text-faint-foreground">
                          Último acesso{" "}
                          {new Date(a.access.last_accessed_at).toLocaleString("pt-BR")}
                        </p>
                      ) : (
                        <p className="text-[11.5px] text-gold-700">
                          Você ainda não acessou esse cliente
                        </p>
                      )}
                      <div className="mt-3 text-navy-700 dark:text-navy-300 text-[13px] inline-flex items-center gap-1">
                        Abrir declaração
                        <ArrowRight
                          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                          strokeWidth={1.8}
                        />
                      </div>
                    </div>
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      )}

      <Panel className="mt-6 border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Como funciona
        </div>
        <ul className="text-[13px] space-y-1.5 text-muted-foreground">
          <li>
            <b className="text-foreground">Acesso somente-leitura:</b> você
            visualiza e exporta dados, mas não pode editar nada no app do
            cliente.
          </li>
          <li>
            <b className="text-foreground">Tudo auditado:</b> cada vista de seção
            e cada download de arquivo fica registrado pro cliente ver.
          </li>
          <li>
            <b className="text-foreground">Revogação imediata:</b> o cliente pode
            cancelar seu acesso a qualquer momento. Por isso priorize baixar o
            .DEC ou o relatório TXT logo.
          </li>
          <li>
            <b className="text-foreground">Marca d&apos;água:</b> os arquivos
            exportados incluem seu nome e a data — evidência de cadeia de
            custódia LGPD.
          </li>
        </ul>
      </Panel>
    </>
  );
}
