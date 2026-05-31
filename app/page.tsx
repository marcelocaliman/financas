import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Landmark, Sparkles, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLANS, PAID_TIERS } from "@/lib/billing/plans";
import { isBillingEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const billingOn = isBillingEnabled();
  const planCards = [PLANS.free, ...PAID_TIERS.map((t) => PLANS[t])];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="max-w-[1100px] mx-auto px-6 py-6 flex items-center justify-between">
        <span className="font-display text-[18px] tracking-[-0.01em]">Finanças</span>
        <div className="flex items-center gap-4 text-[13px]">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="rounded-[8px] bg-navy-700 px-3.5 py-2 text-white hover:bg-navy-800"
          >
            Criar conta
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-6 pt-12 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-navy-700 dark:text-navy-300">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
          Imposto de Renda no automático
        </div>
        <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.03em] mt-4 max-w-[800px] mx-auto">
          Lance gastos e investimentos. O <em className="not-italic italic text-navy-700 dark:text-navy-300">IRPF</em> se monta sozinho.
        </h1>
        <p className="text-[15px] text-muted-foreground mt-5 max-w-[560px] mx-auto leading-relaxed">
          Um app de finanças pessoais que, conforme você registra o dia a dia,
          calcula sua declaração de Imposto de Renda em tempo real — carnê-leão,
          bens, isenções e tudo o mais. Sem planilha, sem susto em março.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-navy-700 px-5 py-3 text-[14px] font-medium text-white hover:bg-navy-800"
          >
            Começar grátis
            <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-[10px] border border-border-strong px-5 py-3 text-[14px] hover:bg-surface-muted"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="max-w-[1100px] mx-auto px-6 pb-16 grid sm:grid-cols-3 gap-5">
        {[
          {
            icon: Landmark,
            title: "IR automático",
            body: "Carnê-leão, bens e direitos, renda variável e isenções calculados dos seus lançamentos.",
          },
          {
            icon: Sparkles,
            title: "Tudo num lugar",
            body: "Contas, cartões, investimentos e metas — com patrimônio e independência financeira acompanhados.",
          },
          {
            icon: ShieldCheck,
            title: "Seus dados, seus",
            body: "Exportação completa e exclusão de conta a um clique. Sem Open Finance — tudo manual e privado.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-[12px] border border-border p-6">
            <f.icon className="w-6 h-6 text-navy-700 dark:text-navy-300" strokeWidth={1.6} />
            <h3 className="font-display text-[18px] mt-3">{f.title}</h3>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      {/* Planos */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <h2 className="font-display text-[26px] tracking-[-0.02em] text-center">Planos</h2>
        {!billingOn ? (
          <p className="text-[12.5px] text-muted-foreground text-center mt-1">
            Comece grátis. Planos pagos em breve.
          </p>
        ) : null}
        <div className="grid sm:grid-cols-3 gap-5 mt-6 items-stretch">
          {planCards.map((p) => (
            <div key={p.tier} className="rounded-[12px] border border-border p-6 flex flex-col">
              <h3 className="font-display text-[18px]">{p.name}</h3>
              <div className="text-[24px] font-display mt-1">
                {p.priceMonthlyBRL == null ? (
                  "Grátis"
                ) : (
                  <>
                    R$ {p.priceMonthlyBRL}
                    <span className="text-[12.5px] text-muted-foreground font-sans">/mês</span>
                  </>
                )}
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-1">{p.blurb}</p>
              <ul className="mt-3 space-y-1.5 flex-1">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[12.5px]">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-olive-600 shrink-0" strokeWidth={2} />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href="/cadastro"
                className="mt-4 inline-flex items-center justify-center rounded-[8px] bg-navy-700 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-navy-800"
              >
                {p.priceMonthlyBRL == null ? "Criar conta grátis" : `Começar com ${p.name}`}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-[12.5px] text-muted-foreground">
          <span>© Finanças — controle financeiro e IRPF</span>
          <div className="flex gap-4">
            <Link href="/termos" className="hover:text-foreground">Termos</Link>
            <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link href="/login" className="hover:text-foreground">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
