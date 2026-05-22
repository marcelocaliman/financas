"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, LineChart, Wallet, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MobileNavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  accent?: boolean;
};

const items: MobileNavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Transações", href: "/transacoes", icon: ArrowLeftRight },
  { label: "Adicionar", href: "/transacoes/nova", icon: Plus, accent: true },
  { label: "Análise", href: "/analise", icon: LineChart },
  { label: "Carteira", href: "/investimentos", icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive =
            pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium tracking-tight",
                  it.accent
                    ? "text-foreground"
                    : isActive
                      ? "text-foreground"
                      : "text-faint-foreground",
                )}
              >
                {it.accent ? (
                  <span className="-mt-5 grid place-items-center w-11 h-11 rounded-full bg-ink-950 text-white shadow-md">
                    <Icon className="w-5 h-5" strokeWidth={1.6} />
                  </span>
                ) : (
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px]",
                      isActive ? "opacity-100" : "opacity-65",
                    )}
                    strokeWidth={1.6}
                  />
                )}
                <span className={it.accent ? "mt-0.5" : ""}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
