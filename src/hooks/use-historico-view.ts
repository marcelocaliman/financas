import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useHistorico } from "@/hooks/use-historico";
import { convert, type Currency, type RateTable } from "@/money/currency";
import { shortMonth } from "@/lib/chart";
import type { NetWorthSnapshot } from "@/domain/types";

/** Ponto da série de evolução: mês "AAAA-MM", valor na moeda de exibição e rótulo do eixo.
 *  Type alias (não interface) de propósito: ganha index signature implícita e encaixa direto
 *  no `Record<string, unknown>[]` que o TrendArea espera. */
export type HistoricoPoint = { m: string; v: number; label: string };

export interface HistoricoView {
  /** Snapshots ordenados por mês (a tabela da página consome esta ordem). */
  sorted: NetWorthSnapshot[];
  series: HistoricoPoint[];
  current: number;
  growth: number;
  change: number;
  contributions: number;
  /** Rendimento = crescimento que NÃO veio de aporte (o "trabalho do dinheiro"). */
  yieldGain: number;
  months: number;
  first: HistoricoPoint | undefined;
  last: HistoricoPoint | undefined;
  hasTrend: boolean;
  /** Você poupou mais do que o patrimônio capturado cresceu (aporte ainda não refletido). */
  unreconciled: boolean;
  /** Sobra poupada que ainda não apareceu no patrimônio (a "aplicar"/registrar). */
  unreflected: number;
}

/**
 * Evolução do Histórico na moeda de exibição — FONTE ÚNICA da página e do summary do accordion
 * (antes cada um recalculava a própria cópia e podiam divergir). Função pura + hook.
 */
export function buildHistoricoView(data: NetWorthSnapshot[], disp: Currency, rates: RateTable, lang: string): HistoricoView {
  const conv = (a: number, c: Currency) => convert(a, c, disp, rates);
  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const series = sorted.map((s) => ({ m: s.month, v: conv(s.amount, s.currency), label: shortMonth(s.month, lang) }));
  const first = series[0];
  const last = series.at(-1);
  const current = last?.v ?? 0;
  const growth = first && last ? last.v - first.v : 0;
  const change = first && last && first.v !== 0 ? (growth / first.v) * 100 : 0;
  // Aporte do 1º mês NÃO entra: ele é o ponto de partida (o crescimento é medido A PARTIR dele).
  const contributions = sorted.slice(1).reduce((s, x) => s + conv(x.contribution ?? 0, x.currency), 0);
  // Rendimento = crescimento que NÃO veio de aporte (o "trabalho do dinheiro").
  const yieldGain = growth - contributions;
  const hasTrend = series.length >= 2;
  // "Não reconciliado": você poupou (aporte > 0) MAIS do que o patrimônio capturado cresceu.
  // Aí o rendimento negativo seria só o aporte que ainda não apareceu nos ativos — não uma
  // perda de mercado. Não dá pra separar aporte de rendimento com honestidade; sinalizamos.
  const unreconciled = hasTrend && contributions > 0.5 && contributions > growth + 0.5;
  // Sobra que você poupou mas que ainda não apareceu no patrimônio (a "aplicar"/registrar).
  const unreflected = unreconciled ? contributions - growth : 0;
  return { sorted, series, current, growth, change, contributions, yieldGain, months: series.length, first, last, hasTrend, unreconciled, unreflected };
}

/** Hook: a mesma view derivada dos snapshots vivos (moeda de exibição + idioma correntes). */
export function useHistoricoView(): HistoricoView | null {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const disp = useUI((s) => s.displayCurrency);
  const rates = useRates((s) => s.rates);
  const data = useHistorico();
  return useMemo(() => (data ? buildHistoricoView(data, disp, rates, lang) : null), [data, disp, rates, lang]);
}
