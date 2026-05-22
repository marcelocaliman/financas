import { Plus, Calendar, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/services/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateFull, formatTime, getGreeting } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const firstName = ctx.profile.display_name.split(" ")[0];
  const now = new Date();
  const greeting = getGreeting(now);

  const supabase = await createClient();
  const [{ count: txCount }, { count: accountsCount }] = await Promise.all([
    supabase.from("transactions").select("*", { count: "exact", head: true }),
    supabase.from("accounts").select("*", { count: "exact", head: true }),
  ]);

  const hasData = (txCount ?? 0) > 0 && (accountsCount ?? 0) > 0;

  return (
    <>
      <PageHeader
        eyebrow={`${formatDateFull(now)} · ${formatTime(now)}`}
        title={
          <>
            {greeting}, <em className="not-italic font-display italic text-navy-700">{firstName}.</em>
          </>
        }
        subtitle={
          hasData
            ? "Esse é o pulso do mês — o que entrou, o que saiu, e onde o patrimônio respira."
            : "Vamos preparar o terreno em três passos curtos: contas, primeira transação e estamos no ar."
        }
        actions={
          <>
            <Button variant="secondary">
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.7} />
              Maio
            </Button>
            <Button variant="primary">
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Adicionar
            </Button>
          </>
        }
      />

      {hasData ? (
        <DashboardEmptyPlaceholder />
      ) : (
        <OnboardingWelcome firstName={firstName} accountsCount={accountsCount ?? 0} />
      )}
    </>
  );
}

function OnboardingWelcome({
  firstName,
  accountsCount,
}: {
  firstName: string;
  accountsCount: number;
}) {
  return (
    <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
      <div className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-10 sm:p-12 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px]"
          style={{
            background:
              "radial-gradient(circle, rgba(176,123,50,0.16), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 w-[340px] h-[340px]"
          style={{
            background:
              "radial-gradient(circle, rgba(96,126,168,0.13), transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-[520px]">
          <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 mb-3 font-medium flex items-center gap-2">
            <Sparkles className="w-3 h-3" strokeWidth={1.6} /> Primeiros passos
          </div>
          <h2 className="font-display text-[34px] leading-[1.1] tracking-[-0.025em] font-light text-white">
            Bem-vindo, <em className="font-display italic">{firstName}</em>.
            <br />
            Nada por aqui ainda — e isso é o ponto de partida.
          </h2>
          <p className="text-navy-300 text-[14px] mt-5 leading-relaxed">
            Antes de qualquer tela bonita, o app precisa de duas coisas: <span className="text-white">onde</span> o seu dinheiro mora e <span className="text-white">como</span> ele se move. Em 60 segundos a casa fica de pé.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Button variant="primary" size="lg" className="!bg-white !text-ink-950 !border-white hover:!bg-bone-100 hover:!border-bone-100">
              Cadastrar primeira conta →
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="!text-navy-200 hover:!bg-ink-800 hover:!text-white"
            >
              Importar de planilha
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <StepCard
          n={1}
          done={accountsCount > 0}
          title="Cadastrar contas"
          text="Itaú, Nubank, XP, dinheiro vivo — onde o dinheiro entra e sai. Sem nada disso, o resto não funciona."
        />
        <StepCard
          n={2}
          done={false}
          title="Primeiro lançamento"
          text="Receita ou despesa, tanto faz. Só pra ver o app respirando com dados de verdade."
        />
        <StepCard
          n={3}
          done={false}
          title="Convidar parceira"
          text="Mesmo lar, dois acessos. O que ela lança aparece aqui sem refresh."
        />
      </div>
    </section>
  );
}

function StepCard({
  n,
  title,
  text,
  done,
}: {
  n: number;
  title: string;
  text: string;
  done: boolean;
}) {
  return (
    <Panel className={done ? "opacity-60" : ""}>
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 grid place-items-center w-9 h-9 rounded-full font-mono text-[12px] font-medium ${
            done
              ? "bg-olive-100 text-olive-700"
              : "bg-ink-950 text-white"
          }`}
        >
          {done ? "✓" : n.toString().padStart(2, "0")}
        </div>
        <div>
          <h3 className="font-display text-[17px] font-medium tracking-[-0.01em]">
            {title}
          </h3>
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{text}</p>
        </div>
      </div>
    </Panel>
  );
}

function DashboardEmptyPlaceholder() {
  return (
    <Panel>
      <PanelHeader
        title="Em construção"
        meta="Fase 1 · próximas iterações"
      />
      <p className="text-muted-foreground text-[14px] leading-relaxed">
        Hero do mês, insight de gasto atípico, top categorias, últimos movimentos e o respiro do patrimônio aparecem aqui assim que houver transações e investimentos cadastrados.
      </p>
    </Panel>
  );
}
