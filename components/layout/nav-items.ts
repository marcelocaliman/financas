import {
  Home,
  ArrowLeftRight,
  LineChart,
  Wallet,
  Layers,
  Target,
  CreditCard,
  Tag,
  Package,
  Repeat,
  LayoutDashboard,
  Users as UsersIcon,
  History,
  Activity,
  FileWarning,
  Settings,
  Flame,
  ToggleRight,
  Megaphone,
  Server,
  Landmark,
  HandCoins,
  AlertTriangle,
  Inbox,
} from "lucide-react";

/**
 * Fonte ÚNICA da navegação. Rearquitetura em 6 HUBS (decisão do dono): o app
 * responde às PERGUNTAS do usuário, não ao tipo de dado. Cada hub agrupa páginas
 * relacionadas; dentro do hub, as páginas viram ABAS (ver components/layout/
 * hub-tabs.tsx). Nada de feature some — só reorganiza navegação/layout.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  group: string;
  /** Item secundário — renderiza indentado sob o item primário do hub. */
  sub?: boolean;
};

export type HubTab = { label: string; href: string; icon: typeof Home };
export type Hub = {
  key: string;
  label: string;
  tabs: HubTab[];
  /** Rotas que pertencem ao hub mas NÃO viram aba (ex.: /declarantes no IR). Só
   * pra detecção do hub (highlight no menu), não aparecem como tab nem no sidebar. */
  extraPaths?: string[];
};

/** Os 6 hubs. A 1ª aba é a "porta" do hub (o que o item primário abre). */
export const HUBS: Hub[] = [
  {
    key: "inicio",
    label: "Início",
    tabs: [{ label: "Início", href: "/dashboard", icon: Home }],
  },
  {
    // Recorrentes mora aqui (não em Planejamento): recorrente é "o lançamento que
    // se repete" — pertence ao mundo operacional de Transações.
    key: "transacoes",
    label: "Transações",
    tabs: [
      { label: "Lançamentos", href: "/transacoes", icon: ArrowLeftRight },
      { label: "Documentos", href: "/inbox", icon: Inbox },
      { label: "Recorrentes", href: "/recorrentes", icon: Repeat },
      { label: "Histórico", href: "/analise", icon: LineChart },
      // Atividade = log de TODAS as ações (qualquer tabela) com Desfazer. Distinto
      // de "Histórico" (/analise = tendências do dinheiro). Primeira classe: o dono
      // quer reverter erros fácil, então não pode ficar escondido em Configurações.
      { label: "Atividade", href: "/atividade", icon: History },
    ],
  },
  {
    // Contas abre o hub (porta): consultar saldo/fatura é pergunta diária de
    // Carteira, não de "Ajustes". Conta → Investimentos → Bens → Dívidas conta a
    // narrativa do patrimônio (líquido → aplicado → imobilizado → passivo).
    key: "carteira",
    label: "Carteira",
    tabs: [
      { label: "Contas", href: "/contas", icon: CreditCard },
      { label: "Investimentos", href: "/investimentos", icon: Wallet },
      { label: "Resgates", href: "/resgates", icon: Layers },
      { label: "Bens", href: "/patrimonio", icon: Package },
      { label: "Dívidas", href: "/dividas", icon: HandCoins },
    ],
  },
  {
    // Só futuro/objetivos — Recorrentes saiu (é operacional, foi pra Transações).
    key: "planejamento",
    label: "Planejamento",
    tabs: [
      { label: "Metas", href: "/metas", icon: Target },
      { label: "Independência", href: "/independencia", icon: Flame },
    ],
  },
  {
    // Declarantes (titular/cônjuge/dependentes) não tem assento próprio — é
    // "configura uma vez". Mora dentro do IR (link na landing + /ir/[ano]/
    // configuracoes). extraPaths mantém o hub destacado quando se está em /declarantes.
    key: "imposto",
    label: "Imposto de Renda",
    tabs: [{ label: "IRPF", href: "/ir", icon: Landmark }],
    extraPaths: ["/declarantes"],
  },
  {
    // Categorias absorve Orçamento (mesma entidade: categoria + seu teto) via pill
    // interno. Configurações saiu da lista — acesso só pelo perfil no rodapé.
    key: "ajustes",
    label: "Ajustes",
    tabs: [{ label: "Categorias", href: "/categorias", icon: Tag }],
  },
];

/** Sidebar: cada hub vira um grupo (label = nome do hub); abas viram itens. */
export const mainNavItems: NavItem[] = HUBS.flatMap((h) =>
  h.tabs.map((t, i) => ({
    label: t.label,
    href: t.href,
    icon: t.icon,
    group: h.key,
    sub: i > 0,
  })),
);

export const mainGroupLabels: Record<string, string> = {
  // Início é auto-explicativo — sem header redundante.
  inicio: "",
  transacoes: "Transações",
  carteira: "Carteira",
  planejamento: "Planejamento",
  imposto: "Imposto de Renda",
  ajustes: "Ajustes",
};

/** Acha o hub a que uma rota pertence (pra renderizar as abas do hub). */
export function hubForPath(pathname: string): Hub | undefined {
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return HUBS.find(
    (h) => h.tabs.some((t) => matches(t.href)) || (h.extraPaths ?? []).some(matches),
  );
}

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, group: "geral" },
  { label: "Métricas", href: "/admin/metrics", icon: Activity, group: "geral" },
  { label: "Households", href: "/admin/households", icon: Home, group: "gestao" },
  { label: "Usuários", href: "/admin/users", icon: UsersIcon, group: "gestao" },
  { label: "Assinaturas", href: "/admin/subscriptions", icon: CreditCard, group: "billing" },
  { label: "Pedidos LGPD", href: "/admin/data-requests", icon: FileWarning, group: "lgpd" },
  { label: "Audit log", href: "/admin/audit-log", icon: History, group: "lgpd" },
  { label: "System alerts", href: "/admin/system-alerts", icon: AlertTriangle, group: "lgpd" },
  { label: "Feature flags", href: "/admin/feature-flags", icon: ToggleRight, group: "config" },
  { label: "Anúncios", href: "/admin/announcements", icon: Megaphone, group: "config" },
  { label: "Sistema", href: "/admin/system", icon: Server, group: "config" },
  { label: "Configurações", href: "/admin/settings", icon: Settings, group: "config" },
];

export const adminGroupLabels: Record<string, string> = {
  geral: "Visão geral",
  gestao: "Gestão",
  billing: "Receita",
  lgpd: "Compliance",
  config: "Configuração",
};
