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
  PiggyBank,
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
export type Hub = { key: string; label: string; tabs: HubTab[] };

/** Os 6 hubs. A 1ª aba é a "porta" do hub (o que o item primário abre). */
export const HUBS: Hub[] = [
  {
    key: "inicio",
    label: "Início",
    tabs: [{ label: "Início", href: "/dashboard", icon: Home }],
  },
  {
    key: "transacoes",
    label: "Transações",
    tabs: [
      { label: "Lançamentos", href: "/transacoes", icon: ArrowLeftRight },
      { label: "Documentos", href: "/inbox", icon: Inbox },
      { label: "Histórico", href: "/analise", icon: LineChart },
    ],
  },
  {
    key: "carteira",
    label: "Carteira",
    tabs: [
      { label: "Investimentos", href: "/investimentos", icon: Wallet },
      { label: "Resgates", href: "/resgates", icon: Layers },
      { label: "Bens", href: "/patrimonio", icon: Package },
      { label: "Dívidas", href: "/dividas", icon: HandCoins },
    ],
  },
  {
    key: "planejamento",
    label: "Planejamento",
    tabs: [
      { label: "Recorrentes", href: "/recorrentes", icon: Repeat },
      { label: "Metas", href: "/metas", icon: Target },
      { label: "Independência", href: "/independencia", icon: Flame },
      { label: "Orçamento", href: "/orcamento", icon: PiggyBank },
    ],
  },
  {
    key: "imposto",
    label: "Imposto de Renda",
    tabs: [
      { label: "IRPF", href: "/ir", icon: Landmark },
      { label: "Declarantes", href: "/declarantes", icon: UsersIcon },
    ],
  },
  {
    key: "ajustes",
    label: "Ajustes",
    tabs: [
      { label: "Contas", href: "/contas", icon: CreditCard },
      { label: "Categorias", href: "/categorias", icon: Tag },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
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
  return HUBS.find((h) =>
    h.tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + "/")),
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
