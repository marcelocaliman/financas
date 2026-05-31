"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Wallet, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useQuickAdd } from "@/components/transactions/quick-add-context";

// 3 destinos fixos + FAB dominante (auditoria UX). O resto vive no drawer
// (hambúrguer). Lançar é a ação primária — fica no centro, em destaque.
const navItems = [
  { label: "Início", href: "/dashboard", icon: Home },
  { label: "Transações", href: "/transacoes", icon: ArrowLeftRight },
  { label: "Carteira", href: "/investimentos", icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();
  const { show } = useQuickAdd();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {navItems.slice(0, 2).map((it) => {
          const Icon = it.icon;
          const isActive =
            pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium tracking-tight",
                  isActive ? "text-foreground" : "text-faint-foreground",
                )}
              >
                <Icon
                  className={cn("w-[18px] h-[18px]", isActive ? "opacity-100" : "opacity-65")}
                  strokeWidth={1.6}
                />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => show("expense")}
            className="w-full flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium tracking-tight text-foreground"
          >
            <span className="-mt-5 grid place-items-center w-11 h-11 rounded-full bg-ink-950 text-white shadow-md">
              <Plus className="w-5 h-5" strokeWidth={1.6} />
            </span>
            <span className="mt-0.5">Adicionar</span>
          </button>
        </li>
        {navItems.slice(2).map((it) => {
          const Icon = it.icon;
          const isActive =
            pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium tracking-tight",
                  isActive ? "text-foreground" : "text-faint-foreground",
                )}
              >
                <Icon
                  className={cn("w-[18px] h-[18px]", isActive ? "opacity-100" : "opacity-65")}
                  strokeWidth={1.6}
                />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
