"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  Users as UsersIcon,
  Home as HomeIcon,
  History,
  CreditCard,
  Activity,
  FileWarning,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/households", label: "Households", icon: HomeIcon },
  { href: "/admin/users", label: "Usuários", icon: UsersIcon },
  { href: "/admin/subscriptions", label: "Assinaturas", icon: CreditCard },
  { href: "/admin/data-requests", label: "Pedidos LGPD", icon: FileWarning },
  { href: "/admin/audit-log", label: "Audit log", icon: History },
  { href: "/admin/metrics", label: "Métricas", icon: Activity },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="lg:sticky lg:top-8 self-start">
      <div className="mb-3 px-3 flex items-center gap-2 text-faint-foreground">
        <Shield className="w-3.5 h-3.5" strokeWidth={1.8} />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-medium">
          Superadmin
        </span>
      </div>
      <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.exact
            ? pathname === it.href
            : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "shrink-0 inline-flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13.5px] transition-colors whitespace-nowrap",
                active
                  ? "bg-surface text-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-muted",
              )}
            >
              <Icon
                className={cn(
                  "w-[15px] h-[15px] shrink-0",
                  active ? "opacity-100" : "opacity-65",
                )}
                strokeWidth={1.7}
              />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
