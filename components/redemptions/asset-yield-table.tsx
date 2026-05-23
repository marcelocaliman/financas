"use client";

import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { WithdrawYieldDialog } from "@/components/investments/withdraw-yield-dialog";
import { formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Tables } from "@/types/database";
import type { AssetYieldRow } from "@/services/yield-overview";

type AccountLite = { id: string; name: string; institution: string };
type Investment = Tables<"investments">;

/**
 * Tabela "quanto cada ativo gera". Cada linha mostra:
 *  - Ticker + nome do ativo
 *  - Aplicado (principal)
 *  - Sacável agora (= lucro acumulado, em destaque verde)
 *  - Rendendo /dia e /mês
 *  - IR estimado se sacar tudo (faixa atual + dias pra próxima faixa menor)
 *  - Regra ativa (badge resumido)
 *  - Botão "Sacar rendimento" inline que abre o WithdrawYieldDialog
 *    prefilado com o valor sacável.
 */
export function AssetYieldTable({
  rows,
  investmentsById,
  destinationAccounts,
}: {
  rows: AssetYieldRow[];
  investmentsById: Map<string, Investment>;
  destinationAccounts: AccountLite[];
}) {
  const [withdrawing, setWithdrawing] = useState<AssetYieldRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic">
        Sem ativos de renda fixa cadastrados. Vá em <a href="/investimentos" className="text-navy-700 dark:text-navy-300">/investimentos</a> e
        adicione seu primeiro Tesouro, CDB, LCI ou LCA.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <Th>Ativo</Th>
              <Th right>Aplicado</Th>
              <Th right>Sacável agora</Th>
              <Th right>Rendendo /dia</Th>
              <Th right>Renda /mês</Th>
              <Th right>IR retido</Th>
              <Th right>Regra</Th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.investmentId}
                className="border-b border-border last:border-b-0 group hover:bg-bone-100/40 dark:hover:bg-ink-800/40 transition-colors"
              >
                <td className="py-3 pr-4">
                  <div className="font-mono text-[13.5px] font-medium tracking-[-0.01em] flex items-center gap-2">
                    {r.dailyYield > 0 ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
                    ) : null}
                    {r.ticker}
                  </div>
                  <div className="text-[11.5px] text-faint-foreground truncate max-w-[220px]">
                    {r.name}
                  </div>
                </td>
                <td className="text-right font-mono text-[13px] text-muted-foreground tabular-nums">
                  <MoneyMask>{formatMoney(r.initialAmount)}</MoneyMask>
                </td>
                <td className="text-right">
                  <div className="font-mono text-[14px] font-medium tabular-nums text-olive-700 dark:text-olive-500">
                    <Money
                      value={r.accumulatedYield}
                      className="inline-flex !flex-row !items-baseline text-[14px]"
                    />
                  </div>
                  {r.initialAmount > 0 ? (
                    <div className="font-mono text-[10.5px] text-faint-foreground tabular-nums">
                      +{((r.accumulatedYield / r.initialAmount) * 100).toFixed(1).replace(".", ",")}%
                    </div>
                  ) : null}
                </td>
                <td className="text-right font-mono text-[12.5px] text-foreground tabular-nums">
                  <MoneyMask>{formatMoney(r.dailyYield)}</MoneyMask>
                </td>
                <td className="text-right font-mono text-[12.5px] text-foreground tabular-nums">
                  <MoneyMask>{formatMoney(r.monthlyYield)}</MoneyMask>
                </td>
                <td className="text-right">
                  {r.tax == null ? (
                    <Badge tone="olive">Isento</Badge>
                  ) : r.accumulatedYield <= 0 ? (
                    <span className="text-faint-foreground font-mono text-[12px]">—</span>
                  ) : (
                    <div className="text-right">
                      <div className="font-mono text-[12.5px] text-rust-600 tabular-nums">
                        −<MoneyMask>{formatMoney(r.tax.taxAmount)}</MoneyMask>
                      </div>
                      <div className="font-mono text-[10px] text-faint-foreground tabular-nums">
                        {r.tax.rateLabel}
                        {r.tax.nextBracket
                          ? ` · ${r.tax.nextBracket.newRateLabel} em ${r.tax.nextBracket.daysToWait}d`
                          : " · mínima"}
                      </div>
                    </div>
                  )}
                </td>
                <td className="text-right pl-3">
                  {r.ruleSummary ? (
                    <Badge tone="navy">{r.ruleSummary}</Badge>
                  ) : (
                    <span className="text-faint-foreground font-mono text-[12px] italic">
                      sem regra
                    </span>
                  )}
                </td>
                <td className="text-right pl-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawing(r)}
                    disabled={r.accumulatedYield <= 0 || destinationAccounts.length === 0}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-[6px] text-[11.5px] text-navy-700 dark:text-navy-300 hover:bg-navy-50 dark:hover:bg-navy-700/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                    aria-label="Sacar rendimento"
                    title={
                      r.accumulatedYield <= 0
                        ? "Sem rendimento acumulado pra sacar"
                        : destinationAccounts.length === 0
                          ? "Cadastre uma conta corrente pra receber o saque"
                          : "Sacar rendimento"
                    }
                  >
                    <ArrowDownToLine className="w-3 h-3" strokeWidth={1.8} />
                    Sacar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {withdrawing && investmentsById.get(withdrawing.investmentId) ? (
        <WithdrawYieldDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setWithdrawing(null);
          }}
          investment={investmentsById.get(withdrawing.investmentId)!}
          accumulatedYield={withdrawing.accumulatedYield}
          destinationAccounts={destinationAccounts}
        />
      ) : null}
    </>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground pb-3 font-medium ${right ? "text-right pl-3" : "text-left pr-3"}`}
    >
      {children}
    </th>
  );
}
