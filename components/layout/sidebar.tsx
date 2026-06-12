"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Shield, ChevronLeft } from "lucide-react";
import {
  mainNavItems,
  mainGroupLabels,
  adminNavItems,
  adminGroupLabels,
  type NavItem,
} from "@/components/layout/nav-items";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarLiveTicker } from "@/components/layout/sidebar-live-ticker";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { SidebarBadges } from "@/services/sidebar-badges";

export function Sidebar({
  user,
  householdName,
  badges,
  isPlatformAdmin = false,
  notificationBell,
  irEnabled = true,
}: {
  user: { name: string; email: string | null };
  householdName: string;
  badges?: SidebarBadges;
  isPlatformAdmin?: boolean;
  /** Slot pro <NotificationBell /> (server component). Renderizado no rodapé. */
  notificationBell?: ReactNode;
  irEnabled?: boolean;
}) {
  const pathname = usePathname();
  const isAdminContext = pathname.startsWith("/admin");

  return (
    <aside className="hidden lg:flex flex-col w-[220px] bg-ink-950 text-navy-100 sticky top-0 h-screen border-r border-ink-800 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {isAdminContext ? (
          <SidebarContent
            key="admin"
            variant="admin"
            slideFrom="right"
            user={user}
            notificationBell={notificationBell}
            householdName={householdName}
            pathname={pathname}
          />
        ) : (
          <SidebarContent
            key="main"
            variant="main"
            slideFrom="left"
            user={user}
            householdName={householdName}
            pathname={pathname}
            badges={badges}
            isPlatformAdmin={isPlatformAdmin}
            notificationBell={notificationBell}
            irEnabled={irEnabled}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}

function SidebarContent({
  variant,
  slideFrom,
  user,
  householdName,
  pathname,
  badges,
  isPlatformAdmin,
  notificationBell,
  irEnabled = true,
}: {
  variant: "main" | "admin";
  slideFrom: "left" | "right";
  user: { name: string; email: string | null };
  householdName: string;
  pathname: string;
  badges?: SidebarBadges;
  isPlatformAdmin?: boolean;
  notificationBell?: ReactNode;
  irEnabled?: boolean;
}) {
  const allNavItems = variant === "admin" ? adminNavItems : mainNavItems;
  // IRPF desligado → some o hub "imposto" do menu (reversível via households.ir_enabled).
  const navItems = irEnabled ? allNavItems : allNavItems.filter((i) => i.group !== "imposto");
  const groupLabels = variant === "admin" ? adminGroupLabels : mainGroupLabels;

  const metasReminders = badges?.metasRemindersDue ?? 0;
  const metasAchieved = badges?.metasJustAchieved ?? 0;
  const badgeByHref: Record<string, number> =
    variant === "main"
      ? {
          "/resgates": badges?.resgatesPendingSoon ?? 0,
          "/metas": metasReminders > 0 ? metasReminders : metasAchieved,
          "/inbox": badges?.inboxReviewCount ?? 0,
        }
      : {};
  const badgeIsReminderByHref: Record<string, boolean> = {
    "/metas": metasReminders > 0,
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
    <motion.div
      initial={{ x: slideFrom === "right" ? "100%" : "-100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: slideFrom === "right" ? "100%" : "-100%", opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex flex-col"
    >
      {/* Brand */}
      <div className="px-7 pt-7 pb-6 border-b border-ink-800">
        {variant === "admin" ? (
          <div>
            <div className="flex items-center gap-2 text-gold-600">
              <Shield className="w-4 h-4" strokeWidth={1.7} />
              <span className="font-display italic text-[20px] tracking-[-0.02em]">
                superadmin
              </span>
            </div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-navy-400 mt-1.5 font-medium">
              Painel da plataforma
            </div>
          </div>
        ) : (
          <>
            <BrandMark tone="light" size="md" />
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-navy-400 mt-1.5 font-medium">
              {householdName}
            </div>
          </>
        )}
      </div>

      {/* Botão "voltar ao app" no topo do admin */}
      {variant === "admin" ? (
        <Link
          href="/dashboard"
          className="mx-4 mt-3 mb-1 inline-flex items-center gap-2 px-3 py-2 rounded-[7px] text-[12.5px] text-navy-200 hover:bg-ink-800 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
          Voltar ao app
        </Link>
      ) : null}

      {/* Nav */}
      <nav className="flex-1 px-4 pt-3 overflow-y-auto">
        {(Object.keys(grouped) as string[]).map((g) => (
          <div key={g} className="mb-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-ink-600 px-3 mt-4 mb-2 font-medium">
              {groupLabels[g] ?? g}
            </div>
            {grouped[g].map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  item.href !== "/admin" &&
                  pathname.startsWith(item.href)) ||
                (item.href === "/admin" && pathname === "/admin");
              const badgeCount = badgeByHref[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2.5 py-2 rounded-[7px] mb-0.5 transition-colors",
                    item.sub ? "pl-9 pr-3 text-[12.5px]" : "px-3 text-[13.5px]",
                    isActive
                      ? variant === "admin"
                        ? "bg-gold-600/15 text-gold-600 font-medium"
                        : "bg-ink-800 text-white font-medium"
                      : item.sub
                        ? "text-navy-300 hover:bg-ink-800 hover:text-white"
                        : "text-navy-200 hover:bg-ink-800 hover:text-white",
                  )}
                >
                  {isActive ? (
                    <span
                      className={cn(
                        "absolute left-0 top-2 bottom-2 w-[2px] rounded-full",
                        variant === "admin" ? "bg-gold-600" : "bg-gold-600",
                      )}
                    />
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
                        badgeIsReminderByHref[item.href]
                          ? "bg-rust-600 text-white"
                          : item.href === "/metas"
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

      {/* Entrada do admin — só visível no modo "main" */}
      {variant === "main" && isPlatformAdmin ? (
        <div className="border-t border-ink-800 px-4 pt-3 pb-1">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13px] transition-colors text-gold-600/80 hover:bg-ink-800 hover:text-gold-600"
          >
            <Shield className="w-[15px] h-[15px]" strokeWidth={1.7} />
            <span className="flex-1">Superadmin</span>
          </Link>
        </div>
      ) : null}

      {/* User + theme + live ticker */}
      <div className="border-t border-ink-800 px-4 py-3 space-y-2">
        {variant === "main" ? <SidebarLiveTicker /> : null}
        <div className="flex items-center justify-between px-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600 font-medium">
            Modo
          </span>
          <div className="flex items-center gap-1">
            {notificationBell}
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
    </motion.div>
  );
}
