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
  FileText,
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
 * Fonte ÚNICA da navegação (antes duplicada em sidebar + mobile-drawer).
 * IA enxugada (auditoria UX): 4 pilares, com itens secundários indentados sob
 * o pai natural pra reduzir densidade sem esconder nada.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  group: string;
  /** Item secundário — renderiza indentado sob o item primário acima dele. */
  sub?: boolean;
};

export const mainNavItems: NavItem[] = [
  // Dia a dia (operacional, alta frequência)
  { label: "Início", href: "/dashboard", icon: Home, group: "diaadia" },
  { label: "Transações", href: "/transacoes", icon: ArrowLeftRight, group: "diaadia" },
  { label: "Recorrentes", href: "/recorrentes", icon: Repeat, group: "diaadia", sub: true },
  { label: "Documentos", href: "/inbox", icon: Inbox, group: "diaadia" },
  { label: "Histórico", href: "/analise", icon: LineChart, group: "diaadia" },
  { label: "Relatórios", href: "/relatorios", icon: FileText, group: "diaadia", sub: true },

  // Patrimônio
  { label: "Investimentos", href: "/investimentos", icon: Wallet, group: "patrimonio" },
  { label: "Resgates", href: "/resgates", icon: Layers, group: "patrimonio", sub: true },
  { label: "Patrimônio", href: "/patrimonio", icon: Package, group: "patrimonio" },
  { label: "Dívidas", href: "/dividas", icon: HandCoins, group: "patrimonio", sub: true },
  { label: "Metas", href: "/metas", icon: Target, group: "patrimonio" },
  { label: "Independência", href: "/independencia", icon: Flame, group: "patrimonio", sub: true },

  // Imposto de Renda (o diferencial)
  { label: "IRPF", href: "/ir", icon: Landmark, group: "ir" },
  { label: "Declarantes", href: "/declarantes", icon: UsersIcon, group: "ir", sub: true },

  // Ajustes
  { label: "Contas", href: "/contas", icon: CreditCard, group: "ajustes" },
  { label: "Categorias", href: "/categorias", icon: Tag, group: "ajustes" },
  { label: "Orçamento", href: "/orcamento", icon: Target, group: "ajustes", sub: true },
];

export const mainGroupLabels: Record<string, string> = {
  diaadia: "Dia a dia",
  patrimonio: "Patrimônio",
  ir: "Imposto de Renda",
  ajustes: "Ajustes",
};

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
