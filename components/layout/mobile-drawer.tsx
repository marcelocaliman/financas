"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
  RefreshCw,
  FileText,
  Settings,
  Menu,
  X,
  Shield,
  Flame,
  HandCoins,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
  { label: "Assinaturas", href: "/assinaturas", icon: RefreshCw, group: "principal" },
  { label: "Análise", href: "/analise", icon: LineChart, group: "principal" },
  { label: "Relatórios", href: "/relatorios", icon: FileText, group: "principal" },
  { label: "Investimentos", href: "/investimentos", icon: Wallet, group: "investir" },
  { label: "Patrimônio", href: "/patrimonio", icon: Package, group: "investir" },
  { label: "Dívidas", href: "/dividas", icon: HandCoins, group: "investir" },
  { label: "Resgates", href: "/resgates", icon: Layers, group: "investir" },
  { label: "Metas", href: "/metas", icon: Target, group: "investir" },
  { label: "Independência", href: "/independencia", icon: Flame, group: "investir" },
  { label: "Contas", href: "/contas", icon: CreditCard, group: "config" },
  { label: "Categorias", href: "/categorias", icon: Tag, group: "config" },
  { label: "Configurações", href: "/configuracoes", icon: Settings, group: "config" },
];

const groupLabels: Record<NavItem["group"], string> = {
  principal: "Cotidiano",
  investir: "Patrimônio",
  config: "Bastidores",
};

/**
 * Drawer mobile com nav completa.
 * Aciona via botão hambúrguer fixo no topo da app (só visível abaixo de lg).
 * Replica a Sidebar do desktop em formato de side panel deslizante.
 */
export function MobileDrawer({
  user,
  householdName,
  badges,
  isPlatformAdmin = false,
}: {
  user: { name: string; email: string | null };
  householdName: string;
  badges?: SidebarBadges;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha automaticamente ao trocar de rota
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const metasReminders = badges?.metasRemindersDue ?? 0;
  const metasAchieved = badges?.metasJustAchieved ?? 0;
  const badgeByHref: Record<string, number> = {
    "/resgates": badges?.resgatesPendingSoon ?? 0,
    "/metas": metasReminders > 0 ? metasReminders : metasAchieved,
  };
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
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "lg:hidden fixed top-3 left-3 z-30 inline-flex items-center justify-center",
            "w-11 h-11 rounded-full bg-surface/90 backdrop-blur-sm border border-border shadow-sm",
            "text-foreground active:scale-95 transition-transform",
          )}
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.7} />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-0 top-0 z-50 h-full w-[min(300px,86vw)]",
            "bg-ink-950 text-navy-100 flex flex-col shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-200",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=closed]:duration-150",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Acesse todas as áreas do app
          </DialogPrimitive.Description>

          {/* Brand + close */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink-800">
            <div>
              <BrandMark tone="light" size="md" />
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-navy-400 mt-1 font-medium">
                {householdName}
              </div>
            </div>
            <DialogPrimitive.Close
              className="rounded-full p-2 text-navy-200 hover:bg-ink-800 transition-colors"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" strokeWidth={1.7} />
            </DialogPrimitive.Close>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 pt-3 overflow-y-auto">
            {(Object.keys(grouped) as Array<NavItem["group"]>).map((g) => (
              <div key={g} className="mb-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-ink-600 px-3 mt-3 mb-2 font-medium">
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
                        "relative flex items-center gap-3 px-3 py-3 rounded-[8px] text-[14.5px] mb-0.5 transition-colors",
                        isActive
                          ? "bg-ink-800 text-white font-medium"
                          : "text-navy-200 active:bg-ink-800/70",
                      )}
                    >
                      {isActive ? (
                        <span className="absolute left-0 top-2.5 bottom-2.5 w-[2px] bg-gold-600 rounded-full" />
                      ) : null}
                      <Icon
                        className={cn(
                          "w-[18px] h-[18px] shrink-0",
                          isActive ? "opacity-100" : "opacity-70",
                        )}
                        strokeWidth={1.5}
                      />
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10.5px] font-mono font-medium tabular-nums",
                            badgeIsReminderByHref[item.href]
                              ? "bg-rust-600 text-white"
                              : item.href === "/metas"
                                ? "bg-olive-600 text-white"
                                : "bg-gold-600 text-ink-950",
                          )}
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

          {/* Platform Admin */}
          {isPlatformAdmin ? (
            <div className="border-t border-ink-800 px-3 pt-3 pb-1">
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[14px] transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-gold-600/15 text-gold-600 font-medium"
                    : "text-gold-600/80 active:bg-ink-800",
                )}
              >
                <Shield className="w-[18px] h-[18px]" strokeWidth={1.7} />
                <span className="flex-1">Superadmin</span>
              </Link>
            </div>
          ) : null}

          {/* User + toggles */}
          <div className="border-t border-ink-800 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between px-3 py-1">
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
              className="flex items-center gap-3 px-3 py-2 rounded-[8px] hover:bg-ink-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-navy-700 text-navy-100 flex items-center justify-center text-[12px] font-medium">
                {initials || "·"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white text-[13px] font-medium leading-tight truncate">
                  {user.name}
                </div>
                <div className="text-ink-600 text-[11px] tracking-[0.02em] truncate">
                  {user.email ?? "—"}
                </div>
              </div>
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
