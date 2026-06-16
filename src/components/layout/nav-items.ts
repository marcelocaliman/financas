import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  PiggyBank,
  LineChart,
  Target,
  BarChart3,
  Globe,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** id da seção-âncora na página única */
  id: string;
  /** chave i18n sob `nav.*` */
  key: string;
  icon: LucideIcon;
}

/** Fonte única da navegação — agora âncoras de uma página editorial única. */
export const NAV_ITEMS: NavItem[] = [
  { id: "painel", key: "painel", icon: LayoutDashboard },
  { id: "patrimonio", key: "patrimonio", icon: Wallet },
  { id: "investimentos", key: "investimentos", icon: TrendingUp },
  { id: "orcamento", key: "orcamento", icon: PiggyBank },
  { id: "historico", key: "historico", icon: LineChart },
  { id: "objetivos", key: "objetivos", icon: Target },
  { id: "projecao", key: "projecao", icon: BarChart3 },
  { id: "crossborder", key: "crossborder", icon: Globe },
];
