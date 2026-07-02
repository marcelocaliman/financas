import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatMoney, compactMoney, type Currency } from "@/money/currency";
import { trendDomain, shortMonth } from "@/lib/chart";

interface TrendAreaProps {
  /** Pontos da série (ordenados por mês). */
  data: Array<Record<string, unknown>>;
  /** Chave do mês bruto "AAAA-MM" (eixo X + rótulo do tooltip). */
  xKey: string;
  /** Chave do valor numérico (eixo Y). */
  yKey: string;
  /** Cor da linha/área (acento p/ patrimônio, negativo p/ dívida). */
  color: string;
  /** Cor dos rótulos dos eixos (discretos). */
  axisColor: string;
  /** Moeda de exibição — formata valores (tooltip cheio + eixo Y compacto). */
  currency: Currency;
  /** Idioma p/ os rótulos de mês. */
  lang: string;
  /** Nome da série no tooltip (ex.: "Patrimônio"). */
  name?: string;
}

/**
 * Gráfico de EVOLUÇÃO (área) com eixos discretos + domínio inteligente. Diferente da versão
 * antiga (só uma linha, dados só no hover): eixo X com meses, eixo Y com valores compactos,
 * grade horizontal fininha, pontos visíveis em cada mês e domínio que começa perto do mínimo
 * pra a curva preencher a altura. Reutilizado no Painel e no Histórico.
 */
export function TrendArea({ data, xKey, yKey, color, axisColor, currency, lang, name }: TrendAreaProps) {
  const gid = "ta-" + useId().replace(/:/g, "");
  const values = data.map((d) => Number(d[yKey])).filter(Number.isFinite);
  const domain = trendDomain(values);
  // Precisão dos rótulos do eixo Y: mais casas só quando a faixa é estreita (evita "1,2 mi"
  // repetido); faixa larga fica com 1 casa (rótulo curto, sem estourar a largura do eixo).
  const span = domain[1] - domain[0];
  const mag = Math.max(Math.abs(domain[0]), Math.abs(domain[1])) || 1;
  const tickFrac = span / mag < 0.25 ? 2 : 1;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* grade só horizontal, hairline discreta (sem grid neon) */}
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.55} />
        <XAxis
          dataKey={xKey}
          tickFormatter={(m) => shortMonth(String(m), lang)}
          tick={{ fontSize: 10.5, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          interval="preserveStartEnd"
          dy={4}
        />
        <YAxis
          domain={domain}
          tickFormatter={(v) => compactMoney(Number(v), currency, tickFrac)}
          tick={{ fontSize: 10.5, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          width={70}
          tickCount={4}
        />
        <Tooltip
          cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
          formatter={(v) => [formatMoney(Number(v), currency), name ?? ""]}
          labelFormatter={(m) => shortMonth(String(m), lang)}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-float)", padding: "8px 12px" }}
          labelStyle={{ color: "var(--faint)", marginBottom: 2 }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gid})`}
          dot={{ r: 2, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
