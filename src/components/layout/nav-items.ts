import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  PiggyBank,
  LineChart,
  Target,
  BarChart3,
  Globe,
  User,
  ShieldCheck,
  Tags,
  Palette,
  Database,
  Lock,
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

export interface ConfigNavItem {
  /** id do accordion na página de Config (cfg-*) — deve casar com os ids em pages/config.tsx */
  id: string;
  /** chave i18n completa do rótulo */
  labelKey: string;
  icon: LucideIcon;
}

/** Seções da página de Configurações — a nav lateral troca pra esta lista quando a Config abre. */
export const CONFIG_NAV_ITEMS: ConfigNavItem[] = [
  { id: "cfg-account", labelKey: "config.account", icon: User },
  { id: "cfg-security", labelKey: "config.security", icon: ShieldCheck },
  { id: "cfg-categories", labelKey: "config.categories", icon: Tags },
  { id: "cfg-appearance", labelKey: "config.appearance", icon: Palette },
  { id: "cfg-data", labelKey: "data.title", icon: Database },
  { id: "cfg-privacy", labelKey: "config.privacy", icon: Lock },
];
