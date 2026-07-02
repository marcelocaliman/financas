/**
 * "Dica da semana" — conteúdo do fundador (cross-border/FIRE), mão única, sem moderação.
 * Rotaciona por semana ISO. Evergreen (nada com data). Sem link externo de propósito — a ideia
 * é MANTER o usuário no app. Pra publicar uma nova dica: adicione aqui e faça deploy.
 */
export interface Tip {
  id: string;
  title: { pt: string; en: string };
  body: { pt: string; en: string };
}

export const TIPS: Tip[] = [
  {
    id: "forfettario",
    title: { pt: "Regime Forfettario na Itália", en: "Italy's flat-rate regime" },
    body: {
      pt: "Abaixo de € 85 mil/ano, o forfettario costuma pagar bem menos imposto que o regime ordinário — mas pese a contribuição ao INPS e a perda de deduções antes de decidir.",
      en: "Under €85k/year, the flat-rate 'forfettario' usually pays far less tax than the ordinary regime — but weigh the INPS contributions and the lost deductions first.",
    },
  },
  {
    id: "cambio-media",
    title: { pt: "Não converta tudo de uma vez", en: "Don't convert it all at once" },
    body: {
      pt: "Ao mudar de país, converter aos poucos (custo médio) reduz o risco de pegar um câmbio ruim num único dia. O tempo dilui a sorte.",
      en: "When moving countries, converting gradually (cost averaging) cuts the risk of catching a bad rate on a single day. Time dilutes luck.",
    },
  },
  {
    id: "reserva-antes",
    title: { pt: "Reserva antes de investir", en: "Emergency fund first" },
    body: {
      pt: "6 meses de custo de vida em caixa (na moeda onde você gasta) evita vender investimento no pior momento. Independência começa pela segurança.",
      en: "6 months of living costs in cash (in the currency you spend) avoids selling investments at the worst time. Independence starts with a safety net.",
    },
  },
  {
    id: "moeda-do-gasto",
    title: { pt: "Case a moeda com o gasto", en: "Match currency to spending" },
    body: {
      pt: "Se você vai gastar em euros, manter parte do patrimônio em euros reduz o risco cambial. O objetivo não é adivinhar o câmbio — é não depender dele.",
      en: "If you'll spend in euros, holding part of your wealth in euros cuts FX risk. The goal isn't to predict the rate — it's to not depend on it.",
    },
  },
  {
    id: "numero-primeiro",
    title: { pt: "Saiba o seu número", en: "Know your number" },
    body: {
      pt: "Seu número de independência ≈ 25× o custo anual. Ter o alvo claro transforma 'poupar' num jogo com placar — e é o que mais motiva a continuar.",
      en: "Your independence number ≈ 25× annual costs. A clear target turns 'saving' into a game with a scoreboard — and that's what keeps you going.",
    },
  },
];

/** Nº da semana ISO — pra escolher a dica de forma determinística (mesma dica a semana toda). */
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3); // quinta da semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000);
}

/** A dica da semana atual (rotaciona pela lista). */
export function currentTip(now: Date): Tip {
  return TIPS[isoWeek(now) % TIPS.length];
}
