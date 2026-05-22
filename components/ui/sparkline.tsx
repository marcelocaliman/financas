/**
 * Sparkline SVG inline — minimalista, sem dependência externa.
 * Mostra uma linha de tendência com último ponto destacado.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = "currentColor",
  fill = "none",
  strokeWidth = 1.5,
  className,
  showDot = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
  showDot?: boolean;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const last = points[points.length - 1];

  // Polygon pra área (fill opcional)
  const areaD =
    fill !== "none"
      ? `${pathD} L ${last.x} ${height} L 0 ${height} Z`
      : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {areaD ? <path d={areaD} fill={fill} opacity={0.15} /> : null}
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot ? (
        <circle cx={last.x} cy={last.y} r={2.5} fill={stroke} />
      ) : null}
    </svg>
  );
}
