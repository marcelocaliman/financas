import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  PiggyBank,
  LineChart,
  Target,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  /** chave i18n sob `nav.*` */
  key: string;
  icon: LucideIcon;
}

/** Fonte única da navegação (8 seções do BRIEF). */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", key: "painel", icon: LayoutDashboard },
  { to: "/patrimonio", key: "patrimonio", icon: Wallet },
  { to: "/investimentos", key: "investimentos", icon: TrendingUp },
  { to: "/orcamento", key: "orcamento", icon: PiggyBank },
  { to: "/historico", key: "historico", icon: LineChart },
  { to: "/objetivos", key: "objetivos", icon: Target },
  { to: "/projecao", key: "projecao", icon: BarChart3 },
  { to: "/config", key: "config", icon: Settings },
];
