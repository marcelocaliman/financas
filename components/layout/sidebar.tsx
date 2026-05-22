"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarLiveTicker } from "@/components/layout/sidebar-live-ticker";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import { cn } from "@/lib/utils/cn";
import type { SidebarBadges } from "@/services/sidebar-badges";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  group: "principal" | "investir" | "config";
};

const navItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home, group: "principal" },
  { label: "Transações", href: "/transacoes", icon: ArrowLeftRight, group: "principal" },
  { label: "Recorrentes", href: "/recorrentes", icon: Repeat, group: "principal" },
  { label: "Análise", href: "/analise", icon: LineChart, group: "principal" },
  { label: "Investimentos", href: "/investimentos", icon: Wallet, group: "investir" },
  { label: "Patrimônio", href: "/patrimonio", icon: Package, group: "investir" },
  { label: "Resgates", href: "/resgates", icon: Layers, group: "investir" },
  { label: "Metas", href: "/metas", icon: Target, group: "investir" },
  { label: "Contas", href: "/contas", icon: CreditCard, group: "config" },
  { label: "Categorias", href: "/categorias", icon: Tag, group: "config" },
];

const groupLabels: Record<NavItem["group"], string> = {
  principal: "Cotidiano",
  investir: "Patrimônio",
  config: "Bastidores",
};

export function Sidebar({
  user,
  householdName,
  badges,
}: {
  user: { name: string; email: string | null };
  householdName: string;
  badges?: SidebarBadges;
}) {
  const pathname = usePathname();
  const badgeByHref: Record<string, number> = {
    "/resgates": badges?.resgatesPendingSoon ?? 0,
    "/metas": badges?.metasJustAchieved ?? 0,
  };
  const grouped = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] = acc[item.group] ?? [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col w-[220px] bg-ink-950 text-navy-100 sticky top-0 h-screen border-r border-ink-800">
      {/* Brand */}
      <div className="px-7 pt-7 pb-6 border-b border-ink-800">
        <BrandMark tone="light" size="md" />
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-navy-400 mt-1.5 font-medium">
          {householdName}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 pt-5 overflow-y-auto">
        {(Object.keys(grouped) as Array<NavItem["group"]>).map((g) => (
          <div key={g} className="mb-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-ink-600 px-3 mt-4 mb-2 font-medium">
              {groupLabels[g]}
            </div>
            {grouped[g].map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const badgeCount = badgeByHref[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13.5px] mb-0.5 transition-colors",
                    isActive
                      ? "bg-ink-800 text-white font-medium"
                      : "text-navy-200 hover:bg-ink-800 hover:text-white",
                  )}
                >
                  {isActive ? (
                    <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-gold-600 rounded-full" />
                  ) : null}
                  <Icon
                    className={cn(
                      "w-[15px] h-[15px] shrink-0",
                      isActive ? "opacity-100" : "opacity-70",
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 ? (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-mono font-medium tabular-nums",
                        item.href === "/metas"
                          ? "bg-olive-600 text-white"
                          : "bg-gold-600 text-ink-950",
                      )}
                      aria-label={`${badgeCount} item${badgeCount === 1 ? "" : "s"} aguardando ação`}
                    >
                      {badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + theme + live ticker */}
      <div className="border-t border-ink-800 px-4 py-3 space-y-2">
        <SidebarLiveTicker />
        <div className="flex items-center justify-between px-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600 font-medium">
            Modo
          </span>
          <div className="flex items-center gap-1">
            <PrivacyToggle tone="dark" />
            <ThemeToggle tone="dark" />
          </div>
        </div>
        <Link
          href="/configuracoes"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[7px] hover:bg-ink-800 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-navy-700 text-navy-100 flex items-center justify-center text-[11px] font-medium">
            {initials || "·"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-[12.5px] font-medium leading-tight truncate">
              {user.name}
            </div>
            <div className="text-ink-600 text-[10.5px] tracking-[0.04em] truncate">
              {user.email ?? "—"}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
