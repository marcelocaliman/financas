import { Users, BarChart3, ScrollText, ShieldCheck, Flag, Megaphone, type LucideIcon } from "lucide-react";

export interface AdminNavItem {
  /** id do accordion na página do painel (adm-*) */
  id: string;
  /** chave i18n do rótulo (admin.nav.*) */
  key: string;
  /** ícone do item (a "Visão geral" não tem — é sempre visível, funciona como âncora do topo) */
  icon?: LucideIcon;
}

/** Seções do painel super-admin — mesma estrutura de "tabs" do app. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "adm-overview", key: "overview" },
  { id: "adm-users", key: "users", icon: Users },
  { id: "adm-analytics", key: "analytics", icon: BarChart3 },
  { id: "adm-access", key: "access", icon: ScrollText },
  { id: "adm-admins", key: "admins", icon: ShieldCheck },
  { id: "adm-flags", key: "flags", icon: Flag },
  { id: "adm-ads", key: "ads", icon: Megaphone },
];
