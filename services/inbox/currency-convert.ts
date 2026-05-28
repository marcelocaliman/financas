import "server-only";
import { getRateMapAt } from "@/services/currency";
import { convertOrSame } from "@/lib/financial/currency";
import type { Currency } from "@/types/database";

/**
 * Helper de conversão pra appliers do inbox.
 *
 * Recebe (amount, fromCurrency, toCurrency, date) e retorna o valor convertido
 * usando a cotação histórica daquela data. Se moedas iguais, retorna direto.
 *
 * Se a cotação histórica não estiver disponível pra aquela data exata, pega
 * a mais próxima anterior (comportamento de getRateMapAt).
 */
export async function convertAmount(args: {
  amount: number;
  from: Currency;
  to: Currency;
  date: string; // YYYY-MM-DD pra cotação histórica
}): Promise<{ converted: number; rateUsed: number }> {
  if (args.from === args.to) {
    return { converted: args.amount, rateUsed: 1 };
  }
  const rates = await getRateMapAt(args.date);
  const converted = convertOrSame(args.amount, args.from, args.to, rates);
  const rateUsed = converted / args.amount;
  return { converted, rateUsed };
}

/**
 * Cota o `amount_account` baseado em (amount, currency, account.currency).
 * Pra account.currency === amount.currency, retorna o próprio amount.
 * Senão, converte com cotação da data.
 */
export async function computeAmountAccount(args: {
  amount: number;
  fromCurrency: Currency;
  accountCurrency: Currency;
  date: string;
}): Promise<number> {
  const { converted } = await convertAmount({
    amount: args.amount,
    from: args.fromCurrency,
    to: args.accountCurrency,
    date: args.date,
  });
  return Math.round(converted * 100) / 100;
}
