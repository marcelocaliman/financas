import Link from "next/link";
import { ArrowRight, Landmark, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { formatMoney } from "@/lib/utils/format";
import type { ImpostoResult } from "@/services/ir/imposto";
import { cn } from "@/lib/utils/cn";

/**
 * Card-herói do Início: a estimativa do IRPF do ano corrente, montada
 * automaticamente a partir do que o usuário lançou. É o "momento mágico" do app
 * — o diferencial (IR automático) vira algo que a pessoa vê acontecer na 1ª tela.
 *
 * Estados:
 *  - restituir (boa notícia, verde-oliva)
 *  - a pagar (atenção, dourado)
 *  - nada a declarar / sem base (mensagem calma, "o app está de olho pra você")
 *  - null (não deu pra calcular: ano sem tabela, etc.) → não renderiza
 */
export function IrEstimateHero({
  imposto,
  year,
}: {
  imposto: ImpostoResult | null;
  year: number;
}) {
  if (!imposto) return null;

  const recommended =
    imposto.recommendation === "completo" ? imposto.completo : imposto.simples;
  const netDue = recommended.netDue;
  const hasBase = imposto.baseTributavelBruta > 0;

  const isRefund = hasBase && netDue < -0.5;
  const isDue = hasBase && netDue > 0.5;
  const isZero = !isRefund && !isDue;

  const modelLabel = imposto.recommendation === "completo" ? "completo" : "simplificado";

  return (
    <Panel
      className={cn(
        "relative overflow-hidden",
        isRefund && "bg-olive-100/40 dark:bg-olive-700/10 border-olive-600/30",
        isDue && "bg-gold-100/40 dark:bg-gold-700/10 border-gold-600/30",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
            <Landmark className="w-3.5 h-3.5" strokeWidth={1.7} />
            Imposto de Renda {year}
            <span className="inline-flex items-center gap-1 text-navy-700 dark:text-navy-300 normal-case tracking-normal">
              <Sparkles className="w-3 h-3" strokeWidth={1.7} />
              estimativa automática
            </span>
          </div>

          {isZero ? (
            <div className="mt-2.5">
              <div className="font-display text-[22px] tracking-[-0.02em] text-foreground leading-tight">
                Tudo certo — nada a declarar até agora
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-1.5">
                Conforme você lança receitas e despesas, sua estimativa de IR se
                monta sozinha aqui.
              </p>
            </div>
          ) : (
            <div className="mt-2.5">
              <div
                className={cn(
                  "font-display text-[30px] tracking-[-0.025em] leading-none",
                  isRefund
                    ? "text-olive-700 dark:text-olive-500"
                    : "text-gold-700 dark:text-gold-500",
                )}
              >
                <MoneyMask>{formatMoney(Math.abs(netDue))}</MoneyMask>{" "}
                <span className="text-[16px] font-medium tracking-[-0.01em]">
                  {isRefund ? "a restituir" : "a pagar"}
                </span>
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-2">
                Com base nos seus lançamentos · modelo{" "}
                <span className="font-medium text-foreground">{modelLabel}</span>{" "}
                recomendado
                {imposto.taxTableIsEstimate ? " · tabela ainda estimada" : ""}
              </p>
            </div>
          )}
        </div>

        <Link
          href={`/ir/${year}`}
          className="shrink-0 inline-flex items-center gap-1 text-[12.5px] text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 font-medium mt-0.5"
        >
          Ver IRPF
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
        </Link>
      </div>
    </Panel>
  );
}
