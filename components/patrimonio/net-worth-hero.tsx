import Link from "next/link";
import { Wallet, LineChart, Package, HandCoins, ArrowRight } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { formatMoney } from "@/lib/utils/format";
import type { PatrimonioTotal } from "@/services/patrimonio-total";

/**
 * Herói do patrimônio LÍQUIDO total — a fonte única de "quanto eu tenho".
 * Soma contas + carteira + bens, abate dívidas, e mostra o breakdown com
 * links pra cada área. Resolve a confusão de "patrimônio" significar 3 coisas.
 */
export function NetWorthHero({ total }: { total: PatrimonioTotal }) {
  const parts = [
    { label: "Contas", value: total.contas, icon: Wallet, href: "/contas", sign: "+" as const },
    { label: "Carteira", value: total.carteira, icon: LineChart, href: "/investimentos", sign: "+" as const },
    { label: "Bens", value: total.bens, icon: Package, href: "/patrimonio", sign: "+" as const },
    { label: "Dívidas", value: total.dividas, icon: HandCoins, href: "/dividas", sign: "−" as const },
  ];

  return (
    <Panel className="mb-5">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground">
        Patrimônio líquido
      </div>
      <div className="mt-1.5 font-display text-[36px] leading-none tracking-[-0.03em] text-foreground">
        <MoneyMask>{formatMoney(total.liquido)}</MoneyMask>
      </div>
      <p className="text-[12px] text-muted-foreground mt-1.5">
        Contas + investimentos + bens, menos dívidas. A resposta única de "quanto eu tenho".
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
        {parts.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className="group rounded-[8px] border border-border px-3 py-2.5 hover:bg-surface-muted transition-colors"
          >
            <div className="flex items-center gap-1.5 text-faint-foreground">
              <p.icon className="w-3.5 h-3.5" strokeWidth={1.7} />
              <span className="text-[11px]">{p.label}</span>
            </div>
            <div
              className={
                "mt-1 font-mono text-[14px] tabular-nums " +
                (p.sign === "−" ? "text-rust-600 dark:text-rust-400" : "text-foreground")
              }
            >
              {p.sign === "−" && p.value > 0 ? "− " : ""}
              <MoneyMask>{formatMoney(p.value)}</MoneyMask>
            </div>
            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10.5px] text-navy-700 dark:text-navy-300 opacity-0 group-hover:opacity-100 transition-opacity">
              ver <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
