"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hubForPath } from "./nav-items";
import { cn } from "@/lib/utils/cn";

/**
 * Abas internas do hub atual (rearquitetura em 6 hubs). Renderizada uma vez no
 * layout — detecta o hub pela rota e mostra as abas pra navegar entre as páginas
 * irmãs sem voltar ao menu. Some em hubs de 1 página só (ex.: Início).
 */
export function HubTabs() {
  const pathname = usePathname();
  const hub = hubForPath(pathname);
  if (!hub || hub.tabs.length < 2) return null;

  return (
    <nav
      aria-label={`Seções de ${hub.label}`}
      className="mb-5 -mt-1 overflow-x-auto"
    >
      <ul className="flex items-center gap-1 min-w-max border-b border-border">
        {hub.tabs.map((t) => {
          const Icon = t.icon;
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors whitespace-nowrap",
                  active
                    ? "border-navy-700 text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.7} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
