/**
 * Constantes de timezone do app.
 *
 * O app é Brazil-only por design — todas as datas, cálculos de ciclos,
 * "hoje", logs de transações usam America/Sao_Paulo. Centralizado aqui
 * pra evitar drift entre arquivos.
 *
 * Se um dia o app virar multi-país, esta const vira um lookup por
 * household.timezone. Por enquanto: fixo no BR.
 */
export const BR_TIMEZONE = "America/Sao_Paulo" as const;

/**
 * Retorna "YYYY-MM-DD" pra "hoje" em BR. Útil pra comparações de date-only
 * (data de transação, start_date de recorrência) sem componente de hora.
 */
export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Hour atual em BR (0-23). Útil pra saudação ("bom dia/tarde/noite").
 */
export function currentHourBR(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BR_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
}
