import { LayoutDashboard, Users, BarChart3, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";

export interface AdminNavItem {
  /** id do accordion na página do painel (adm-*) */
  id: string;
  /** chave i18n do rótulo (admin.nav.*) */
  key: string;
  icon: LucideIcon;
}

/** Seções do painel super-admin — mesma estrutura de "tabs" do app. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "adm-overview", key: "overview", icon: LayoutDashboard },
  { id: "adm-users", key: "users", icon: Users },
  { id: "adm-analytics", key: "analytics", icon: BarChart3 },
  { id: "adm-access", key: "access", icon: ScrollText },
  { id: "adm-admins", key: "admins", icon: ShieldCheck },
];
