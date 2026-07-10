// Engine dos "stories" de divulgação (só super-admin): desenha cada anúncio num <canvas> 1080×1920
// (9:16, formato Story) ao longo do tempo — texto + motivos animados na estética da marca. O mesmo
// render serve pra prévia (loop) e pra exportar MP4 (grava o canvas com MediaRecorder). Resolução-
// independente: tudo escala por s = W/1080, então preview pequena e export grande usam o MESMO código.

export const SCENE_DUR = 4; // segundos por "página" do story (ritmo calmo, dá tempo de ler)
const LAST_HOLD = 2.5; // segundos EXTRAS na última cena (CTA): fica parada, sem fade, pra dar tempo de clicar
const BG = "#0A0B0D";
const TEXT = "#F3F4F6";
const MUTED = "#9CA2AC";
const FAINT = "#5F646C";
const ACCENT = "#3ECF8E";
const CARD2 = "#191B20";
const CARD = "#131418";

// ── PALETAS ──────────────────────────────────────────────────────────────────
// Além do tema ESCURO padrão (a cara do app), duas famílias novas dão VARIEDADE às peças sem sair
// da marca: CLARO (papel premium neutro, texto escuro, mesmo acento fechado do modo claro do app) e
// SOBRE-COR (fundo verde profundo, texto claro). Cada primitivo de texto recebe uma paleta (default =
// ESCURO) → a MESMA engine produz visuais bem distintos só trocando a paleta + o fundo.
export type PieceStyle = "light" | "color" | "vivid" | "dark";
interface Palette {
  text: string;
  muted: string;
  faint: string;
  accent: string;
  onAccent: string; // texto SOBRE preenchimento no acento (pílula/CTA)
  chipFill: string;
  chipStroke: string;
  chipText: string;
  brandText: string;
}
const DARK: Palette = {
  text: TEXT, muted: MUTED, faint: FAINT, accent: ACCENT, onAccent: "#08130C",
  chipFill: "rgba(255,255,255,0.05)", chipStroke: "rgba(255,255,255,0.12)", chipText: MUTED, brandText: TEXT,
};
const LIGHT: Palette = {
  text: "#0E1512", muted: "#55606A", faint: "#9AA1AA", accent: "#15976A", onAccent: "#FFFFFF",
  chipFill: "rgba(14,21,18,0.04)", chipStroke: "rgba(14,21,18,0.13)", chipText: "#55606A", brandText: "#0E1512",
};
const ONCOLOR: Palette = {
  text: "#EAF7F0", muted: "rgba(234,247,240,0.70)", faint: "rgba(234,247,240,0.46)", accent: "#7FE8B8", onAccent: "#05231A",
  chipFill: "rgba(255,255,255,0.09)", chipStroke: "rgba(255,255,255,0.26)", chipText: "#EAF7F0", brandText: "#F4FBF7",
};

/** Posição do glow por story (x,y em fração) — dá ambiance diferente pra cada peça. */
const GLOW: Record<string, [number, number]> = {
  privacidade: [0.28, 0.2],
  patrimonio: [0.74, 0.16],
  orcamento: [0.5, 0.4],
};

/** Foto de fundo temática por story (bem sutil + filtrada) — dá calor humano. Servida same-origin
 *  (/img/ads) → sem taint no canvas/MP4. A foto é carregada pelo chamador e passada ao drawStory. */
export const PHOTO_SRC: Record<string, string> = {
  patrimonio: "/img/ads/global.jpg",
  privacidade: "/img/ads/person.jpg",
  orcamento: "/img/ads/life.jpg",
  futuro: "/img/ads/horizon.jpg", // story "vivid" (foto vívida, não esmaecida)
  "app-tour": "/img/ads/dashboard.jpg", // capa vívida do tour: painel/gráficos (casa com "conheça o app")
  // Stories educativos — 1 foto TEMÁTICA e ÚNICA por peça (todas vívidas).
  "edu-orcamento": "/img/ads/budget.jpg", // calculadora + contas
  "edu-reserva": "/img/ads/savings.jpg", // cofrinho/dinheiro guardado
  "edu-juros": "/img/ads/grow.jpg", // muda crescendo em moedas
  "edu-diversificar": "/img/ads/spread.jpg", // gráfico subindo
  "edu-cambio": "/img/ads/money.jpg", // notas (moeda estrangeira)
  "edu-dividas": "/img/ads/plan.jpg", // planejando na mesa
};

/** SCREENSHOTS reais do app (conta demo/vitrine) — emoldurados como janela flutuante. Misturam-se
 *  com as fotos temáticas (variedade). Servidos same-origin (/img/ads) → sem taint no canvas/MP4. */
export const SHOT_SRC = {
  painel: "/img/ads/shot-painel.png",
  privado: "/img/ads/shot-privado.png",
  orcamento: "/img/ads/shot-orcamento.png",
  patrimonio: "/img/ads/shot-patrimonio.png",
  liberdade: "/img/ads/shot-liberdade.png",
  multimoeda: "/img/ads/shot-multimoeda.png",
  projecao: "/img/ads/shot-projecao.png",
} as const;

/** Cache de imagens já carregadas (por caminho) — deixa o draw resolver `shot` de forma SÍNCRONA
 *  (o chamador pré-carrega e registra; enquanto não chega, a cena cai no texto sem quebrar). */
const AD_IMAGES = new Map<string, CanvasImageSource>();
export function setAdImage(src: string, img: CanvasImageSource): void {
  AD_IMAGES.set(src, img);
}
function adImage(src?: string): CanvasImageSource | null {
  return src ? AD_IMAGES.get(src) ?? null : null;
}
/** Caminhos de SCREENSHOT que um story usa (cenas com `shot`) — pro chamador pré-carregar/registrar. */
export function storyShotSrcs(story: Story): string[] {
  return [...new Set(story.scenes.map((sc) => sc.shot).filter((x): x is string => !!x))];
}

export interface Scene {
  kind: "hook" | "networth" | "budget" | "privacy" | "cta";
  eyebrow?: string;
  title?: string[]; // linhas
  sub?: string;
  value?: string; // número-herói (networth/cta)
  badges?: string[]; // moedas
  bars?: { label: string; w: number; c?: string }[];
  tagline?: string;
  mock?: "currencies" | "masked" | "donut" | "freedom"; // mockup do app na cena de hook (preenche + varia)
  shot?: string; // SCREENSHOT real do app (/img/ads/shot-*.png) — emoldurado; substitui o mock nessa cena
  chips?: string[]; // pílulas de features (cena de amplitude/benefício)
  style?: PieceStyle; // clima DESTA cena (sobrescreve o do story) — deixa um mesmo story alternar templates
}
export interface Story {
  id: string;
  name: string; // rótulo no admin
  scenes: Scene[];
  style?: PieceStyle; // clima padrão do story (cada cena pode sobrescrever); default = escuro padrão
  /** EDUCATIVO: layout que ensina — foto menor, título moderado, EXPLICAÇÃO grande e com respiro
   *  (a institucional é punch: título gigante + legenda mínima). Ver o ramo "vivid" em sceneContent. */
  teach?: boolean;
  /** Segundos por cena (default SCENE_DUR=4). Educativos usam 6 — a explicação é longa, precisa
   *  de tempo pra LER (não só decodificar) antes do fade. */
  sceneDur?: number;
  /** Segundos EXTRAS parados na última cena (CTA); default LAST_HOLD=2.5. Educativos usam 3. */
  lastHold?: number;
}

export const STORIES: Story[] = [
  // Arco de cada peça: PROBLEMA (a dor) → O APP (mockup + o que é) → AMPLITUDE/BENEFÍCIO → CTA.
  // Peça-carro-chefe: o soco na EVITAÇÃO (agressivo, 100% honesto — nada de "o app te enriquece").
  {
    id: "medo-de-olhar",
    name: "Medo de olhar",
    scenes: [
      { kind: "hook", eyebrow: "A VERDADE QUE NINGUÉM FALA", title: ["Você não tem", "medo de investir.", "Tem medo de olhar."] },
      { kind: "hook", mock: "currencies", eyebrow: "ENCARE O NÚMERO", title: ["Todo o seu", "dinheiro, somado."], sub: "Real, euro, dólar — num painel só, na cotação de hoje. Sem mais adivinhação." },
      { kind: "hook", eyebrow: "E QUANTO FALTA", title: ["Quanto falta pra", "sua liberdade."], sub: "Patrimônio, orçamento e projeção de independência — no seu ritmo, cifrado ponta a ponta." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Encare seus números — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "patrimonio",
    name: "Quanto você tem",
    scenes: [
      { kind: "hook", eyebrow: "DINHEIRO EM MAIS DE UMA MOEDA?", title: ["Real, euro, dólar…", "quanto você tem", "somando tudo?"] },
      { kind: "hook", mock: "currencies", eyebrow: "UM PAINEL SÓ", title: ["Tudo, em", "qualquer moeda."], sub: "Na cotação de hoje — sem planilha, sem abrir conta." },
      { kind: "hook", eyebrow: "E VAI MUITO ALÉM", title: ["Sua vida", "financeira inteira."], chips: ["Patrimônio", "Orçamento", "Investimentos", "Metas", "Projeção"] },
      { kind: "cta", value: "Nossas Finanças", tagline: "Descubra quanto você tem — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "privacidade",
    name: "Privacidade",
    scenes: [
      { kind: "hook", eyebrow: "SOBRE OS APPS DE FINANÇAS", title: ["Eles veem tudo", "o que você tem.", "E lucram com isso."] },
      { kind: "hook", mock: "masked", eyebrow: "CRIPTOGRAFIA PONTA A PONTA", title: ["O nosso não", "vê nada."], sub: "Tudo cifrado no seu aparelho. Nem eu, no servidor, vejo." },
      { kind: "hook", eyebrow: "PRIVACIDADE DE VERDADE", title: ["Seus números.", "Só seus."], sub: "Sem anúncios e sem vender os seus dados." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Comece grátis — seus dados vão junto", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "orcamento",
    name: "Orçamento & liberdade",
    scenes: [
      { kind: "hook", eyebrow: "TODO FIM DE MÊS", title: ["Pra onde foi", "o seu dinheiro?"] },
      { kind: "hook", mock: "donut", eyebrow: "ORÇAMENTO", title: ["Cada real,", "organizado."], sub: "Em qualquer moeda, com o gráfico do mês." },
      { kind: "hook", eyebrow: "E O FUTURO?", title: ["Veja quando você", "fica livre."], sub: "Projeção de independência financeira, no seu ritmo." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Deixe o dinheiro sobrar — grátis", sub: "nossasfinancas.com.br" },
    ],
  },

  // ── 3 NOVOS: designs completamente diferentes (paletas claro / sobre-cor / foto vívida) ──
  {
    id: "simples",
    name: "Simples · papel claro",
    style: "light",
    scenes: [
      { kind: "hook", eyebrow: "CONTROLE FINANCEIRO", title: ["Finanças não", "precisam ser", "complicadas."] },
      { kind: "hook", eyebrow: "SEM PLANILHA, SEM FRICÇÃO", title: ["Abra e comece.", "Em minutos."], sub: "Nada pra instalar, sem cadastrar cartão. Funciona no navegador — e offline." },
      { kind: "hook", eyebrow: "SÓ O QUE IMPORTA", title: ["Clareza.", "Todo dia."], chips: ["Patrimônio", "Orçamento", "Metas", "Projeção"] },
      { kind: "cta", value: "Nossas Finanças", tagline: "Comece agora — em minutos, grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "fronteiras",
    name: "Sem fronteiras · verde bold",
    style: "color",
    scenes: [
      { kind: "hook", eyebrow: "MANIFESTO", title: ["Seu dinheiro", "não devia ficar", "preso a um país."] },
      { kind: "hook", eyebrow: "MULTIMOEDA DE VERDADE", title: ["Real, euro,", "dólar — juntos."], sub: "Cada item guarda a própria moeda. Você escolhe em qual ver o total." },
      { kind: "hook", eyebrow: "ONDE VOCÊ ESTIVER", title: ["Uma vida.", "Uma tela."], chips: ["Brasil", "Itália", "Qualquer lugar"] },
      { kind: "cta", value: "Nossas Finanças", tagline: "Comece grátis — sem fronteiras", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "futuro",
    name: "Seu futuro · foto vívida",
    style: "vivid",
    scenes: [
      { kind: "hook", eyebrow: "INDEPENDÊNCIA FINANCEIRA", title: ["Que dia você", "para de depender", "do salário?"] },
      { kind: "hook", eyebrow: "A CONTA EXISTE", title: ["Projete o seu", "futuro."], sub: "Aportes e inflação real, ano a ano. A data fica mais perto a cada real guardado." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Descubra sua data — grátis", sub: "nossasfinancas.com.br" },
    ],
  },

  // ── TOUR COMPLETO: apresenta o app inteiro, alternando o TEMPLATE a cada cena (style por cena) ──
  {
    id: "app-tour",
    name: "Tour do app · multi-template",
    scenes: [
      { kind: "hook", style: "dark", shot: SHOT_SRC.painel, eyebrow: "CONHEÇA O APP", title: ["Suas finanças,", "num app só."], sub: "Multimoeda, privado e simples — dá pra ver tudo numa tela." },
      { kind: "hook", style: "dark", shot: SHOT_SRC.multimoeda, eyebrow: "1 · MULTIMOEDA", title: ["Tudo, em", "qualquer moeda."], sub: "Real, euro, dólar — cada item na sua moeda, o total na cotação de hoje." },
      { kind: "hook", style: "dark", shot: SHOT_SRC.privado, eyebrow: "2 · PRIVACIDADE", title: ["Cifrado. Só", "você vê."], sub: "Criptografia ponta a ponta: nem eu, no servidor, vejo os seus números." },
      { kind: "hook", style: "dark", shot: SHOT_SRC.orcamento, eyebrow: "3 · ORÇAMENTO", title: ["Cada real,", "organizado."], sub: "Gastos por categoria, em qualquer moeda, com o gráfico do mês." },
      { kind: "hook", style: "dark", shot: SHOT_SRC.liberdade, eyebrow: "4 · LIBERDADE", title: ["Veja quando", "você fica livre."], sub: "Projeção de independência financeira com aportes e inflação real." },
      { kind: "cta", style: "color", value: "Nossas Finanças", tagline: "Comece agora — grátis, sem cartão", sub: "nossasfinancas.com.br" },
    ],
  },
];

export const storyDuration = (st: Story) => st.scenes.length * (st.sceneDur ?? SCENE_DUR) + (st.lastHold ?? LAST_HOLD);

// ── STORIES EDUCATIVOS ───────────────────────────────────────────────────────
// Templates de conteúdo que ENSINA (não institucional): troque texto/estilo pra falar de qualquer
// tema. Sem foto (usam claro/verde/escuro + a cena de barras) → nenhum asset novo. Arco: gancho →
// conteúdo → lição.
export const EDU_STORIES: Story[] = [
  {
    id: "edu-orcamento",
    name: "Educativo · regra 50/30/20",
    style: "vivid",
    teach: true,
    sceneDur: 6,
    lastHold: 3,
    scenes: [
      { kind: "hook", eyebrow: "ORÇAMENTO SEM COMPLICAR", title: ["A regra", "50 · 30 · 20"], sub: "Um jeito simples de dividir a renda pra não se perder no mês — e ainda sobrar pro futuro." },
      { kind: "hook", eyebrow: "COMO DIVIDIR A RENDA", title: ["Cada real", "tem um lugar."], sub: "Metade no que você PRECISA, 30% no que QUER e 20% pro amanhã. Só isso.", chips: ["50% Essenciais", "30% Desejos", "20% Investir"] },
      { kind: "hook", eyebrow: "NUM SALÁRIO DE R$ 3.000", title: ["R$ 1.500 ·", "900 · 600"], sub: "R$ 1.500 nas contas do mês, R$ 900 no lazer e R$ 600 investidos — todo mês, no piloto automático." },
      { kind: "hook", eyebrow: "O SEGREDO", title: ["Poupe ANTES", "de gastar."], sub: "Separe os 20% assim que a renda cai; o resto se vira com o que sobra. Nunca o contrário — senão nunca sobra." },
      { kind: "hook", eyebrow: "DA TEORIA PRA PRÁTICA", title: ["No Nossas Finanças,", "cada real acha", "o lugar."], sub: "Você põe o gasto na categoria e o app monta o gráfico do mês — sem planilha." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Monte seu orçamento — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "edu-reserva",
    name: "Educativo · reserva de emergência",
    style: "vivid",
    teach: true,
    sceneDur: 6,
    lastHold: 3,
    scenes: [
      { kind: "hook", eyebrow: "A BASE DE TUDO", title: ["Você tem uma", "reserva de", "emergência?"], sub: "É o primeiro passo das finanças — vem ANTES de investir em qualquer coisa." },
      { kind: "hook", eyebrow: "O QUE É", title: ["O dinheiro que", "te segura."], sub: "Se a renda parar ou vier um imprevisto (saúde, conserto, desemprego), você resolve sem cartão nem empréstimo caro." },
      { kind: "hook", eyebrow: "QUANTO GUARDAR", title: ["3 a 6 meses", "de gastos."], sub: "Gasta R$ 2.000/mês? Mire entre R$ 6.000 e R$ 12.000 — e deixe onde dê pra sacar no mesmo dia." },
      { kind: "hook", eyebrow: "COMO MONTAR", title: ["Um aporte fixo,", "todo mês."], sub: "No automático, até chegar no alvo. Use só em emergência de verdade — e reponha depois de usar." },
      { kind: "hook", eyebrow: "SEM PERDER DE VISTA", title: ["No Nossas Finanças,", "vira barra de", "progresso."], sub: "Você cria a meta da reserva e vê, todo mês, quanto subiu e quanto falta pro alvo." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Monte sua reserva — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "edu-juros",
    name: "Educativo · juros compostos",
    style: "vivid",
    teach: true,
    sceneDur: 6,
    lastHold: 3,
    scenes: [
      { kind: "hook", eyebrow: "O TEMPO É O TRUQUE", title: ["Por que começar", "cedo muda tudo?"], sub: "Por causa do efeito mais poderoso das finanças pessoais: os juros compostos." },
      { kind: "hook", eyebrow: "O QUE SÃO", title: ["Rendimento sobre", "rendimento."], sub: "O que você ganha passa a render também. A bola de neve cresce cada vez mais rápido — sozinha." },
      { kind: "hook", eyebrow: "UM EXEMPLO REAL", title: ["R$ 200/mês →", "~R$ 280 mil"], sub: "Em 30 anos, a ~8% ao ano. Você deposita só R$ 72 mil; o resto — mais de R$ 200 mil — é rendimento." },
      { kind: "hook", eyebrow: "A LIÇÃO", title: ["Comece pequeno,", "mas comece já."], sub: "Tempo vale mais que valor. Cada ano a mais faz uma diferença enorme lá na frente." },
      { kind: "hook", eyebrow: "DE OLHO NO AMANHÃ", title: ["No Nossas Finanças,", "você vê a", "bola de neve."], sub: "Projeta quanto vai ter com aportes e inflação real, ano a ano — no seu ritmo." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Projete quando fica livre — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "edu-diversificar",
    name: "Educativo · diversificação",
    style: "vivid",
    teach: true,
    sceneDur: 6,
    lastHold: 3,
    scenes: [
      { kind: "hook", eyebrow: "REGRA DE OURO", title: ["Não ponha tudo", "num lugar só."], sub: "A regra mais antiga do dinheiro — e uma das que mais protege quem investe." },
      { kind: "hook", eyebrow: "O QUE É DIVERSIFICAR", title: ["Espalhar", "o risco."], sub: "Dividir o dinheiro entre tipos de ativo (e moedas) pra não depender de uma aposta só dar certo." },
      { kind: "hook", eyebrow: "NA PRÁTICA", title: ["Se um cai, os", "outros seguram."], sub: "Renda fixa + ações + FIIs + moedas: quando um tomba, o conjunto amortece e você sente bem menos." },
      { kind: "hook", eyebrow: "O PONTO", title: ["Menos risco,", "não mais."], sub: "Diversificar não é arriscar mais — é não colocar todos os ovos na mesma cesta." },
      { kind: "hook", eyebrow: "SUA CARTEIRA INTEIRA", title: ["No Nossas Finanças,", "seu mix fica", "visível."], sub: "Cada investimento na sua moeda, num gráfico só — você vê o desequilíbrio e rebalanceia." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Veja sua alocação — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "edu-cambio",
    name: "Educativo · câmbio no seu bolso",
    style: "vivid",
    teach: true,
    sceneDur: 6,
    lastHold: 3,
    scenes: [
      { kind: "hook", eyebrow: "SE VOCÊ TEM MOEDA LÁ FORA", title: ["O câmbio mexe", "no seu", "patrimônio."], sub: "Real, euro, dólar: quem vive entre moedas sente a cotação no bolso — todos os dias." },
      { kind: "hook", eyebrow: "COMO ASSIM", title: ["Euro sobe,", "seu total sobe."], sub: "Quem guarda em mais de uma moeda ganha (ou perde) sem fazer nada — só pela cotação do dia." },
      { kind: "hook", eyebrow: "UM EXEMPLO", title: ["€ 1.000 hoje", "≠ amanhã."], sub: "Se o euro sobe 5%, seus € 1.000 valem 5% a mais em real — sem você mexer num centavo." },
      { kind: "hook", eyebrow: "A DICA", title: ["Acompanhe numa", "moeda só."], sub: "Ver tudo convertido pra uma moeda evita susto e mostra o efeito real do câmbio no seu bolso." },
      { kind: "hook", eyebrow: "TUDO EM UMA MOEDA", title: ["No Nossas Finanças,", "você escolhe", "a moeda."], sub: "Real, euro, dólar — você vê o patrimônio inteiro na cotação de hoje, na moeda que preferir." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Veja tudo numa moeda só — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
  {
    id: "edu-dividas",
    name: "Educativo · sair das dívidas",
    style: "vivid",
    teach: true,
    sceneDur: 6,
    lastHold: 3,
    scenes: [
      { kind: "hook", eyebrow: "PRIMEIRO PASSO PRA INVESTIR", title: ["Ataque a dívida", "mais cara", "primeiro."], sub: "Antes de investir, quitar dívida cara é o melhor 'investimento' que existe." },
      { kind: "hook", eyebrow: "POR QUÊ", title: ["Cartão rende", "contra você."], sub: "Os juros de cartão e cheque especial superam QUALQUER investimento. Quitar é lucro garantido." },
      { kind: "hook", eyebrow: "A CONTA", title: ["Rotativo passa", "de 300% ao ano."], sub: "Nenhum investimento paga isso. Cada real da dívida cara que você mata rende mais que aplicar." },
      { kind: "hook", eyebrow: "A ORDEM CERTA", title: ["Maior juro,", "não maior valor."], sub: "Liste as dívidas pela TAXA e mate a de juro mais alto primeiro — depois a próxima, e assim vai." },
      { kind: "hook", eyebrow: "NA ORDEM CERTA", title: ["No Nossas Finanças,", "você organiza", "e ataca."], sub: "Registra suas dívidas no patrimônio e vê o total cair a cada pagamento." },
      { kind: "cta", value: "Nossas Finanças", tagline: "Organize suas dívidas — grátis", sub: "nossasfinancas.com.br" },
    ],
  },
];

// ── LEGENDAS DOS REELS ───────────────────────────────────────────────────────
// Os vídeos 9:16 (STORIES/EDU_STORIES) viram Reels no feed → precisam de legenda + 1º comentário.
// Curtas (o vídeo carrega o conteúdo) + CTA de cadastro. Só features REAIS (o app é tracker/planner,
// não corretora — nada de "auto-investir"). Keyed pelo id do story.
export const REEL_COPY: Record<string, { caption: string; comment: string }> = {
  "medo-de-olhar": {
    caption: "Você não tem medo de investir. Você tem medo de olhar. 👀\n\nA planilha que você não abre há meses sabe uma verdade que você tá evitando. No Nossas Finanças você encara: todo o seu dinheiro, em qualquer moeda, num lugar só — e quanto falta pra sua liberdade. Cifrado ponta a ponta: nem a gente vê.\n\n📲 Encare grátis — link na bio.",
    comment: "Sincerão: há quanto tempo você não soma tudo o que tem? 👇\n\nApp grátis 👉 nossasfinancas.com.br",
  },
  patrimonio: {
    caption: "Real na conta daqui, euro guardado lá fora, uns dólares investidos — e no fim você não sabe QUANTO tem. 🤯\n\nNo Nossas Finanças você junta tudo num número só, na cotação de hoje. Multimoeda de verdade, grátis.\n\n📲 Comece grátis — link na bio.",
    comment: "Você guarda dinheiro em mais de uma moeda? Conta aí 👇\n\nApp grátis 👉 nossasfinancas.com.br",
  },
  privacidade: {
    caption: "A maioria dos apps de finanças LÊ cada número seu — e lucra com isso. 🫥\n\nO Nossas Finanças não: tudo cifrado no seu aparelho, nem eu no servidor vejo. Privacidade de verdade.\n\n📲 Comece grátis — link na bio.",
    comment: "Você já tinha pensado que a maioria dos apps lê tudo o que você tem? 👀\n\nApp grátis 👉 nossasfinancas.com.br",
  },
  orcamento: {
    caption: "Todo fim de mês a mesma pergunta: cadê o dinheiro? 😅\n\nNo Nossas Finanças você vê pra onde foi cada real, por categoria — e sobra mais no fim do mês.\n\n📲 Comece grátis — link na bio.",
    comment: "No fim do mês você sabe pra onde foi o seu dinheiro? Responde sincero 👇\n\nApp grátis na bio.",
  },
  simples: {
    caption: "Finanças não precisam ser complicadas. 🙌\n\nAbra o Nossas Finanças e comece em minutos — sem instalar, sem cadastrar cartão, no navegador.\n\n📲 Grátis — link na bio.",
    comment: "O que mais te trava pra organizar o dinheiro hoje? 👇\n\nApp grátis na bio.",
  },
  fronteiras: {
    caption: "Seu dinheiro não devia ficar preso a um país. 🌍\n\nNo Nossas Finanças cada item guarda a própria moeda; você vê o total em qualquer uma. Feito pra quem vive entre países.\n\n📲 Comece grátis — link na bio.",
    comment: "Você vive (ou pensa em viver) entre países? Conta de onde pra onde 👇\n\nApp grátis na bio.",
  },
  futuro: {
    caption: "Que dia você para de depender do salário? 📈\n\nNo Nossas Finanças você projeta a data — com aportes e inflação real, ano a ano, no seu ritmo.\n\n📲 Descubra grátis — link na bio.",
    comment: "Chuta aí: quantos anos faltam pra sua liberdade financeira? 👇\n\nDescubra no app, grátis.",
  },
  "app-tour": {
    caption: "Suas finanças, num app só. 👀\n\nMultimoeda, privado e simples: patrimônio, orçamento, metas e projeção numa tela.\n\n📲 Comece grátis — link na bio.",
    comment: "Qual parte da sua vida financeira é a mais bagunçada hoje? 👇\n\nApp grátis na bio.",
  },
  "edu-orcamento": {
    caption: "A regra mais simples pra organizar a renda: 50 · 30 · 20. 💸\n\n50% essenciais, 30% desejos, 20% pro futuro. No Nossas Finanças você monta o seu — grátis, sem planilha.\n\n📲 Link na bio.",
    comment: "Você já usa alguma regra pra dividir a renda? 👇\n\nMonte o seu no app (grátis).",
  },
  "edu-reserva": {
    caption: "Reserva de emergência: 3 a 6 meses de gasto guardado. 🛟\n\nÉ o que te segura num imprevisto sem cair no cartão. No Nossas Finanças você cria a meta e acompanha o progresso.\n\n📲 Comece grátis — link na bio.",
    comment: "Quantos meses de gasto você já tem guardado? 👇\n\nApp grátis na bio.",
  },
  "edu-juros": {
    caption: "R$ 200/mês por 30 anos ≈ R$ 280 mil. Você deposita R$ 72 mil; o resto é juros. 📈\n\nÉ o poder do tempo. No Nossas Finanças você projeta o SEU número, com inflação real.\n\n📲 Grátis — link na bio.",
    comment: "Começar cedo ou investir mais — o que pesa mais? 👇\n\nProjete o seu no app (grátis).",
  },
  "edu-diversificar": {
    caption: "Não ponha tudo num lugar só. 🥚\n\nDiversificar é espalhar o risco: se um cai, os outros seguram. No Nossas Finanças você vê sua alocação e rebalanceia.\n\n📲 Grátis — link na bio.",
    comment: "Você diversifica ou está tudo num lugar só? 👇\n\nVeja sua alocação no app (grátis).",
  },
  "edu-cambio": {
    caption: "Se você tem moeda lá fora, o câmbio mexe no seu patrimônio — mesmo com o dinheiro parado. 🌍\n\nNo Nossas Finanças você vê tudo convertido, na moeda que quiser, na cotação de hoje.\n\n📲 Comece grátis — link na bio.",
    comment: "Você acompanha o câmbio quando tem dinheiro em outra moeda? 👇\n\nApp grátis na bio.",
  },
  "edu-dividas": {
    caption: "Antes de investir: ataque a dívida mais cara primeiro. 🔴\n\nCartão e cheque especial rendem CONTRA você (passam de 300%/ano). No Nossas Finanças você organiza e vê o total cair.\n\n📲 Grátis — link na bio.",
    comment: "Qual dívida te incomoda mais hoje? 👇\n\nOrganize no app (grátis).",
  },
};

// ── CAPAS DOS REELS (PADRONIZADAS) ───────────────────────────────────────────
// Mesmo LAYOUT pra todas (série coesa no grid): marca no topo · eyebrow (categoria) · TÍTULO grande
// de referência ao tema · rodapé com o site. Varia SÓ a cor de fundo (paletas que já existem:
// escuro / verde bold / papel claro) — sem foto, pra não ficar cada uma diferente.
type CoverBg = "dark" | "color" | "light";
export const REEL_COVER: Record<string, { eyebrow: string; title: string[]; bg: CoverBg }> = {
  "medo-de-olhar": { eyebrow: "ENCARE", title: ["Você tem medo", "de olhar."], bg: "dark" },
  patrimonio: { eyebrow: "MULTIMOEDA", title: ["Quanto você tem,", "somando tudo?"], bg: "dark" },
  privacidade: { eyebrow: "PRIVACIDADE", title: ["Seus números,", "só seus."], bg: "dark" },
  orcamento: { eyebrow: "ORÇAMENTO", title: ["Pra onde vai", "o seu dinheiro?"], bg: "color" },
  simples: { eyebrow: "SIMPLES", title: ["Finanças sem", "complicação."], bg: "light" },
  fronteiras: { eyebrow: "SEM FRONTEIRAS", title: ["Dinheiro sem", "fronteiras."], bg: "color" },
  futuro: { eyebrow: "LIBERDADE", title: ["Quando você", "fica livre?"], bg: "dark" },
  "app-tour": { eyebrow: "CONHEÇA O APP", title: ["Suas finanças,", "num app só."], bg: "color" },
  "edu-orcamento": { eyebrow: "EDUCATIVO", title: ["A regra", "50 · 30 · 20"], bg: "light" },
  "edu-reserva": { eyebrow: "EDUCATIVO", title: ["Reserva de", "emergência"], bg: "color" },
  "edu-juros": { eyebrow: "EDUCATIVO", title: ["Juros", "compostos"], bg: "dark" },
  "edu-diversificar": { eyebrow: "EDUCATIVO", title: ["Como", "diversificar"], bg: "light" },
  "edu-cambio": { eyebrow: "EDUCATIVO", title: ["O câmbio no", "seu bolso"], bg: "color" },
  "edu-dividas": { eyebrow: "EDUCATIVO", title: ["Como sair", "das dívidas"], bg: "dark" },
};

// ── POSTS ESTÁTICOS (feed 4:5, 1080×1350, exportados em PNG) ─────────────────
// Mesma estética/engine dos stories, mas UM quadro parado por peça (sem animação/tempo). 6 peças
// cobrindo os 4 pilares: multimoeda/cross-border, privacidade, organização/FIRE, build-in-public.
/** Campos VISUAIS de um quadro 4:5 — compartilhados por Post (feed) e Slide (carrossel):
 *  drawPost lê só isto, então um post e um slide de carrossel são renderizados pela MESMA função. */
export interface PieceVisual {
  glow?: [number, number]; // posição do brilho (fração de W,H)
  photo?: string; // foto de fundo (/img/ads/...) — dá variedade ao feed
  green?: boolean; // fundo verde PROFUNDO (variante esverdeada)
  style?: PieceStyle; // clima (claro / sobre-cor / foto vívida / escuro); default = escuro padrão
  eyebrow: string;
  title: string[]; // linhas
  sub?: string;
  mock?: "currencies" | "masked" | "donut" | "freedom"; // mockup do app
  shot?: string; // SCREENSHOT real do app (/img/ads/shot-*.png) — emoldurado; substitui o mock
  chips?: string[]; // pílulas
  compare?: { head: [string, string]; rows: { label: string; a: string; b: string }[] }; // tabela BR×IT
  stat?: { value: string; label: string }; // número-herói (arranjo "estatística", combina com style claro)
  steps?: { title: string; desc?: string }[]; // lista/passo-a-passo (educativo)
  stepMarker?: "number" | "check" | "dot"; // marcador da lista (default número)
}
export interface Post extends PieceVisual {
  id: string;
  name: string; // rótulo no admin
  pillar: string; // pilar (rótulo no card)
  caption?: string; // legenda pronta pro Instagram (copiar e colar)
  tags?: string[]; // hashtags (sem #)
  comment?: string; // 1º comentário pronto (gancho de engajamento: pergunta + "salva" + link)
}
/** Um quadro do carrossel = os mesmos campos visuais de um post (sem os metadados do feed). */
export type Slide = PieceVisual;
/** Carrossel: várias imagens 4:5 numa mesma publicação (uma legenda só). Os slides VARIAM de
 *  template pra ficar dinâmico. Exportado como N PNGs numerados. */
export interface Carousel {
  id: string;
  name: string;
  pillar: string;
  slides: Slide[];
  caption?: string;
  tags?: string[];
  comment?: string; // 1º comentário pronto (gancho de engajamento: pergunta + "salva" + link)
}

export const POSTS: Post[] = [
  {
    id: "apresentacao",
    name: "Apresentação · a marca (perfil)",
    comment:
      "Curtiu a ideia? Me segue aqui 👀 e comenta: qual a parte mais difícil de organizar o seu dinheiro hoje? 👇\n\nApp grátis no link da bio 👉 nossasfinancas.com.br",
    pillar: "Apresentação",
    caption:
      "Prazer, eu sou o Nossas Finanças. 👋\n\nUm app pra você ver TODO o seu dinheiro — em qualquer moeda — num lugar só: patrimônio, orçamento, investimentos e metas. Feito por quem vive entre países, pra quem ganha numa moeda e gasta noutra.\n\nE com uma regra que eu não abro mão: seus números são cifrados no seu aparelho, antes de irem pra qualquer lugar. Nem eu, no servidor, vejo. Privacidade de verdade.\n\nGrátis pra começar, funciona offline e roda no navegador — sem instalar nada, sem cadastrar cartão.\n\n📲 Link na bio. Seja bem-vindo(a). 💚",
    tags: ["financaspessoais", "multimoeda", "privacidade", "expatriados", "brasileirosnoexterior", "controlefinanceiro", "organizacaofinanceira", "independenciafinanceira", "appdefinancas", "morarfora"],
    shot: SHOT_SRC.painel,
    eyebrow: "NOSSAS FINANÇAS",
    title: ["Seu dinheiro,", "num app só."],
    sub: "Multimoeda, privado e simples — feito por quem vive entre países. Grátis pra começar.",
  },
  {
    id: "multimoeda",
    name: "Multimoeda · somando tudo",
    comment:
      "Você guarda dinheiro em mais de uma moeda? Conta aí quais 👇\n\nSalva esse post pra testar depois — app grátis na bio 👉 nossasfinancas.com.br",
    pillar: "Multimoeda",
    caption:
      "Real na conta daqui, euro guardado lá fora, uns dólares investidos… e no fim você não sabe QUANTO tem no total. 🤯\n\nO Nossas Finanças junta tudo num número só, na cotação de hoje — sem planilha e sem abrir conta em lugar nenhum. Cada item guarda a própria moeda; você só escolhe em qual ver o total.\n\nSeu patrimônio inteiro, numa tela. 👀\n\n📲 Grátis pra começar — link na bio.",
    tags: ["financaspessoais", "multimoeda", "expatriados", "brasileirosnoexterior", "cambio", "controlefinanceiro", "vidafinanceira", "dinheiro", "organizacaofinanceira", "patrimonio"],
    photo: "/img/ads/global.jpg",
    eyebrow: "REAL, EURO, DÓLAR",
    title: ["Quanto você tem", "somando tudo?"],
    mock: "currencies",
    sub: "Cada moeda na cotação de hoje, num número só — sem planilha, sem abrir conta.",
  },
  {
    id: "custo-vida",
    name: "Custo de vida · BR × Itália",
    comment:
      "Você toparia essa troca? 🇧🇷↔️🇮🇹 Comenta qual número te surpreendeu 👇\n\nSalva pra quando for planejar a mudança. Link na bio.",
    pillar: "Multimoeda",
    caption:
      "Quanto custa a MESMA vida em São Paulo e em Milão? 🇧🇷🇮🇹\n\nAluguel, mercado, transporte, um jantar a dois — os números mudam muito (e nem sempre pra pior). Antes de se mudar, dá pra ver tudo nas duas moedas, lado a lado.\n\nÉ pra isso que existe o Nossas Finanças: seu patrimônio e seus gastos em real E euro, na cotação de hoje, sem malabarismo de planilha.\n\n💬 Você toparia essa troca? Comenta aí.\n📲 Cadastre-se grátis — link na bio.",
    tags: ["custodevida", "morarnaitalia", "brasileirosnaitalia", "expatriados", "mudardepais", "euro", "relocation", "vivernaitalia", "multimoeda", "financaspessoais"],
    glow: [0.3, 0.16],
    eyebrow: "MUDAR DE PAÍS",
    title: ["São Paulo", "× Milão"],
    compare: {
      head: ["SÃO PAULO", "MILÃO"],
      rows: [
        { label: "Aluguel (1 quarto)", a: "R$ 2.800", b: "€ 1.100" },
        { label: "Mercado no mês", a: "R$ 1.200", b: "€ 320" },
        { label: "Transporte/mês", a: "R$ 220", b: "€ 39" },
        { label: "Jantar a dois", a: "R$ 180", b: "€ 55" },
      ],
    },
    sub: "O app mostra o seu patrimônio e os gastos nas duas moedas, lado a lado.",
  },
  {
    id: "privacidade",
    name: "Privacidade · eles lucram",
    comment:
      "Você já tinha parado pra pensar que a maioria dos apps lê cada número seu? 👀 Comenta 👇\n\nCompartilha com quem precisa ver isso. App na bio 👉 nossasfinancas.com.br",
    pillar: "Privacidade",
    caption:
      "A maioria dos apps de finanças lê CADA número seu — e ganha dinheiro com isso (anúncio, venda de dado, “parceiros”). 🫥\n\nO Nossas Finanças foi feito ao contrário: seus dados são cifrados no seu próprio aparelho, antes de irem pra qualquer lugar. Nem eu, no servidor, consigo ver os seus valores. Criptografia ponta a ponta, de verdade.\n\nPrivacidade não é um recurso. É a fundação. 🔒\n\n📲 Grátis — link na bio.",
    tags: ["privacidade", "criptografia", "segurancadigital", "protecaodedados", "financaspessoais", "dadospessoais", "semrastreio", "e2ee", "tecnologia", "financas"],
    photo: "/img/ads/person.jpg",
    eyebrow: "SOBRE OS APPS DE FINANÇAS",
    title: ["Eles veem tudo", "o que você tem.", "E lucram com isso."],
    mock: "masked",
    sub: "O nosso não vê nada: tudo cifrado no seu aparelho. Nem eu, no servidor.",
  },
  {
    id: "orcamento",
    name: "Orçamento · pra onde foi",
    comment:
      "No fim do mês você sabe pra onde foi o seu dinheiro? Responde sincero 👇\n\nSalva esse post pra começar o seu. App grátis na bio.",
    pillar: "Organização",
    caption:
      "Todo fim de mês a mesma pergunta: cadê o dinheiro? 😅\n\nQuando cada gasto está organizado por categoria — em qualquer moeda — a resposta vira um gráfico. Você vê pra onde foi, corta o que não faz sentido e sobra mais no fim do mês.\n\nSem culpa e sem planilha gigante. Só clareza.\n\n📲 Comece grátis — link na bio.",
    tags: ["orcamento", "controlefinanceiro", "organizacaofinanceira", "financaspessoais", "economia", "planejamentofinanceiro", "dinheiro", "gastos", "educacaofinanceira", "vidafinanceira"],
    glow: [0.5, 0.4],
    eyebrow: "TODO FIM DE MÊS",
    title: ["Pra onde foi", "o seu dinheiro?"],
    shot: SHOT_SRC.orcamento,
    sub: "Cada real organizado por categoria — em qualquer moeda, com o gráfico do mês.",
  },
  {
    id: "liberdade",
    name: "Liberdade · quando fica livre",
    comment:
      "Você já sabe o seu número da liberdade? Chuta aí quantos anos faltam 👇\n\nSalva e volta aqui quando descobrir. App grátis na bio 👉 nossasfinancas.com.br",
    pillar: "Organização / FIRE",
    caption:
      "Independência financeira não é sorte — é conta. 📈\n\nCom quanto você para de depender do salário? Em quantos anos? O Nossas Finanças projeta o seu futuro com aportes e inflação real, ano a ano, no SEU ritmo. Dá pra ver a data chegar mais perto cada vez que você guarda um pouco mais.\n\nO primeiro passo é enxergar o número. 🎯\n\n📲 Descubra grátis — link na bio.",
    tags: ["independenciafinanceira", "fire", "liberdadefinanceira", "investimentos", "aposentadoria", "financaspessoais", "investir", "projecaofinanceira", "patrimonio", "dinheiro"],
    green: true,
    glow: [0.6, 0.32],
    eyebrow: "E O FUTURO?",
    title: ["Veja quando", "você fica livre."],
    sub: "Projeção de independência financeira com aportes e inflação real — no seu ritmo.",
    chips: ["Projeção", "Aportes", "Inflação real", "Ano a ano"],
  },
  {
    id: "build",
    name: "Build in public · dev",
    comment:
      "Você confia mais num app feito por uma empresa gigante ou por alguém que usa no próprio dia a dia? 👇\n\nSe curte acompanhar os bastidores, me segue aqui. App na bio 👉 nossasfinancas.com.br",
    pillar: "Build in public",
    caption:
      "Confissão: eu não achei o app que eu queria… então construí. 👨‍💻\n\nSou dev e estou me mudando do Brasil pra Itália. Precisava enxergar meu dinheiro em real E euro, num lugar só, sem entregar meus dados pra ninguém. Como não existia do jeito certo — privado, multimoeda e simples — fiz o Nossas Finanças. E abri de graça pra você usar.\n\nTô construindo à vista de todos. Vem usar comigo. 🚀\n\n📲 Cadastre-se grátis — link na bio.",
    tags: ["buildinpublic", "devbr", "empreendedorismo", "startup", "multimoeda", "privacidade", "brasileirosnaitalia", "indiehacker", "financaspessoais", "fazendoacontecer"],
    photo: "/img/ads/life.jpg",
    eyebrow: "POR QUE EXISTE",
    title: ["Construí porque", "eu mesmo precisava."],
    sub: "Sou dev e me mudo do Brasil pra Itália. Fiz o app que eu queria — privado e multimoeda — e abri pra você.",
    chips: ["Sem anúncios", "Sem rastreio", "Grátis pra começar"],
  },

  // ── 3 NOVOS: designs completamente diferentes (papel claro / verde bold / foto vívida) ──
  {
    id: "cambio",
    name: "Câmbio · papel claro (número)",
    comment:
      "Você acompanha o câmbio quando tem dinheiro em mais de uma moeda? Comenta 👇\n\nSalva pra ver o efeito no seu bolso. App grátis na bio 👉 nossasfinancas.com.br",
    pillar: "Multimoeda",
    style: "light",
    caption:
      "O euro subiu 3% essa semana. Boa notícia ou má notícia? Depende de onde está o seu dinheiro. 📉📈\n\nQuem tem patrimônio em mais de uma moeda sente o câmbio no bolso o tempo todo — só que quase ninguém enxerga QUANTO. O Nossas Finanças recalcula tudo na cotação de hoje e mostra, num número só, o que o câmbio fez com o seu total.\n\nPare de adivinhar. Veja. 👀\n\n📲 Grátis pra começar — link na bio.",
    tags: ["cambio", "dolar", "euro", "multimoeda", "financaspessoais", "brasileirosnoexterior", "expatriados", "investimentos", "patrimonio", "mercadofinanceiro"],
    eyebrow: "O EURO MEXEU ESSA SEMANA",
    title: ["Quanto isso mudou", "no seu bolso?"],
    stat: { value: "+ R$ 8.400", label: "no seu patrimônio, só pelo câmbio" },
    sub: "O app recalcula tudo na cotação de hoje — você vê o efeito do câmbio na hora.",
  },
  {
    id: "sem-fronteiras",
    name: "Sem fronteiras · verde bold",
    comment:
      "Você vive (ou pensa em viver) entre países? Conta aí de onde pra onde 👇\n\nSalva e compartilha com quem também está nessa. Link na bio.",
    pillar: "Multimoeda",
    style: "color",
    caption:
      "Você trabalha num país, guarda em outro, sonha com um terceiro. Seu dinheiro devia acompanhar. 🌍\n\nA maioria dos apps assume que você vive numa moeda só. O Nossas Finanças nasceu do contrário: cada conta, cada investimento e cada meta guarda a própria moeda — e você escolhe em qual ver o total. Real, euro, dólar, o que for.\n\nDinheiro sem fronteiras. Do jeito que a sua vida já é. 🚀\n\n📲 Cadastre-se grátis — link na bio.",
    tags: ["multimoeda", "cambio", "brasileirosnoexterior", "expatriados", "morarfora", "financaspessoais", "investiroexterior", "vidacrossborder", "dinheiro", "liberdadefinanceira"],
    eyebrow: "DINHEIRO SEM FRONTEIRAS",
    title: ["Seu dinheiro não", "devia ficar preso", "a um país."],
    sub: "Cada item na própria moeda; o total em qualquer uma. Feito pra quem vive entre países.",
    chips: ["Real", "Euro", "Dólar", "Qualquer moeda"],
  },
  {
    id: "metas",
    name: "Metas · foto vívida",
    comment:
      "Qual é a sua próxima meta? Escreve aqui embaixo — colocar em palavras já ajuda 👇\n\nSalva pra acompanhar a sua no app. Grátis na bio 👉 nossasfinancas.com.br",
    pillar: "Organização",
    style: "vivid",
    photo: "/img/ads/peaks.jpg",
    caption:
      "Toda meta grande começa pequena: um valor, uma data, um passo por vez. 🏔️\n\nJuntar pra mudança de país, pra reserva, pra liberdade — no Nossas Finanças cada objetivo tem barra de progresso e pode estar em qualquer moeda. Você vê o quanto já andou e o quanto falta, sem planilha e sem achismo.\n\nO topo fica mais perto quando você enxerga o caminho. 🎯\n\n📲 Comece grátis — link na bio.",
    tags: ["metas", "objetivos", "planejamentofinanceiro", "organizacaofinanceira", "financaspessoais", "reservadeemergencia", "independenciafinanceira", "poupar", "disciplina", "vidafinanceira"],
    eyebrow: "SEUS OBJETIVOS",
    title: ["Cada meta,", "no seu ritmo."],
    sub: "Barra de progresso em qualquer moeda — veja o quanto já andou e o quanto falta.",
  },
];

// ── POSTS EDUCATIVOS ─────────────────────────────────────────────────────────
// Conteúdo que ENSINA (dica, passo-a-passo, checklist, mito×verdade, conceito, número). São TEMPLATES:
// duplique um objeto e troque texto/estilo pra falar de outro tema. Legenda de cada um já ensina.
export const EDU_POSTS: Post[] = [
  {
    id: "edu-reserva",
    name: "Educativo · reserva (passo a passo)",
    comment:
      "E você, já tem a sua reserva? Quantos meses de gasto você guarda? 👇\n\nNo Nossas Finanças dá pra criar a meta da reserva e acompanhar o progresso mês a mês. Comece grátis — link na bio 📌",
    pillar: "Educativo",
    style: "light",
    caption:
      "Reserva de emergência é o primeiro passo — antes de qualquer investimento. 🛟\n\nÉ o dinheiro que te protege de um imprevisto (perder a renda, uma emergência de saúde, um conserto) sem precisar recorrer a cartão ou empréstimo caro.\n\nComo montar:\n1. Alvo: 3 a 6 meses dos seus gastos essenciais\n2. Onde: algo seguro e com resgate no mesmo dia\n3. Como: um aporte fixo todo mês, no automático\n4. Uso: só emergência de verdade — e reponha depois\n\nNo Nossas Finanças você cria a reserva como meta e acompanha, mês a mês, quanto já guardou e quanto falta pro alvo. Não precisa ser rápido — precisa ser constante. 💪\n\n📲 Comece grátis — nossasfinancas.com.br",
    tags: ["reservadeemergencia", "educacaofinanceira", "financaspessoais", "planejamentofinanceiro", "organizacaofinanceira", "dinheiro", "poupar", "vidafinanceira", "investir", "passoapasso"],
    eyebrow: "PASSO A PASSO",
    title: ["Monte sua reserva", "de emergência"],
    steps: [
      { title: "Defina o alvo", desc: "3 a 6 meses dos seus gastos essenciais." },
      { title: "Escolha onde guardar", desc: "Algo seguro e com resgate no mesmo dia." },
      { title: "Automatize o aporte", desc: "Um valor fixo todo mês, assim que a renda cai." },
      { title: "Só use em emergência", desc: "Imprevisto real — e reponha depois." },
    ],
  },
  {
    id: "edu-mito-investir",
    name: "Educativo · mito (investir)",
    comment:
      "Você já acreditou nesse mito? 🤔 Comenta com quanto dá pra começar a investir hoje 👇\n\nNo Nossas Finanças você acompanha seus aportes e projeta o resultado no tempo. Comece grátis — link na bio.",
    pillar: "Educativo",
    style: "color",
    caption:
      "“Investir é só pra quem tem muito dinheiro.” 🙅\n\nMito. Hoje dá pra começar com poucos reais. O que constrói patrimônio não é o valor inicial — é o TEMPO e a constância.\n\nR$ 100 por mês, todo mês, por anos, com juros compostos, podem render bem mais do que um aporte grande feito uma vez só. Começar cedo (mesmo com pouco) vence começar tarde com muito.\n\nNo Nossas Finanças você acompanha seus aportes e projeta a bola de neve ano a ano — pra ver aonde a constância te leva.\n\nO melhor dia pra começar foi ontem. O segundo melhor é hoje. 🌱\n\n📲 Cadastre-se grátis — link na bio.",
    tags: ["investimentos", "educacaofinanceira", "financaspessoais", "juroscompostos", "investirpouco", "liberdadefinanceira", "dinheiro", "investir", "comecaragora", "mentalidadefinanceira"],
    eyebrow: "MITO OU VERDADE",
    title: ["“Investir é só", "pra quem tem", "muito dinheiro.”"],
    sub: "Mito. Dá pra começar com pouco e no automático — o que pesa é o tempo e a constância, não o valor inicial.",
  },
  {
    id: "edu-juros",
    name: "Educativo · juros compostos (número)",
    comment:
      "Começar cedo ou investir mais — o que pesa mais? Comenta o seu palpite 👇\n\nNo Nossas Finanças você projeta o seu cenário, com juros compostos. Comece grátis — link na bio 📌",
    pillar: "Educativo",
    style: "light",
    caption:
      "Isso aqui é o efeito mais poderoso das finanças pessoais: juros compostos. 📈\n\nGuardando R$ 200 por mês, por 30 anos, a uns 8% ao ano, você chega em ~R$ 280 mil. Só que você depositou só R$ 72 mil no total — o resto (mais de R$ 200 mil!) é rendimento rendendo em cima de rendimento.\n\nÉ por isso que TEMPO importa mais que valor. Cada ano a mais na conta multiplica o resultado.\n\nNo Nossas Finanças você projeta o SEU número — com aportes e inflação real, ano a ano, na moeda que quiser.\n\n(Exemplo ilustrativo — a ideia é mostrar a lógica.)\n\n📲 Comece grátis — nossasfinancas.com.br",
    tags: ["juroscompostos", "educacaofinanceira", "investimentos", "financaspessoais", "liberdadefinanceira", "aposentadoria", "investir", "longoprazo", "patrimonio", "dinheiro"],
    eyebrow: "O PODER DO TEMPO",
    title: ["Juros compostos", "trabalham por você"],
    stat: { value: "≈ R$ 280 mil", label: "R$ 200/mês · 30 anos · ~8% ao ano" },
    sub: "Você deposita R$ 72 mil; o resto é rendimento sobre rendimento. Começar cedo vale mais que aportar muito.",
  },
  {
    id: "edu-checklist-investir",
    name: "Educativo · checklist (investir)",
    comment:
      "Quantos itens do checklist você já tem prontos? (0 a 4) 👇\n\nNo Nossas Finanças você organiza reserva, metas, dívidas e patrimônio num app só. Comece grátis — link na bio.",
    pillar: "Educativo",
    style: "dark",
    stepMarker: "check",
    caption:
      "Antes de comprar o primeiro investimento, confere se essas 4 bases estão de pé: ✅\n\n1. Reserva de emergência — pra não precisar resgatar na pior hora\n2. Dívidas caras quitadas — cartão e cheque especial rendem contra você\n3. Um objetivo e um prazo — pra quê e pra quando você investe\n4. Seu perfil de risco — quanta oscilação você aguenta sem pânico (isso é com você)\n\nNo Nossas Finanças você organiza as 3 primeiras num lugar só: reserva e metas com barra de progresso, dívidas e patrimônio numa tela. Base sólida primeiro, produto depois. 🧱\n\n📲 Comece grátis — link na bio.",
    tags: ["investimentos", "educacaofinanceira", "checklist", "financaspessoais", "comecarainvestir", "reservadeemergencia", "perfilderisco", "planejamentofinanceiro", "investir", "dinheiro"],
    eyebrow: "CHECKLIST",
    title: ["Antes de investir,", "tenha isso pronto"],
    steps: [
      { title: "Reserva de emergência", desc: "O colchão pra não resgatar na pior hora." },
      { title: "Dívidas caras quitadas", desc: "Cartão e cheque especial rendem contra você." },
      { title: "Um objetivo e um prazo", desc: "Pra quê e pra quando você investe." },
      { title: "Seu perfil de risco", desc: "Quanta oscilação você aguenta sem pânico." },
    ],
  },
  {
    id: "edu-inflacao",
    name: "Educativo · conceito (inflação)",
    comment:
      "Ficou claro? Manda pra alguém que ainda acha que dinheiro parado \"está seguro\" 👇\n\nNo Nossas Finanças você vê seu patrimônio real, já descontando a inflação. Comece grátis — link na bio.",
    pillar: "Educativo",
    style: "light",
    caption:
      "Conceito em 1 minuto: inflação. 🎈\n\nÉ o encarecimento geral dos preços ao longo do tempo. Se a inflação do ano foi 5%, o que custava R$ 100 passa a custar R$ 105 — e o dinheiro parado na conta compra menos.\n\nNa prática: guardar embaixo do colchão (ou numa conta que não rende) é perder poder de compra todo ano, de forma silenciosa. Por isso o objetivo de investir é render ACIMA da inflação.\n\nNo Nossas Finanças você projeta seu patrimônio já descontando a inflação — vê o valor REAL, em dinheiro de hoje, do que terá lá na frente.\n\n📲 Comece grátis — nossasfinancas.com.br",
    tags: ["inflacao", "educacaofinanceira", "financaspessoais", "economia", "poderdecompra", "investir", "dinheiro", "planejamentofinanceiro", "conceitofinanceiro", "protejaseudinheiro"],
    eyebrow: "CONCEITO EM 1 MINUTO",
    title: ["O que é", "inflação?"],
    sub: "O encarecimento geral dos preços com o tempo. R$ 100 hoje compram menos amanhã — por isso dinheiro parado perde valor, e render acima dela protege o seu.",
  },
  {
    id: "edu-erros-orcamento",
    name: "Educativo · 3 erros (orçamento)",
    comment:
      "Qual desses 3 erros MAIS te pega? Confessa aí 👇\n\nNo Nossas Finanças você vê cada gasto por categoria e o gráfico do mês — os pequenos param de escapar. Comece grátis — link na bio 📌",
    pillar: "Educativo",
    style: "dark",
    caption:
      "3 erros que furam o orçamento de quase todo mundo (e como evitar): 🕳️\n\n1. Ignorar os pequenos — cafezinho, app, delivery. Sozinhos parecem nada; somados no mês, viram um rombo invisível.\n2. Esquecer os anuais — IPVA, seguro, matrícula. Divida por 12 e separe todo mês pra não levar susto.\n3. Orçar sem folga — deixe uns 10% de respiro. O mês real nunca sai igual ao planejado no papel.\n\nNo Nossas Finanças você põe cada gasto na categoria e vê, no fim do mês, pra onde foi cada real — os pequenos incluídos. Orçamento bom não é o perfeito — é o que você consegue manter. 🎯\n\n📲 Comece grátis — link na bio.",
    tags: ["orcamento", "educacaofinanceira", "controlefinanceiro", "financaspessoais", "organizacaofinanceira", "planejamentofinanceiro", "gastos", "economia", "dinheiro", "dicasfinanceiras"],
    eyebrow: "EVITE ESTES ERROS",
    title: ["3 erros que furam", "o seu orçamento"],
    steps: [
      { title: "Ignorar os pequenos", desc: "Cafezinho, app, delivery viram rombo invisível." },
      { title: "Esquecer os anuais", desc: "IPVA, seguro, matrícula: divida por 12." },
      { title: "Orçar sem folga", desc: "Deixe ~10% de respiro pro mês real." },
    ],
  },
];

// ── CARROSSÉIS (feed 4:5, VÁRIAS imagens numa publicação) ────────────────────
// Apresentação completa do app: cada slide VARIA o template (foto vívida / escuro-mockup / verde
// bold / papel claro) pra ficar dinâmico. Exportado como N PNGs numerados; 1 legenda pro conjunto.
export const CAROUSELS: Carousel[] = [
  {
    id: "tour",
    name: "Conheça o app · 8 slides",
    comment:
      "Ficou com alguma dúvida sobre o app? Pergunta aqui embaixo que eu respondo 👇\n\nNo Nossas Finanças você descobre pra onde vai cada real e para de terminar o mês no escuro. Comece grátis — link na bio 👉 nossasfinancas.com.br",
    pillar: "Apresentação",
    caption:
      "Vem conhecer o Nossas Finanças. 👋\n\nÉ um app de finanças pessoais feito pra quem vive (ou vai viver) entre países — e pra qualquer um que queira finalmente entender pra onde vai cada real.\n\nNo Nossas Finanças você consegue:\n1️⃣ Ver tudo num número só — real, euro, dólar na cotação de hoje\n2️⃣ Manter seus números privados — cifrados no seu aparelho; nem eu, no servidor, vejo\n3️⃣ Parar de dizer 'não sei pra onde foi' — orçamento por categoria, em qualquer moeda\n4️⃣ Somar tudo que você tem — contas, investimentos e bens, numa tela só\n5️⃣ Acompanhar metas reais — objetivos com barra de progresso em qualquer moeda\n6️⃣ Projetar sua liberdade — quanto falta pra parar de depender do salário\n\nE o melhor: grátis pra começar, funciona offline e roda no navegador — sem instalar nada, sem cadastrar cartão.\n\nArrasta pro lado pra ver tudo. 👉\n📲 Cadastre-se grátis — link na bio.",
    tags: ["financaspessoais", "multimoeda", "privacidade", "controlefinanceiro", "expatriados", "brasileirosnoexterior", "organizacaofinanceira", "independenciafinanceira", "appdefinancas", "morarfora"],
    slides: [
      { style: "dark", shot: SHOT_SRC.painel, eyebrow: "CONHEÇA O APP", title: ["Suas finanças,", "num app só."], sub: "Um tour rápido pelo Nossas Finanças." },
      { style: "dark", shot: SHOT_SRC.multimoeda, eyebrow: "1 · MULTIMOEDA", title: ["Tudo, em", "qualquer moeda."], sub: "Cada item na sua moeda; o total na cotação de hoje." },
      { style: "color", eyebrow: "2 · PRIVACIDADE", title: ["Cifrado no seu", "aparelho. Só", "você vê."], sub: "Criptografia ponta a ponta — só você abre os seus números." },
      { style: "dark", shot: SHOT_SRC.orcamento, eyebrow: "3 · ORÇAMENTO", title: ["Pra onde vai", "cada real."], sub: "Gastos por categoria, em qualquer moeda, com o gráfico do mês." },
      { style: "light", eyebrow: "4 · PATRIMÔNIO", title: ["Seu patrimônio,", "num número só."], stat: { value: "R$ 1,28 mi", label: "contas + investimentos + bens" }, sub: "Ativos, dívidas e composição — em qualquer moeda, num número só." },
      { style: "dark", eyebrow: "5 · METAS", title: ["Cada meta,", "no seu ritmo."], sub: "Objetivos com barra de progresso em qualquer moeda.", chips: ["Reserva", "Mudança", "Liberdade"] },
      { style: "color", eyebrow: "6 · E O MELHOR", title: ["Grátis, offline", "e no navegador."], sub: "Sem instalar nada, sem cadastrar cartão. Seus dados ficam com você.", chips: ["Sem instalar", "Funciona offline", "Sem cartão"] },
      { style: "vivid", photo: "/img/ads/horizon.jpg", eyebrow: "COMECE AGORA", title: ["Abra grátis", "e comece hoje."], sub: "No Nossas Finanças você controla tudo — em qualquer moeda, sem cartão, no navegador." },
    ],
  },
];

// ── CARROSSÉIS EDUCATIVOS ────────────────────────────────────────────────────
export const EDU_CAROUSELS: Carousel[] = [
  {
    id: "edu-orcamento-passo",
    name: "Educativo · seu 1º orçamento (7 slides)",
    comment:
      "Qual passo você já faz e qual ainda falta? Conta aí 👇\n\nNo Nossas Finanças você acompanha cada real e monta o gráfico do mês. Comece grátis — link na bio 📌",
    pillar: "Educativo",
    caption:
      "Quer se organizar mas não sabe por onde começar? Salva esse post — é o passo a passo do seu primeiro orçamento. 📌\n\n1. Anote tudo que entra (sua renda real)\n2. Liste os gastos fixos\n3. Estime os variáveis (olhe os últimos meses)\n4. Separe o quanto vai poupar ANTES de gastar\n5. Acompanhe e ajuste no fim do mês\n\nNão precisa ser perfeito no 1º mês. Precisa começar — cada mês fica mais fácil. 💪\n\nNo Nossas Finanças você faz tudo isso numa tela, em qualquer moeda, e vê pra onde foi cada real.\n📲 Comece grátis — nossasfinancas.com.br",
    tags: ["orcamento", "passoapasso", "educacaofinanceira", "controlefinanceiro", "organizacaofinanceira", "financaspessoais", "planejamentofinanceiro", "comecaragora", "dinheiro", "vidafinanceira"],
    // Todo slide VÍVIDO, com 1 foto TEMÁTICA e ÚNICA (ilustra cada passo, como nos stories educativos).
    slides: [
      { style: "vivid", photo: "/img/ads/calc.jpg", eyebrow: "PASSO A PASSO", title: ["Monte seu 1º", "orçamento"], sub: "Em 5 passos simples — sem planilha gigante." },
      { style: "vivid", photo: "/img/ads/wallet.jpg", eyebrow: "PASSO 1", title: ["Anote tudo", "que entra"], sub: "Salário, freelas, aluguéis. A sua renda real do mês." },
      { style: "vivid", photo: "/img/ads/rent.jpg", eyebrow: "PASSO 2", title: ["Liste os", "gastos fixos"], sub: "Moradia, contas, transporte, escola. O que se repete todo mês." },
      { style: "vivid", photo: "/img/ads/market.jpg", eyebrow: "PASSO 3", title: ["Estime os", "variáveis"], sub: "Mercado, lazer, delivery. Olhe os últimos 2–3 meses pra ter a média." },
      { style: "vivid", photo: "/img/ads/counting.jpg", eyebrow: "PASSO 4", title: ["Separe o que", "vai poupar"], sub: "Defina antes de gastar — nem que comece com 5%. Pague-se primeiro." },
      { style: "vivid", photo: SHOT_SRC.orcamento, eyebrow: "PASSO 5", title: ["Acompanhe", "e ajuste"], sub: "No fim do mês, veja pra onde foi cada real — e vá ajustando." },
      { style: "vivid", photo: SHOT_SRC.painel, eyebrow: "AGORA É COM VOCÊ", title: ["Agora é com", "você — no app."], sub: "No Nossas Finanças você acompanha cada real, em qualquer moeda — grátis." },
    ],
  },
];

// ── helpers ─────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Opacidade da cena: fade-in nos 1ºs 0.45s, fade-out nos últimos 0.35s (sobre o bg persistente). */
function sceneAlpha(lt: number, dur: number) {
  return Math.min(clamp01(lt / 0.6), clamp01((dur - lt) / 0.5));
}

function fontSans(px: number, weight = 600) {
  return `${weight} ${px}px Inter, system-ui, sans-serif`;
}
function fontMono(px: number, weight = 500) {
  return `${weight} ${px}px "JetBrains Mono", ui-monospace, monospace`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Logo desenhado em PATHS (sem imagem externa → sem risco de "tainted canvas" na gravação):
 *  quadrado verde + dois anéis "C" sobrepostos (aproxima o ícone). */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, d: number) {
  ctx.fillStyle = ACCENT;
  roundRect(ctx, x, y, d, d, d * 0.26);
  ctx.fill();
  const cy = y + d / 2;
  ctx.lineWidth = d * 0.12;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0A0B0D";
  ctx.beginPath();
  ctx.arc(x + d * 0.4, cy, d * 0.2, Math.PI * 0.34, Math.PI * 1.66);
  ctx.stroke();
  ctx.strokeStyle = "#A9FFD8";
  ctx.beginPath();
  ctx.arc(x + d * 0.6, cy, d * 0.2, Math.PI * 1.34, Math.PI * 0.66);
  ctx.stroke();
}

/** Selo de moeda (mono) tipo badge do app. */
function badge(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, code: string, on: boolean) {
  const padX = 20 * s, h = 46 * s;
  ctx.font = fontMono(24 * s, 600);
  const w = ctx.measureText(code).width + padX * 2;
  ctx.fillStyle = on ? "rgba(62,207,142,0.14)" : CARD2;
  roundRect(ctx, x, y, w, h, 12 * s);
  ctx.fill();
  ctx.fillStyle = on ? ACCENT : MUTED;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(code, x + padX, y + h / 2 + 1 * s);
  return w;
}

/** Donut (arcos) — composição do orçamento. `reveal` (0..1) desenha só até essa fração (animação). */
function drawDonut(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, th: number, segs: [number, string][], reveal = 1) {
  ctx.lineWidth = th;
  ctx.lineCap = "butt";
  let cum = 0;
  for (const [frac, color] of segs) {
    if (reveal <= cum) break;
    const visEnd = Math.min(cum + frac, reveal);
    const a0 = -Math.PI / 2 + cum * 2 * Math.PI;
    const a1 = -Math.PI / 2 + visEnd * 2 * Math.PI;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
    cum += frac;
  }
}

/** Card-mockup do app (screenshot estilizado): os elementos se CONSTROEM ao longo da cena (número
 *  conta, linhas/legenda em cascata, dots um a um, donut desenhando), como o mock da landing.
 *  `a` = alpha da cena/pop; `lt` = tempo local da cena (dispara as animações internas). */
/** Dimensões naturais de uma imagem (HTMLImageElement no browser · Image do napi no teste). */
function imgWH(img: CanvasImageSource): { w: number; h: number } {
  const a = img as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  return { w: a.naturalWidth || a.width || 16, h: a.naturalHeight || a.height || 10 };
}

/** SCREENSHOT do app "emoldurado" como janela flutuante: card com sombra + hairline e a imagem
 *  recortada em cantos arredondados. A ALTURA vem do aspecto da imagem (sem distorcer/cortar).
 *  Desenha a partir de (cx, topY) com largura `w`; devolve a altura ocupada. */
function drawShotCard(ctx: CanvasRenderingContext2D, s: number, cx: number, topY: number, w: number, img: CanvasImageSource, a: number): number {
  const { w: iw, h: ih } = imgWH(img);
  const h = w * (ih / iw);
  const x = cx - w / 2, y = topY, r = 22 * s;
  ctx.save();
  ctx.globalAlpha = a;
  // sombra sob a janela (profundidade)
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 64 * s;
  ctx.shadowOffsetY = 30 * s;
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // imagem recortada nos cantos arredondados
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  // hairline sutil por cima
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2 * s;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
  return h;
}

function drawMockCard(ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, w: number, kind: "currencies" | "masked" | "donut" | "freedom", a: number, lt: number) {
  const h = w * (kind === "donut" ? 1.05 : 0.84); // altura ajustada ao conteúdo de cada mockup
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  const x = -w / 2, y = -h / 2;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 70 * s;
  ctx.shadowOffsetY = 34 * s;
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, 30 * s);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2 * s;
  roundRect(ctx, x, y, w, h, 30 * s);
  ctx.stroke();

  const px = x + 42 * s, py = y + 62 * s, iw = w - 84 * s;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const fade = (delay: number, dur = 0.45) => clamp01((lt - delay) / dur); // progresso de 1 elemento
  const eyebrow = (txt: string) => {
    ctx.fillStyle = FAINT;
    ctx.font = fontMono(20 * s, 600);
    ctx.letterSpacing = `${2 * s}px`;
    ctx.fillText(txt, px, py);
    ctx.letterSpacing = "0px";
  };

  if (kind === "currencies") {
    eyebrow("PATRIMÔNIO LÍQUIDO");
    // número contando de 0 até o valor
    const n = Math.round(1284500 * easeOut(clamp01((lt - 0.5) / 1.3)));
    ctx.fillStyle = TEXT;
    ctx.font = fontSans(56 * s, 600);
    ctx.fillText("R$ " + n.toLocaleString("pt-BR"), px, py + 66 * s);
    ctx.globalAlpha = a * fade(1.0);
    ctx.fillStyle = ACCENT;
    ctx.font = fontSans(24 * s, 600);
    ctx.fillText("▲ 2,4% no mês", px, py + 108 * s);
    ctx.globalAlpha = a;
    // linhas de moeda entram em cascata
    const rows: [string, string, boolean][] = [["BRL", "R$ 1.284.500", true], ["EUR", "€ 214.900", false], ["USD", "$ 236.200", false]];
    rows.forEach((r, i) => {
      const rp = fade(1.25 + i * 0.22);
      if (rp <= 0) return;
      ctx.globalAlpha = a * rp;
      const ry = py + 190 * s + i * 76 * s;
      badge(ctx, s, px, ry - 30 * s, r[0], r[2]);
      ctx.fillStyle = TEXT;
      ctx.font = fontSans(30 * s, 500);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(r[1], px + iw, ry - 8 * s);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (i < rows.length - 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(px, ry + 32 * s);
        ctx.lineTo(px + iw, ry + 32 * s);
        ctx.stroke();
      }
      ctx.globalAlpha = a;
    });
  } else if (kind === "masked") {
    eyebrow("PATRIMÔNIO LÍQUIDO");
    // dots cifrando um a um
    const shown = Math.floor(easeOut(clamp01((lt - 0.5) / 1.2)) * 7 + 1e-4);
    ctx.fillStyle = TEXT;
    for (let i = 0; i < shown; i++) {
      ctx.beginPath();
      ctx.arc(px + 22 * s + i * 46 * s, py + 48 * s, 15 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // chip "🔒 Só você vê" aparece depois
    const chp = fade(1.3);
    if (chp > 0) {
      ctx.globalAlpha = a * chp;
      const ct = "Só você vê", chipY = py + 108 * s, chH = 56 * s;
      ctx.font = fontSans(26 * s, 600);
      const cw = ctx.measureText(ct).width + 92 * s;
      ctx.fillStyle = "rgba(62,207,142,0.14)";
      roundRect(ctx, px, chipY, cw, chH, chH / 2);
      ctx.fill();
      const lx = px + 30 * s, lyc = chipY + chH / 2;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.arc(lx, lyc - 5 * s, 9 * s, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = ACCENT;
      roundRect(ctx, lx - 12 * s, lyc - 3 * s, 24 * s, 19 * s, 4 * s);
      ctx.fill();
      ctx.textBaseline = "middle";
      ctx.fillText(ct, px + 62 * s, lyc + 1 * s);
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = a;
    }
    // "gráfico" fantasma se desenhando
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 8 * s;
    ctx.lineCap = "round";
    const gy = py + 250 * s, pts = [0.7, 0.55, 0.62, 0.4, 0.5, 0.3, 0.22], seg = pts.length - 1;
    const cp = clamp01((lt - 0.8) / 1.4) * seg;
    ctx.beginPath();
    for (let i = 0; i <= seg; i++) {
      const gx = px + (iw * i) / seg, gyy = gy + 130 * s * pts[i];
      if (i === 0) {
        ctx.moveTo(gx, gyy);
        continue;
      }
      if (cp >= i) ctx.lineTo(gx, gyy);
      else {
        const tt = cp - (i - 1);
        if (tt > 0) {
          const gx0 = px + (iw * (i - 1)) / seg, gy0 = gy + 130 * s * pts[i - 1];
          ctx.lineTo(gx0 + (gx - gx0) * tt, gy0 + (gyy - gy0) * tt);
        }
        break;
      }
    }
    ctx.stroke();
  } else if (kind === "donut") {
    eyebrow("ORÇAMENTO DO MÊS");
    const dcx = x + w / 2, dcy = py + 175 * s, dr = 118 * s;
    // donut se desenhando (sweep)
    drawDonut(ctx, dcx, dcy, dr, 46 * s, [[0.53, ACCENT], [0.31, "#8A8F98"], [0.16, CARD2]], easeInOut(clamp01((lt - 0.5) / 1.4)));
    const legs: [string, string, string][] = [["Moradia", ACCENT, "R$ 3.2k"], ["Alimentação", "#8A8F98", "R$ 1.9k"], ["Outros", CARD2, "R$ 980"]];
    legs.forEach((l, i) => {
      const lp = fade(1.3 + i * 0.2);
      if (lp <= 0) return;
      ctx.globalAlpha = a * lp;
      const ly = py + 350 * s + i * 62 * s;
      ctx.fillStyle = l[1];
      roundRect(ctx, px, ly - 15 * s, 20 * s, 20 * s, 5 * s);
      ctx.fill();
      ctx.fillStyle = MUTED;
      ctx.font = fontSans(28 * s, 500);
      ctx.textBaseline = "middle";
      ctx.fillText(l[0], px + 34 * s, ly - 4 * s);
      ctx.fillStyle = TEXT;
      ctx.textAlign = "right";
      ctx.fillText(l[2], px + iw, ly - 4 * s);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = a;
    });
  } else {
    // FREEDOM — "quando você fica livre": % da liberdade contando + número/ano + curva de projeção
    // subindo (área + dot no alvo). Relaciona com a Projeção/Liberdade do app.
    eyebrow("RUMO À LIBERDADE");
    const pct = Math.round(23 * easeOut(clamp01((lt - 0.5) / 1.3)));
    ctx.fillStyle = ACCENT;
    ctx.font = fontSans(56 * s, 600);
    ctx.fillText(pct + "% livre", px, py + 66 * s);
    ctx.globalAlpha = a * fade(1.0);
    ctx.fillStyle = MUTED;
    ctx.font = fontSans(24 * s, 500);
    ctx.fillText("R$ 2,4 mi · chegada em 2035", px, py + 108 * s);
    ctx.globalAlpha = a;
    // projeção subindo
    const gy = py + 250 * s, base = gy + 130 * s;
    const pts = [0.86, 0.72, 0.6, 0.45, 0.36, 0.22, 0.1]; // menor = mais alto (curva sobe)
    const seg = pts.length - 1;
    const cp = clamp01((lt - 0.7) / 1.5) * seg;
    const ptAt = (i: number) => ({ gx: px + (iw * i) / seg, gyy: gy + 130 * s * pts[i] });
    const traceTo = (fn: (gx: number, gyy: number, i: number) => void) => {
      for (let i = 0; i <= seg; i++) {
        if (cp >= i) fn(ptAt(i).gx, ptAt(i).gyy, i);
        else {
          const tt = cp - (i - 1);
          if (tt > 0) {
            const p0 = ptAt(i - 1), p1 = ptAt(i);
            fn(p0.gx + (p1.gx - p0.gx) * tt, p0.gyy + (p1.gyy - p0.gyy) * tt, i);
          }
          break;
        }
      }
    };
    // área sob a linha
    const endX = cp >= seg ? ptAt(seg).gx : px + (iw * Math.min(cp, seg)) / seg;
    ctx.beginPath();
    ctx.moveTo(px, base);
    traceTo((gx, gyy) => ctx.lineTo(gx, gyy));
    ctx.lineTo(endX, base);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, gy, 0, base);
    grad.addColorStop(0, "rgba(62,207,142,0.22)");
    grad.addColorStop(1, "rgba(62,207,142,0)");
    ctx.fillStyle = grad;
    ctx.fill();
    // linha
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 6 * s;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    traceTo((gx, gyy, i) => (i === 0 ? ctx.moveTo(gx, gyy) : ctx.lineTo(gx, gyy)));
    ctx.stroke();
    // dot no alvo
    if (cp >= seg) {
      const { gx, gyy } = ptAt(seg);
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(gx, gyy, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(62,207,142,0.3)";
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.arc(gx, gyy, 17 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Fundo-foto temático, BEM sutil e filtrado (dessaturado + tinte verde + escurecido) + zoom
 *  Ken-Burns lento pra dar vida. `photo` já carregada (same-origin → sem taint). `t` = tempo. */
function drawPhotoBg(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, W: number, H: number, t: number) {
  const p = photo as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const iw = p.naturalWidth || p.width || 0, ih = p.naturalHeight || p.height || 0;
  if (!iw || !ih) return;
  ctx.save();
  // foto cover-fit + zoom lento (5% ao longo do story) — dessaturada e escura, BEM opaca
  const zoom = 1 + 0.05 * clamp01(t / 16);
  const scale = Math.max(W / iw, H / ih) * zoom;
  const dw = iw * scale, dh = ih * scale;
  ctx.globalAlpha = 0.17;
  ctx.filter = "grayscale(0.9) brightness(0.85) contrast(1.05)";
  ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.filter = "none";
  // tinte verde sutil (mantém a marca)
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, H);
  // vinheta escura (topo/base) pra o texto respirar
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(10,11,13,0.55)");
  g.addColorStop(0.45, "rgba(10,11,13,0.28)");
  g.addColorStop(1, "rgba(10,11,13,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Fundo persistente: quase-preto + glow verde suave que respira. */
function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, gx = 0.32, gy = 0.22) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.6);
  const cx = W * gx, cy = H * gy, r = W * (0.9 + 0.06 * breathe);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(62,207,142,${0.16 + 0.04 * breathe})`);
  g.addColorStop(0.55, "rgba(62,207,142,0.03)");
  g.addColorStop(1, "rgba(62,207,142,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Fundo CLARO (papel premium neutro/zinc) + glow verde MUITO sutil — clima editorial claro. */
function drawLightBg(ctx: CanvasRenderingContext2D, W: number, H: number, t = 0, gx = 0.28, gy = 0.2) {
  // base neutra premium com um leve toque esverdeado (menos "branco chapado")
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#F4F7F5");
  base.addColorStop(1, "#E5EBE7");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.6);
  // brilho verde PRINCIPAL no canto de cima (perto da marca/eyebrow) — elegante, mais presente
  const cx = W * gx, cy = H * gy, r = W * (0.92 + 0.05 * breathe);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(21,151,106,${0.18 + 0.03 * breathe})`);
  g.addColorStop(0.55, "rgba(21,151,106,0.045)");
  g.addColorStop(1, "rgba(21,151,106,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // brilho SECUNDÁRIO difuso no canto oposto (profundidade tipo mesh-gradient, bem sutil)
  const g2 = ctx.createRadialGradient(W * 0.92, H * 0.9, 0, W * 0.92, H * 0.9, W * 0.8);
  g2.addColorStop(0, "rgba(21,151,106,0.09)");
  g2.addColorStop(0.6, "rgba(21,151,106,0.015)");
  g2.addColorStop(1, "rgba(21,151,106,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
}

/** Fundo SOBRE-COR: verde profundo saturado (diagonal) + realce do acento — clima bold/manifesto. */
function drawColorBg(ctx: CanvasRenderingContext2D, W: number, H: number, t = 0) {
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, "#0C3B29");
  base.addColorStop(0.55, "#0A291D");
  base.addColorStop(1, "#05160F");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.5);
  const cx = W * 0.74, cy = H * 0.18, r = W * (0.95 + 0.06 * breathe);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(62,207,142,${0.24 + 0.05 * breathe})`);
  g.addColorStop(0.5, "rgba(62,207,142,0.05)");
  g.addColorStop(1, "rgba(62,207,142,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Fundo FOTO VÍVIDA (não esmaecida): a foto ocupa a parte de cima em cor cheia (leve realce, sem
 *  dessaturar) e o texto vai numa FAIXA SÓLIDA embaixo (#0E0F12) com keyline no acento — legibilidade
 *  total sem lavar a imagem. `bandTopFrac` = onde começa a faixa; `t` = zoom Ken-Burns (stories).
 *  Retorna o Y (px) do topo da faixa, pra o chamador ancorar o texto. */
function drawVividPhotoBg(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, W: number, H: number, bandTopFrac = 0.55, t = 0) {
  const band = "#0E0F12";
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, H);
  const p = photo as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const iw = p.naturalWidth || p.width || 0, ih = p.naturalHeight || p.height || 0;
  const bandTop = H * bandTopFrac;
  if (iw && ih) {
    // foto cobre a área ACIMA da faixa, em cor CHEIA (realce leve, sem grayscale) + zoom lento
    const zoom = 1 + 0.05 * clamp01(t / 16);
    const scale = Math.max(W / iw, bandTop / ih) * zoom;
    const dw = iw * scale, dh = ih * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, bandTop);
    ctx.clip();
    ctx.filter = "saturate(1.06) contrast(1.03)";
    ctx.drawImage(photo, (W - dw) / 2, (bandTop - dh) / 2, dw, dh);
    ctx.restore();
    ctx.filter = "none";
  }
  // scrim curto no topo (a marca lê sobre a foto)
  const tg = ctx.createLinearGradient(0, 0, 0, H * 0.2);
  tg.addColorStop(0, "rgba(6,7,9,0.5)");
  tg.addColorStop(1, "rgba(6,7,9,0)");
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, W, H * 0.2);
  // transição foto → faixa (fade curto pra a foto "entrar" na faixa sem corte duro)
  const fadeH = H * 0.1;
  const fg = ctx.createLinearGradient(0, bandTop - fadeH, 0, bandTop);
  fg.addColorStop(0, "rgba(14,15,18,0)");
  fg.addColorStop(1, band);
  ctx.fillStyle = fg;
  ctx.fillRect(0, bandTop - fadeH, W, fadeH);
  // faixa sólida + keyline no acento
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, W, H - bandTop);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, bandTop, W, Math.max(2, 3 * (W / 1080)));
  return bandTop;
}

/** Barrinhas de progresso (topo, estilo Story): uma por cena, preenchendo. */
function drawProgress(ctx: CanvasRenderingContext2D, s: number, W: number, n: number, t: number, pal: Palette = DARK, dur = SCENE_DUR, hold = LAST_HOLD) {
  const pad = 54 * s, gap = 10 * s, y = 46 * s, h = 6 * s;
  const bw = (W - pad * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = pad + i * (bw + gap);
    ctx.fillStyle = pal.chipStroke;
    roundRect(ctx, x, y, bw, h, h / 2);
    ctx.fill();
    const fill = clamp01((t - i * dur) / (i === n - 1 ? dur + hold : dur));
    if (fill > 0) {
      ctx.fillStyle = pal.text;
      roundRect(ctx, x, y, bw * fill, h, h / 2);
      ctx.fill();
    }
  }
}

function drawEyebrow(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, text: string, a: number, pal: Palette = DARK, size = 34) {
  ctx.globalAlpha = a;
  ctx.fillStyle = pal.accent;
  ctx.font = fontMono(size * s, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = `${3 * s}px`;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = "0px";
  ctx.globalAlpha = 1;
}

function drawTitle(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, lines: string[], a: number, dy: number, px = 96, pal: Palette = DARK) {
  ctx.globalAlpha = a;
  ctx.fillStyle = pal.text;
  ctx.font = fontSans(px * s, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const lh = (px + 8) * s;
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh + dy));
  ctx.globalAlpha = 1;
  return y + lines.length * lh;
}

/** Maior px (entre minPx e maxPx) que faz a LINHA MAIS LARGA caber em targetW (px de canvas).
 *  Deixa o título preencher a largura: linhas curtas ficam grandes, linhas longas não estouram. */
function fitTitlePx(ctx: CanvasRenderingContext2D, s: number, lines: string[], targetW: number, minPx: number, maxPx: number) {
  ctx.font = fontSans(100 * s, 600);
  let maxW = 1;
  for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);
  const px = (targetW / maxW) * 100;
  return Math.max(minPx, Math.min(maxPx, px));
}

/** Pílulas de features (cena de amplitude) — quebra em linhas se não couber. */
function drawChips(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, chips: string[], a: number, maxW: number, pal: Palette = DARK) {
  ctx.globalAlpha = a;
  ctx.font = fontMono(24 * s, 500);
  const h = 54 * s, padX = 24 * s, gap = 12 * s;
  let cxp = x, cyp = y;
  for (const c of chips) {
    const w = ctx.measureText(c).width + padX * 2;
    if (cxp + w > x + maxW) {
      cxp = x;
      cyp += h + gap;
    }
    ctx.fillStyle = pal.chipFill;
    roundRect(ctx, cxp, cyp, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = pal.chipStroke;
    ctx.lineWidth = 1.5 * s;
    roundRect(ctx, cxp, cyp, w, h, h / 2);
    ctx.stroke();
    ctx.fillStyle = pal.chipText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(c, cxp + padX, cyp + h / 2 + 1 * s);
    cxp += w + gap;
  }
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}

/** Quebra o texto em linhas que cabem em `maxW` (a fonte JÁ deve estar setada no ctx). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function drawSub(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, W: number, text: string, a: number, pal: Palette = DARK, size = 34, lhPx = 46) {
  ctx.globalAlpha = a;
  ctx.fillStyle = pal.muted;
  ctx.font = fontSans(size * s, 400);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const lh = lhPx * s;
  let yy = y;
  for (const line of wrapLines(ctx, text, W - x - 90 * s)) {
    ctx.fillText(line, x, yy);
    yy += lh;
  }
  ctx.globalAlpha = 1;
  return yy; // y do fim do bloco (pra posicionar o que vier abaixo)
}

// ── cenas ───────────────────────────────────────────────────────────────────
function sceneContent(ctx: CanvasRenderingContext2D, s: number, W: number, H: number, sc: Scene, lt: number, a: number, pal: Palette = DARK, style?: PieceStyle, teach = false) {
  const x = 90 * s;
  const midY = H * 0.5;
  const rise = (1 - easeOut(lt / 0.85)) * 40 * s; // sobe ao entrar (mais suave)

  if (sc.kind === "hook") {
    const availW = (W - x * 2) * 0.99; // largura útil (título preenche quase toda a coluna)
    const shotImg = adImage(sc.shot);
    if (sc.shot && shotImg) {
      // SCREENSHOT real do app: janela emoldurada em cima + legenda (eyebrow/título/sub) embaixo.
      const pop = easeOut(clamp01((lt - 0.1) / 0.9));
      const cardW = W - 130 * s;
      const topY = H * 0.1 + (1 - pop) * 26 * s;
      const ch = drawShotCard(ctx, s, W / 2, topY, cardW, shotImg, a * (0.4 + 0.6 * pop));
      const px = fitTitlePx(ctx, s, sc.title || [], availW, 80, 102);
      const eyeY = topY + ch + 92 * s;
      drawEyebrow(ctx, s, x, eyeY, sc.eyebrow || "", a, pal);
      const tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 46) * s, sc.title || [], a, rise, px, pal);
      if (sc.sub) drawSub(ctx, s, x, tb + 26 * s, W, sc.sub, a, pal);
      return;
    }
    if (style === "vivid" && teach) {
      // EDUCATIVO: foto menor em cima (faixa 0.4) → sobra a metade de baixo pro texto. Título no
      // MESMO tamanho bom (63–92) + eyebrow e EXPLICAÇÃO GRANDES (não miúdos) + o bloco CENTRALIZADO
      // na faixa (nada de vão vazio embaixo). Mede a altura real (título+sub+chips) pra centralizar.
      const bandTop = H * 0.4;
      const lines = sc.title || [];
      const px = fitTitlePx(ctx, s, lines, availW, 63, 92);
      const titleLh = (px + 10) * s;
      const subSize = 44;
      const subLhPx = 62;
      const eyeSize = 38;
      const eyeToTitle = (px * 0.72 + 48) * s; // baseline do eyebrow → 1ª baseline do título
      const titleH = lines.length * titleLh;
      const subGap = 50 * s;
      ctx.font = fontSans(subSize * s, 400);
      const subN = sc.sub ? wrapLines(ctx, sc.sub, W - x - 90 * s).length : 0;
      const subH = subN * subLhPx * s;
      const chipsGap = sc.chips ? 48 * s : 0;
      const chipsH = sc.chips ? 54 * s : 0;
      // Altura do bloco a partir da baseline do eyebrow (incl. o "corpo" do eyebrow acima dela).
      const eyeCap = eyeSize * 0.75 * s;
      const blockH = eyeCap + eyeToTitle + titleH + (sc.sub ? subGap + subH : 0) + (sc.chips ? chipsGap + chipsH : 0);
      const zoneTop = bandTop + 22 * s;
      const zoneBottom = H - 86 * s;
      const eyeY = zoneTop + eyeCap + Math.max(0, (zoneBottom - zoneTop - blockH) / 2);
      drawEyebrow(ctx, s, x, eyeY, sc.eyebrow || "", a, pal, eyeSize);
      let tb = drawTitle(ctx, s, x, eyeY + eyeToTitle, lines, a, rise, px, pal);
      if (sc.sub) tb = drawSub(ctx, s, x, tb + subGap, W, sc.sub, a, pal, subSize, subLhPx);
      if (sc.chips) drawChips(ctx, s, x, tb + chipsGap, sc.chips, a, W - x * 2, pal);
      return;
    }
    if (style === "vivid") {
      // FOTO VÍVIDA (institucional): texto ancorado na faixa sólida inferior (a imagem manda em cima).
      const bandTop = H * 0.58;
      const lines = sc.title || [];
      const px = fitTitlePx(ctx, s, lines, availW, 70, 104);
      const eyeY = bandTop + 100 * s;
      drawEyebrow(ctx, s, x, eyeY, sc.eyebrow || "", a, pal);
      let tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 46) * s, lines, a, rise, px, pal);
      if (sc.sub) {
        drawSub(ctx, s, x, tb + 28 * s, W, sc.sub, a, pal);
        tb += 96 * s;
      }
      if (sc.chips) drawChips(ctx, s, x, tb + 40 * s, sc.chips, a, W - x * 2, pal);
      return;
    }
    if (sc.mock) {
      // O APP: mockup em cima + legenda (título + sub) embaixo, título auto-ajustado à largura.
      const pop = easeOut(clamp01((lt - 0.15) / 0.85));
      const cardY = H * 0.29 + (1 - pop) * 30 * s;
      // Card maior e RETO. Largura de design 700 (era 540); passo o s proporcional pra o conteúdo
      // (números, barras, donut) escalar junto e manter o mesmo preenchimento do card.
      const D = 700;
      drawMockCard(ctx, s * (D / 540), W / 2, cardY, D * s, sc.mock, a * (0.3 + 0.7 * pop), lt);
      const px = fitTitlePx(ctx, s, sc.title || [], availW, 84, 104);
      const eyeY = H * 0.605;
      drawEyebrow(ctx, s, x, eyeY, sc.eyebrow || "", a, pal);
      const tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 50) * s, sc.title || [], a, rise, px, pal);
      if (sc.sub) drawSub(ctx, s, x, tb + 26 * s, W, sc.sub, a, pal);
    } else {
      // PROBLEMA / BENEFÍCIO: título GRANDE que preenche a largura + sub/chips opcionais.
      const lines = sc.title || [];
      const px = fitTitlePx(ctx, s, lines, availW, 104, 150);
      const lh = (px + 8) * s;
      // do baseline do eyebrow ao 1º baseline do título. Usa px*0.72 (altura de caixa-alta do título)
      // pra o VÃO até o topo do título ficar CONSTANTE (~56s), independente do tamanho do título.
      const eyeGap = (px * 0.72 + 56) * s;
      const titleH = lines.length * lh;
      const extraH = sc.sub ? 150 * s : sc.chips ? 150 * s : 0;
      const blockH = eyeGap + titleH + extraH;
      const eyeY = (H - blockH) / 2 + px * 0.35 * s; // centraliza o bloco todo verticalmente
      drawEyebrow(ctx, s, x, eyeY, sc.eyebrow || "", a, pal);
      let tb = drawTitle(ctx, s, x, eyeY + eyeGap, lines, a, rise, px, pal);
      if (sc.sub) {
        drawSub(ctx, s, x, tb + 34 * s, W, sc.sub, a, pal);
        tb += 90 * s;
      }
      if (sc.chips) drawChips(ctx, s, x, tb + 46 * s, sc.chips, a, W - x * 2, pal);
    }
    return;
  }

  if (sc.kind === "privacy") {
    drawEyebrow(ctx, s, x, midY - 300 * s, sc.eyebrow || "", a);
    drawTitle(ctx, s, x, midY - 184 * s, sc.title || [], a, rise);
    if (sc.sub) drawSub(ctx, s, x, midY + 30 * s, W, sc.sub, a);
    // "cadeado + ••••" cifrando
    const ly = midY + 200 * s;
    ctx.globalAlpha = a;
    // cadeado
    const lx = x, lw = 64 * s, lh = 52 * s, ah = 30 * s;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.arc(lx + lw / 2, ly, ah / 2 + 6 * s, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    roundRect(ctx, lx, ly, lw, lh, 12 * s);
    ctx.fill();
    // dots cifrados aparecendo
    const dotN = 8;
    const shown = Math.floor(clamp01((lt - 0.4) / 1.1) * dotN);
    ctx.fillStyle = ACCENT;
    for (let i = 0; i < shown; i++) {
      ctx.beginPath();
      ctx.arc(lx + lw + 44 * s + i * 40 * s, ly + lh / 2, 11 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (sc.kind === "networth") {
    drawEyebrow(ctx, s, x, midY - 300 * s, sc.eyebrow || "", a);
    // número contando
    const target = Number(sc.value || 0);
    const p = easeOut(clamp01((lt - 0.2) / 1.2));
    const n = Math.round(target * p);
    ctx.globalAlpha = a;
    ctx.fillStyle = TEXT;
    ctx.font = fontSans(120 * s, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("R$ " + n.toLocaleString("pt-BR"), x, midY - 170 * s + rise);
    // variação
    ctx.fillStyle = ACCENT;
    ctx.font = fontSans(38 * s, 600);
    ctx.fillText("▲ 2,4% no mês", x, midY - 110 * s);
    // badges de moeda
    let bx = x;
    (sc.badges || []).forEach((code, i) => {
      bx += badge(ctx, s, bx, midY - 60 * s, code, i === 0) + 12 * s;
    });
    // mini gráfico subindo (desenha progressivo)
    const gy0 = midY + 90 * s, gh = 210 * s, gw = W - x * 2;
    const pts = [0.62, 0.55, 0.6, 0.42, 0.48, 0.3, 0.36, 0.14];
    const prog = easeInOut(clamp01((lt - 0.3) / 1.4));
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 8 * s;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    const total = pts.length - 1;
    for (let i = 0; i < pts.length; i++) {
      const seg = i / total;
      if (seg > prog) break;
      const px = x + (gw * i) / total;
      const py = gy0 + gh * pts[i];
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (sc.sub) drawSub(ctx, s, x, midY + 360 * s, W, sc.sub, a);
    ctx.globalAlpha = 1;
    return;
  }

  if (sc.kind === "budget") {
    drawEyebrow(ctx, s, x, midY - 320 * s, sc.eyebrow || "", a);
    drawTitle(ctx, s, x, midY - 230 * s, sc.title || [], a, rise);
    // barras preenchendo em cascata
    const bars = sc.bars || [];
    const by0 = midY + 20 * s, bh = 22 * s, gap = 60 * s, tw = W - x * 2 - 200 * s;
    bars.forEach((b, i) => {
      const yy = by0 + i * gap;
      ctx.globalAlpha = a;
      // trilho
      ctx.fillStyle = CARD2;
      roundRect(ctx, x, yy, tw, bh, bh / 2);
      ctx.fill();
      // preenchimento
      const bp = easeOut(clamp01((lt - 0.3 - i * 0.15) / 0.7));
      ctx.fillStyle = b.c || ACCENT;
      roundRect(ctx, x, yy, tw * b.w * bp, bh, bh / 2);
      ctx.fill();
      // rótulo
      ctx.fillStyle = MUTED;
      ctx.font = fontSans(28 * s, 500);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, x + tw + 24 * s, yy + bh / 2);
      ctx.globalAlpha = 1;
    });
    return;
  }

  if (sc.kind === "cta") {
    // logo grande centralizado + tagline + url
    ctx.globalAlpha = a;
    const d = 150 * s, cx = W / 2 - d / 2, cy = midY - 260 * s + rise;
    drawMark(ctx, cx, cy, d);
    ctx.textAlign = "center";
    ctx.fillStyle = pal.text;
    ctx.font = fontSans(72 * s, 600);
    ctx.textBaseline = "alphabetic";
    ctx.fillText(sc.value || "Nossas Finanças", W / 2, cy + d + 100 * s);
    if (sc.tagline) {
      ctx.fillStyle = pal.accent;
      const tl = sc.tagline.toUpperCase();
      ctx.letterSpacing = `${2 * s}px`;
      ctx.font = fontMono(30 * s, 500);
      // Encolhe se a tagline (agora mais longa: verbo + benefício + "grátis") não couber em 1 linha.
      const maxTW = W - 120 * s;
      const tw = ctx.measureText(tl).width;
      if (tw > maxTW) ctx.font = fontMono(Math.max(20, 30 * (maxTW / tw)) * s, 500);
      ctx.fillText(tl, W / 2, cy + d + 165 * s);
      ctx.letterSpacing = "0px";
    }
    // pílula "abra grátis"
    ctx.font = fontSans(34 * s, 600);
    const pillT = "Abra grátis";
    const pw = ctx.measureText(pillT).width + 96 * s, ph = 82 * s, ppx = W / 2 - pw / 2, ppy = cy + d + 240 * s;
    ctx.fillStyle = pal.accent;
    roundRect(ctx, ppx, ppy, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = pal.onAccent;
    ctx.textBaseline = "middle";
    ctx.fillText(pillT, W / 2, ppy + ph / 2 + 1 * s);
    if (sc.sub) {
      ctx.fillStyle = pal.faint;
      ctx.font = fontMono(28 * s, 500);
      ctx.textBaseline = "alphabetic";
      ctx.fillText(sc.sub, W / 2, ppy + ph + 74 * s);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    return;
  }
}

/** Desenha o story inteiro no instante t (segundos, 0..duração). W×H = tamanho do canvas. */
export function drawStory(ctx: CanvasRenderingContext2D, story: Story, t: number, W: number, H: number, showProgress = true, photo: CanvasImageSource | null = null) {
  const s = W / 1080;
  const n = story.scenes.length;
  const dur = story.sceneDur ?? SCENE_DUR;
  const hold = story.lastHold ?? LAST_HOLD;
  const idx = Math.min(n - 1, Math.floor(t / dur));
  const lt = t - idx * dur;
  const sc = story.scenes[idx];
  // Cada CENA pode ter o próprio clima (sobrescreve o do story) → um mesmo story alterna templates.
  const style = sc.style ?? story.style;

  // Fundo + paleta por CENA (o vívido troca a foto pela cor no CTA; os demais são uniformes).
  let pal: Palette = DARK;
  if (style === "light") {
    drawLightBg(ctx, W, H, t);
    pal = LIGHT;
  } else if (style === "color") {
    drawColorBg(ctx, W, H, t);
    pal = ONCOLOR;
  } else if (style === "vivid") {
    if (sc.kind === "cta") {
      drawColorBg(ctx, W, H, t); // CTA fecha em verde bold (reveal), sem foto
      pal = ONCOLOR;
    } else if (photo) {
      // Educativo: foto MENOR (faixa de texto maior) — a explicação precisa de espaço; institucional
      // mantém a foto grande (título punch embaixo).
      drawVividPhotoBg(ctx, photo, W, H, story.teach ? 0.4 : 0.58, t);
      pal = DARK; // texto vai na faixa escura
    } else {
      drawBg(ctx, W, H, t);
    }
  } else if (style === "dark") {
    // escuro EXPLÍCITO: glow verde e ignora a foto do story (cenas de mockup num tour multi-template)
    const glow = GLOW[story.id] ?? [0.32, 0.22];
    drawBg(ctx, W, H, t, glow[0], glow[1]);
  } else if (photo) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawPhotoBg(ctx, photo, W, H, t);
  } else {
    // fallback (foto ainda carregando): glow verde
    const glow = GLOW[story.id] ?? [0.32, 0.22];
    drawBg(ctx, W, H, t, glow[0], glow[1]);
  }

  // Última cena (CTA): só fade-IN, sem fade-out — fica visível até o fim pro usuário clicar.
  const isLast = idx === n - 1;
  const a = isLast ? clamp01(lt / 0.6) : sceneAlpha(lt, dur);
  // SEM logo no topo dos stories: o Instagram já sobrepõe avatar + nome + "×" ali (colidia). O resto
  // é posicionado por frações da altura (independente da logo) → nada se move. A marca segue nos POSTS
  // (drawPost) e no wordmark grande da cena de CTA.
  sceneContent(ctx, s, W, H, sc, lt, a, pal, style, story.teach);
  // Barras de progresso: SÓ na prévia do admin. No vídeo exportado NÃO — o Instagram já põe as dele.
  if (showProgress) drawProgress(ctx, s, W, n, t, pal, dur, hold);
}

/** CAPA (thumbnail) do Reel — PADRONIZADA. Mesmo LAYOUT pra todos os reels (série coesa no grid):
 *  marca no topo · eyebrow (categoria) · TÍTULO grande de referência ao tema · rodapé com o site.
 *  Varia SÓ a cor de fundo (escuro / verde bold / papel claro) via REEL_COVER — sem foto, pra as capas
 *  não ficarem cada uma diferente. 9:16, baixável como PNG (o vídeo começa com o texto entrando). */
export function drawReelCover(ctx: CanvasRenderingContext2D, story: Story, W: number, H: number) {
  const s = W / 1080;
  const cover = REEL_COVER[story.id] ?? { eyebrow: "NOSSAS FINANÇAS", title: [story.name], bg: "dark" as const };

  let pal: Palette;
  if (cover.bg === "color") { drawColorBg(ctx, W, H, 0); pal = ONCOLOR; }
  else if (cover.bg === "light") { drawLightBg(ctx, W, H, 0); pal = LIGHT; }
  else { drawBg(ctx, W, H, 0, 0.72, 0.14); pal = DARK; }

  const x = 96 * s;

  // (sem watermark de marca no topo — o rodapé "nossasfinancas.com.br" carrega a marca)

  // bloco eyebrow + TÍTULO grande, centralizado na vertical
  const lines = cover.title;
  const px = fitTitlePx(ctx, s, lines, W - x * 2, 92, 150);
  const gap = 76 * s;
  const firstAscent = px * 0.74 * s;
  const tlh = (px + 8) * s;
  const blockH = gap + firstAscent + (lines.length - 1) * tlh + px * 0.22 * s;
  const eyeY = (H - blockH) / 2;
  drawEyebrow(ctx, s, x, eyeY, cover.eyebrow, 1, pal, 36);
  drawTitle(ctx, s, x, eyeY + gap + firstAscent, lines, 1, 0, px, pal);

  // rodapé: barrinha de acento + site (mono, discreto) — fecha a composição
  ctx.fillStyle = pal.accent;
  roundRect(ctx, x, H - 176 * s, 68 * s, 7 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = pal.faint;
  ctx.font = fontMono(28 * s, 500);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = `${1.5 * s}px`;
  ctx.fillText("nossasfinancas.com.br", x, H - 122 * s);
  ctx.letterSpacing = "0px";
}

// ── POSTS ESTÁTICOS (drawPost) ───────────────────────────────────────────────

/** Fundo verde PROFUNDO (variante esverdeada): base quase-preta esverdeada + brilho do verde
 *  fechado #15976A (não o acento aberto). Dá um clima diferente sem sair da marca. */
function drawPostGreenBg(ctx: CanvasRenderingContext2D, W: number, H: number, gx: number, gy: number) {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#0C1A14");
  base.addColorStop(1, "#080F0B");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const cx = W * gx, cy = H * gy, r = W * 0.95;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, "rgba(21,151,106,0.32)");
  g.addColorStop(0.5, "rgba(21,151,106,0.06)");
  g.addColorStop(1, "rgba(21,151,106,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Fundo com FOTO (cover), mais presente que a dos stories (aqui ela é o fundo, não textura):
 *  foto dessaturada/escura + tinte verde de marca + scrim vertical forte na base → texto sempre legível. */
function drawPostPhotoBg(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, W: number, H: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const p = photo as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const iw = p.naturalWidth || p.width || 0, ih = p.naturalHeight || p.height || 0;
  if (iw && ih) {
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.save();
    ctx.globalAlpha = 0.52;
    ctx.filter = "grayscale(0.4) brightness(0.72) contrast(1.03)";
    ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(10,11,13,0.42)");
  g.addColorStop(0.42, "rgba(10,11,13,0.5)");
  g.addColorStop(1, "rgba(10,11,13,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Rodapé do post: @handle (acento, mono) + site (fraco). Assinatura discreta em toda peça. */
function drawHandle(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, pal: Palette = DARK) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fontMono(26 * s, 600);
  ctx.fillStyle = pal.accent;
  ctx.letterSpacing = `${1 * s}px`;
  ctx.fillText("@nossasfinancasapp", x, y);
  const hw = ctx.measureText("@nossasfinancasapp").width + 16 * s;
  ctx.letterSpacing = "0px";
  ctx.font = fontSans(24 * s, 500);
  ctx.fillStyle = pal.faint;
  ctx.fillText("nossasfinancas.com.br", x + hw, y);
}

/** Tabela de comparação BR × Itália (label + 2 valores por linha), com divisores hairline. */
function drawCompare(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, W: number, cmp: NonNullable<Post["compare"]>) {
  const fullW = W - x * 2;
  const labelW = fullW * 0.44;
  const colW = (fullW - labelW) / 2;
  const xa = x + labelW;
  const xb = xa + colW;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fontMono(23 * s, 700);
  ctx.letterSpacing = `${1.5 * s}px`;
  ctx.fillStyle = ACCENT;
  ctx.fillText(cmp.head[0], xa, y);
  ctx.fillStyle = MUTED;
  ctx.fillText(cmp.head[1], xb, y);
  ctx.letterSpacing = "0px";
  let ry = y + 30 * s;
  const rh = 108 * s;
  for (const r of cmp.rows) {
    const mid = ry + rh * 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(x, ry);
    ctx.lineTo(x + fullW, ry);
    ctx.stroke();
    ctx.font = fontSans(27 * s, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(r.label, x, mid);
    ctx.font = fontSans(38 * s, 600);
    ctx.fillStyle = TEXT;
    ctx.fillText(r.a, xa, mid);
    ctx.fillStyle = ACCENT;
    ctx.fillText(r.b, xb, mid);
    ry += rh;
  }
  return ry;
}

/** Lista vertical (passo-a-passo / checklist / itens): marcador (número/check/ponto) + título + desc
 *  (quebrada por largura). Base de todo post EDUCATIVO. Retorna o Y do fim da lista. */
function drawSteps(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, W: number, items: { title: string; desc?: string }[], marker: "number" | "check" | "dot", pal: Palette) {
  const mR = 30 * s; // raio do marcador
  const textX = x + 92 * s;
  const maxW = W - textX - 90 * s;
  let yy = y;
  ctx.textAlign = "left";
  items.forEach((it, i) => {
    const mcx = x + mR, mcy = yy + mR;
    if (marker === "dot") {
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(mcx, mcy, 13 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(mcx, mcy, mR, 0, Math.PI * 2);
      ctx.fill();
      if (marker === "check") {
        ctx.strokeStyle = pal.onAccent;
        ctx.lineWidth = 6 * s;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(mcx - 14 * s, mcy + 1 * s);
        ctx.lineTo(mcx - 4 * s, mcy + 11 * s);
        ctx.lineTo(mcx + 15 * s, mcy - 12 * s);
        ctx.stroke();
      } else {
        ctx.fillStyle = pal.onAccent;
        ctx.font = fontSans(34 * s, 700);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), mcx, mcy + 2 * s);
      }
    }
    // título do item
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = pal.text;
    ctx.font = fontSans(42 * s, 600);
    ctx.fillText(it.title, textX, yy + 42 * s);
    let rowBottom = yy + 42 * s;
    if (it.desc) {
      ctx.fillStyle = pal.muted;
      ctx.font = fontSans(30 * s, 400);
      const lh = 42 * s;
      let ly = yy + 42 * s + 44 * s;
      const words = it.desc.split(" ");
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, textX, ly);
          line = w;
          ly += lh;
        } else line = test;
      }
      if (line) ctx.fillText(line, textX, ly);
      rowBottom = ly;
    }
    yy = rowBottom + 60 * s; // respiro entre itens
  });
  return yy;
}

/** Desenha UM post estático 4:5 (1080×1350 no full). Compõe os mesmos primitivos dos stories, mas
 *  parado (alpha 1, sem rise, mock totalmente revelado com lt alto). Arranjos: mock / comparação /
 *  estatística / passo-a-passo (steps) / título-herói (com sub e/ou chips). Marca no topo + @handle. */
export function drawPost(ctx: CanvasRenderingContext2D, post: PieceVisual, W: number, H: number, photo: CanvasImageSource | null = null) {
  const s = W / 1080;
  const style = post.style;
  const x = 90 * s;
  const availW = (W - x * 2) * 0.99;

  // Fundo + paleta por ESTILO (checa o estilo ANTES da foto: o vívido tem tratamento próprio).
  let pal: Palette = DARK;
  if (style === "light") {
    drawLightBg(ctx, W, H, 0, post.glow?.[0] ?? 0.28, post.glow?.[1] ?? 0.2);
    pal = LIGHT;
  } else if (style === "color") {
    drawColorBg(ctx, W, H, 0);
    pal = ONCOLOR;
  } else if (style === "vivid" && post.photo && photo) {
    drawVividPhotoBg(ctx, photo, W, H, 0.55, 0);
    pal = DARK; // texto na faixa escura inferior
  } else if (post.photo && photo) {
    drawPostPhotoBg(ctx, photo, W, H);
  } else if (post.green) {
    drawPostGreenBg(ctx, W, H, post.glow?.[0] ?? 0.5, post.glow?.[1] ?? 0.3);
  } else {
    drawBg(ctx, W, H, 0, post.glow?.[0] ?? 0.3, post.glow?.[1] ?? 0.18);
  }
  // (sem watermark de marca no topo — só o @handle no rodapé e o slide/cena de CTA carregam a marca)

  // FOTO VÍVIDA: eyebrow → título → sub ancorados na faixa sólida inferior.
  if (style === "vivid") {
    const bandTop = H * 0.55;
    const px = fitTitlePx(ctx, s, post.title, availW, 66, 92);
    const eyeY = bandTop + 92 * s;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1, pal);
    const tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 44) * s, post.title, 1, 0, px, pal);
    if (post.sub) drawSub(ctx, s, x, tb + 30 * s, W, post.sub, 1, pal);
    drawHandle(ctx, s, x, H - 60 * s, pal);
    return;
  }

  // ESTATÍSTICA (combina com o papel claro): eyebrow + título + NÚMERO-herói + label + sub, centrado.
  if (post.stat) {
    const px = fitTitlePx(ctx, s, post.title, availW, 78, 100);
    const lh = (px + 8) * s;
    const eyeGap = (px * 0.72 + 54) * s;
    const statPx = 148;
    const blockH = eyeGap + post.title.length * lh + 72 * s + statPx * s + 48 * s + (post.sub ? 120 * s : 0);
    const eyeY = (H - blockH) / 2 + px * 0.35 * s;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1, pal);
    const tb = drawTitle(ctx, s, x, eyeY + eyeGap, post.title, 1, 0, px, pal);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = pal.accent;
    ctx.font = fontSans(statPx * s, 600);
    const statY = tb + 72 * s + statPx * s;
    ctx.fillText(post.stat.value, x, statY);
    ctx.fillStyle = pal.faint;
    ctx.font = fontMono(28 * s, 600);
    ctx.letterSpacing = `${2 * s}px`;
    ctx.fillText(post.stat.label.toUpperCase(), x, statY + 46 * s);
    ctx.letterSpacing = "0px";
    if (post.sub) drawSub(ctx, s, x, statY + 96 * s, W, post.sub, 1, pal);
    drawHandle(ctx, s, x, H - 64 * s, pal);
    return;
  }

  // PASSO A PASSO / CHECKLIST / LISTA (educativo): eyebrow + título no alto + lista abaixo.
  if (post.steps) {
    const px = fitTitlePx(ctx, s, post.title, availW, 60, 84);
    const eyeY = H * 0.09; // margem do topo (a marca saiu → o bloco sobe pra reaproveitar o espaço)
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1, pal);
    let tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 52) * s, post.title, 1, 0, px, pal);
    if (post.sub) {
      drawSub(ctx, s, x, tb + 32 * s, W, post.sub, 1, pal);
      tb += 100 * s;
    }
    drawSteps(ctx, s, x, tb + 80 * s, W, post.steps, post.stepMarker ?? "number", pal);
    drawHandle(ctx, s, x, H - 64 * s, pal);
    return;
  }

  const postShot = adImage(post.shot);
  if (post.shot && postShot) {
    const { w: iw, h: ih } = imgWH(postShot);
    // SCREENSHOT emoldurado: eyebrow + título no alto, janela embaixo (encolhe se não couber).
    // Sem a marca no topo, a eyebrow sobe pra reaproveitar o espaço (a janela ganha mais folga embaixo).
    const eyeY = H * 0.09;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1, pal);
    const px = fitTitlePx(ctx, s, post.title, availW, 62, 86);
    let tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 54) * s, post.title, 1, 0, px, pal);
    if (post.sub) {
      drawSub(ctx, s, x, tb + 34 * s, W, post.sub, 1, pal);
      tb += 100 * s;
    }
    const topY = tb + 66 * s;
    let cw = W - 150 * s;
    if (topY + cw * (ih / iw) > H - 120 * s) cw = ((H - 120 * s - topY) * iw) / ih; // cabe acima do rodapé
    drawShotCard(ctx, s, W / 2, topY, cw, postShot, 1);
    drawHandle(ctx, s, x, H - 64 * s, pal);
    return;
  }
  if (post.mock) {
    drawMockCard(ctx, s * (540 / 540), W / 2, H * 0.3, 540 * s, post.mock, 1, 3);
    // Bloco eyebrow→título→sub ANCORADO acima do rodapé — assim 2 ou 3 linhas de título nunca
    // colam no @handle (o problema era o título de 3 linhas empurrar o sub por cima do rodapé).
    const px = fitTitlePx(ctx, s, post.title, availW, 72, 92);
    const lh = (px + 8) * s;
    const eyeGap = (px * 0.72 + 48) * s;
    const tb = H - (post.sub ? 210 : 120) * s; // base do título (reserva rodapé + ~2 linhas de sub)
    const eyeY = tb - post.title.length * lh - eyeGap;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1, pal);
    drawTitle(ctx, s, x, eyeY + eyeGap, post.title, 1, 0, px, pal);
    if (post.sub) drawSub(ctx, s, x, tb + 30 * s, W, post.sub, 1, pal);
  } else if (post.compare) {
    const eyeY = H * 0.085; // sem a marca no topo → o bloco sobe um pouco
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1, pal);
    const px = fitTitlePx(ctx, s, post.title, availW, 92, 112);
    const tb = drawTitle(ctx, s, x, eyeY + (px * 0.72 + 52) * s, post.title, 1, 0, px, pal);
    const cb = drawCompare(ctx, s, x, tb + 70 * s, W, post.compare);
    if (post.sub) drawSub(ctx, s, x, cb + 46 * s, W, post.sub, 1, pal);
  } else {
    const px = fitTitlePx(ctx, s, post.title, availW, 96, 132);
    const lh = (px + 8) * s;
    const eyeGap = (px * 0.72 + 56) * s;
    const titleH = post.title.length * lh;
    const extraH = (post.sub ? 140 * s : 0) + (post.chips ? 120 * s : 0);
    const blockH = eyeGap + titleH + extraH;
    const eyeY = (H - blockH) / 2 + px * 0.35 * s;
    drawEyebrow(ctx, s, x, eyeY, post.eyebrow, 1, pal);
    let tb = drawTitle(ctx, s, x, eyeY + eyeGap, post.title, 1, 0, px, pal);
    if (post.sub) {
      drawSub(ctx, s, x, tb + 36 * s, W, post.sub, 1, pal);
      tb += 100 * s;
    }
    if (post.chips) drawChips(ctx, s, x, tb + 44 * s, post.chips, 1, W - x * 2, pal);
  }
  drawHandle(ctx, s, x, H - 64 * s, pal);
}

/** Um SLIDE do carrossel = um post 4:5 + indicador de página (n/total) e, no 1º, a dica "arraste".
 *  O texto do slide vem do próprio Slide; a numeração é sobreposta aqui (não polui o drawPost). */
export function drawCarouselSlide(ctx: CanvasRenderingContext2D, slide: Slide, W: number, H: number, i: number, total: number, photo: CanvasImageSource | null = null) {
  drawPost(ctx, slide, W, H, photo);
  const s = W / 1080;
  // Só o topo do slide CLARO é claro; nos demais o topo é escuro/foto → texto do indicador claro.
  const onLight = slide.style === "light";
  ctx.save();
  ctx.font = fontMono(24 * s, 600);
  ctx.textBaseline = "alphabetic";
  // indicador n/total (canto superior direito, alinhado com a marca)
  ctx.textAlign = "right";
  ctx.fillStyle = onLight ? "rgba(14,21,18,0.5)" : "rgba(244,251,247,0.72)";
  ctx.letterSpacing = `${1 * s}px`;
  ctx.fillText(`${i + 1} / ${total}`, W - 90 * s, 104 * s);
  ctx.letterSpacing = "0px";
  // dica "arraste" só no 1º slide (à direita, acima do rodapé)
  if (i === 0) {
    const hint = "arraste →";
    const hy = H - 62 * s;
    ctx.textAlign = "right";
    ctx.fillStyle = onLight ? "#15976A" : ACCENT;
    ctx.fillText(hint, W - 90 * s, hy);
  }
  ctx.restore();
  ctx.textAlign = "left";
}

// ── CAPAS DE DESTAQUE (Instagram Highlights) ─────────────────────────────────
// Quadrado 1080×1080; o Instagram RECORTA num CÍRCULO centrado → só um ÍCONE no centro (sem texto:
// o nome do destaque é digitado no app). Set COESO: mesmo fundo escuro + glow verde + ícone no acento.
export interface HighlightCover {
  id: string;
  label: string; // nome do destaque (vai EMBAIXO no Instagram; não entra na imagem)
  hint: string; // quais stories agrupar (dica no admin)
  icon: "play" | "globe" | "lock" | "growth" | "code";
}
export const HIGHLIGHTS: HighlightCover[] = [
  { id: "comece", label: "Comece aqui", hint: "Tour do app · Simples", icon: "play" },
  { id: "multimoeda", label: "Multimoeda", hint: "Sem fronteiras · Quanto você tem", icon: "globe" },
  { id: "privacidade", label: "Privacidade", hint: "Privacidade", icon: "lock" },
  { id: "liberdade", label: "Liberdade", hint: "Seu futuro · Orçamento & liberdade", icon: "growth" },
  { id: "bastidores", label: "Bastidores", hint: "Build in public", icon: "code" },
];

/** Desenha UMA capa de destaque (ícone-só, centrado no círculo seguro). W=H (quadrado). */
export function drawHighlightCover(ctx: CanvasRenderingContext2D, cover: HighlightCover, W: number, H: number) {
  const s = W / 1080;
  const cx = W / 2, cy = H / 2;
  // fundo: quase-preto + glow verde central (dá profundidade no recorte circular)
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
  g.addColorStop(0, "rgba(62,207,142,0.22)");
  g.addColorStop(0.55, "rgba(62,207,142,0.05)");
  g.addColorStop(1, "rgba(62,207,142,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const R = 190 * s; // "raio" do glyph — folgado dentro do círculo seguro (~470s)
  ctx.strokeStyle = ACCENT;
  ctx.fillStyle = ACCENT;
  ctx.lineWidth = 30 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (cover.icon === "play") {
    const ox = cx + 0.06 * R; // leve compensação óptica do triângulo
    ctx.beginPath();
    ctx.moveTo(ox - 0.42 * R, cy - 0.62 * R);
    ctx.lineTo(ox - 0.42 * R, cy + 0.62 * R);
    ctx.lineTo(ox + 0.66 * R, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (cover.icon === "globe") {
    ctx.lineWidth = 26 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.42, R, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.stroke();
    const ly = R * 0.55, lw = R * 0.835;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx - lw, cy + dir * ly);
      ctx.lineTo(cx + lw, cy + dir * ly);
      ctx.stroke();
    }
  } else if (cover.icon === "lock") {
    ctx.lineWidth = 28 * s;
    const sr = R * 0.5, by = cy - R * 0.06, legTop = by - R * 0.16;
    // shackle (∩)
    ctx.beginPath();
    ctx.moveTo(cx - sr, by);
    ctx.lineTo(cx - sr, legTop);
    ctx.arc(cx, legTop, sr, Math.PI, 0, true);
    ctx.lineTo(cx + sr, by);
    ctx.stroke();
    // corpo
    const bw = R * 1.2, bh = R * 1.02, bx = cx - bw / 2;
    roundRect(ctx, bx, by, bw, bh, R * 0.18);
    ctx.fill();
    // fechadura (recorte escuro)
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(cx, by + bh * 0.4, R * 0.14, 0, Math.PI * 2);
    ctx.fill();
    roundRect(ctx, cx - R * 0.06, by + bh * 0.4, R * 0.12, R * 0.32, R * 0.06);
    ctx.fill();
  } else if (cover.icon === "growth") {
    ctx.lineWidth = 30 * s;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy + R * 0.6);
    ctx.lineTo(cx - R * 0.32, cy - R * 0.05);
    ctx.lineTo(cx + R * 0.16, cy + R * 0.26);
    ctx.lineTo(cx + R, cy - R * 0.62);
    ctx.stroke();
    // seta no fim (↗)
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.5, cy - R * 0.62);
    ctx.lineTo(cx + R, cy - R * 0.62);
    ctx.lineTo(cx + R, cy - R * 0.12);
    ctx.stroke();
  } else {
    // code </>
    ctx.lineWidth = 30 * s;
    const k = R * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.42, cy - k);
    ctx.lineTo(cx - R * 0.95, cy);
    ctx.lineTo(cx - R * 0.42, cy + k);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.42, cy - k);
    ctx.lineTo(cx + R * 0.95, cy);
    ctx.lineTo(cx + R * 0.42, cy + k);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.2, cy - R * 0.78);
    ctx.lineTo(cx - R * 0.2, cy + R * 0.78);
    ctx.stroke();
  }
}
