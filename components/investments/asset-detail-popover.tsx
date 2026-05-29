"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import type { AssetSnapshot } from "@/services/quotes";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { cn } from "@/lib/utils/cn";
import { TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/**
 * Popover com detalhes financeiros do ativo: aplicado, qty, preço médio,
 * cotação atual, valor a mercado, ganho/perda.
 * Aparece ao clicar no ícone "i" da linha.
 */
export function AssetDetailPopover({ asset }: { asset: AssetSnapshot }) {
  return (
    <Popover.Root>
      <TooltipRoot delayDuration={150}>
        <TooltipTrigger asChild>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="p-1 rounded text-faint-foreground hover:text-foreground hover:bg-surface-muted transition-colors opacity-50 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Detalhes do ativo"
            >
              <Info className="w-3.5 h-3.5" strokeWidth={1.7} />
            </button>
          </Popover.Trigger>
        </TooltipTrigger>
        <TooltipContent>Detalhes do ativo</TooltipContent>
      </TooltipRoot>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 w-[260px] rounded-[10px] border border-border-strong bg-surface shadow-md p-4",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint-foreground mb-1.5 font-medium">
            {asset.ticker}
          </div>

          <div className="text-[12px] text-muted-foreground mb-3 italic">{asset.source}</div>

          <div className="space-y-2 text-[12.5px]">
            {asset.quantity != null && asset.quantity > 0 ? (
              <Row
                label="Quantidade"
                value={asset.quantity.toLocaleString("pt-BR", {
                  maximumFractionDigits: 8,
                })}
                mask
              />
            ) : null}
            {asset.averagePrice != null && asset.averagePrice > 0 ? (
              <Row label="Preço médio" value={formatMoney(asset.averagePrice)} mask />
            ) : null}
            {asset.marketPrice != null ? (
              <Row label="Cotação atual" value={formatMoney(asset.marketPrice)} mask />
            ) : null}
            <Row label="Aplicado (custo)" value={formatMoney(asset.baseBalance)} muted mask />
            {asset.marketBalance != null ? (
              <Row label="A mercado" value={formatMoney(asset.marketBalance)} bold mask />
            ) : null}
          </div>

          {asset.marketGain != null && asset.marketGainPct != null ? (
            <div
              className={cn(
                "mt-3 pt-3 border-t border-border font-mono text-[13px] flex justify-between items-baseline",
                asset.marketGain > 0
                  ? "text-olive-700 dark:text-olive-500"
                  : asset.marketGain < 0
                    ? "text-rust-600"
                    : "text-foreground",
              )}
            >
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
                Resultado
              </span>
              <span className="font-medium">
                {asset.marketGain >= 0 ? "+" : ""}
                <MoneyMask>{formatMoney(asset.marketGain)}</MoneyMask>{" "}
                <span className="text-[11px] opacity-80">
                  ({asset.marketGain >= 0 ? "+" : ""}
                  {formatPercent(asset.marketGainPct, 2)})
                </span>
              </span>
            </div>
          ) : null}

          {asset.marketChangePct != null && Math.abs(asset.marketChangePct) > 0.001 ? (
            <div className="mt-2 font-mono text-[11px] text-muted-foreground flex justify-between">
              <span>Variação no dia</span>
              <span
                className={
                  asset.marketChangePct > 0
                    ? "text-olive-700 dark:text-olive-500"
                    : "text-rust-600"
                }
              >
                {asset.marketChangePct > 0 ? "+" : ""}
                {asset.marketChangePct.toFixed(2).replace(".", ",")}%
              </span>
            </div>
          ) : null}

          <Popover.Arrow className="fill-surface stroke-border-strong" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
  mask = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  mask?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground text-[11.5px]">{label}</span>
      <span
        className={cn(
          "font-mono",
          muted && "text-muted-foreground",
          bold && "font-medium text-foreground",
        )}
      >
        {mask ? <MoneyMask>{value}</MoneyMask> : value}
      </span>
    </div>
  );
}
