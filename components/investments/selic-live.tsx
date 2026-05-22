"use client";

import { useEffect, useState } from "react";
import { formatMoneyParts, formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import type { Investment } from "@/services/investments";

/**
 * Card escuro do "Tesouro Selic ao vivo".
 * O saldo persiste atualizado no servidor pelo cron diário; aqui
 * fazemos um micro-incremento contínuo (cosmético, ≈8h úteis/dia) só pra
 * dar a sensação visceral de "dinheiro respirando".
 */
export function SelicLive({
  asset,
  selicAnnualPct,
  selicDate,
}: {
  asset: Investment;
  selicAnnualPct: number; // 14.5
  selicDate?: string;
}) {
  const initialBalance = Number(asset.current_balance);
  const multiplier = Number(asset.indexer_multiplier ?? 1);
  const annual = (selicAnnualPct * multiplier) / 100;
  const dailyRate = Math.pow(1 + annual, 1 / 252) - 1;
  // Distribui o rendimento diário ao longo de 8 horas úteis (8 * 3600 segundos).
  const ratePerSecond = dailyRate / (8 * 3600);

  const [balance, setBalance] = useState(initialBalance);

  // Re-sincroniza quando o saldo persistido muda (React 19 pattern)
  const [prevInitial, setPrevInitial] = useState(initialBalance);
  if (prevInitial !== initialBalance) {
    setPrevInitial(initialBalance);
    setBalance(initialBalance);
  }

  useEffect(() => {
    const id = setInterval(() => {
      setBalance((prev) => prev * (1 + ratePerSecond * 0.5));
    }, 500);
    return () => clearInterval(id);
  }, [ratePerSecond]);

  const { integer, cents } = formatMoneyParts(balance);
  const perSecondInReals = initialBalance * ratePerSecond;
  const todayYield = initialBalance * dailyRate;

  return (
    <section className="rounded-[var(--radius-xl)] bg-ink-950 text-white p-9 sm:p-10 mb-7 relative overflow-hidden shadow-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2"
        style={{ background: "radial-gradient(circle, rgba(176,123,50,0.06), transparent 60%)" }}
      />
      <div className="relative z-10 grid sm:grid-cols-[1.5fr_auto] gap-8">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-300 font-medium flex items-center gap-2 mb-3.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
            {asset.ticker} · ao vivo
          </div>
          <div className="font-display italic text-[22px] tracking-[-0.01em] mb-6">
            <em>{asset.name}</em>
            {asset.account?.institution ? (
              <span className="not-italic text-navy-300 ml-2 font-sans font-normal">
                · {asset.account.institution}
              </span>
            ) : null}
          </div>

          <div className="flex items-baseline gap-3 font-mono">
            <span className="text-[18px] text-navy-300 font-light">R$</span>
            <span className="text-[44px] sm:text-[52px] font-light leading-none tracking-[-0.03em]">
              <MoneyMask>{integer}</MoneyMask>
            </span>
            <span className="text-[22px] text-navy-300 font-light">,<MoneyMask>{cents}</MoneyMask></span>
          </div>

          <div className="flex gap-2 mt-5 flex-wrap">
            <div className="bg-white/[0.04] px-3.5 py-2 rounded-[8px] text-[11.5px] text-navy-200 font-mono tracking-[0.04em]">
              Rendendo agora{" "}
              <b className="text-olive-500">
                + R$ <MoneyMask>{perSecondInReals.toFixed(4).replace(".", ",")}</MoneyMask>/s
              </b>
            </div>
            <div className="bg-white/[0.04] px-3.5 py-2 rounded-[8px] text-[11.5px] text-navy-200 font-mono tracking-[0.04em]">
              Hoje (até agora){" "}
              <b className="text-olive-500">
                + <MoneyMask>{formatMoney(todayYield)}</MoneyMask>
              </b>
            </div>
          </div>
        </div>

        <div className="sm:pl-9 sm:border-l border-ink-700 grid gap-4 content-start">
          <SideCell label="Selic atual" value={`${selicAnnualPct.toFixed(2)}% a.a.`} />
          <SideCell
            label="Multiplicador"
            value={multiplier === 1 ? "100% Selic" : `${(multiplier * 100).toFixed(0)}% Selic`}
          />
          <SideCell
            label="Rend. mês est."
            value={formatMoney(initialBalance * dailyRate * 21)}
            tone="positive"
            mask
          />
          {selicDate ? (
            <div className="font-mono text-[10px] text-ink-500 tracking-[0.06em]">
              fonte BCB · {selicDate}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SideCell({
  label,
  value,
  tone,
  mask = false,
}: {
  label: string;
  value: string;
  tone?: "positive";
  mask?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-navy-400 mb-1 font-medium">
        {label}
      </div>
      <div
        className={`font-mono text-[16px] font-medium ${tone === "positive" ? "text-olive-500" : "text-white"}`}
      >
        {mask ? <MoneyMask>{value}</MoneyMask> : value}
      </div>
    </div>
  );
}
