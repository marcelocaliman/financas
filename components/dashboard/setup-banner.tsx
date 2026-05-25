"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, Settings, Circle } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import type { SetupStatus } from "@/services/setup-status";

const STORAGE_KEY = "dashboard:setup-banner-dismissed";

export function SetupBanner({ status }: { status: SetupStatus }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  // Tudo configurado OU usuário dispensou → não mostra
  if (status.pct >= 1 || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  };

  const pendingItems = status.items.filter((i) => !i.done);

  return (
    <Panel className="mb-5 border-navy-700/40 bg-navy-100/30 dark:bg-navy-700/10">
      <div className="flex items-start gap-3">
        <Settings className="w-5 h-5 text-navy-700 dark:text-navy-300 shrink-0 mt-0.5" strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-1">
                Configure seu app — {status.done}/{status.total} feito ({Math.round(status.pct * 100)}%)
              </div>
              <p className="text-[13px] text-foreground leading-snug">
                {pendingItems.length === 1
                  ? `Falta 1 passo pro app ficar redondo:`
                  : `Faltam ${pendingItems.length} passos pro app trabalhar 100% por você:`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.7} />
                    Esconder
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.7} />
                    Ver lista
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-[11px] text-faint-foreground hover:text-foreground"
              >
                Dispensar
              </button>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-3 h-1.5 rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full bg-navy-700 dark:bg-navy-300 transition-all"
              style={{ width: `${status.pct * 100}%` }}
            />
          </div>

          {expanded ? (
            <ul className="mt-4 space-y-1.5">
              {status.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {item.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-olive-700 dark:text-olive-500 shrink-0" strokeWidth={2} />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-faint-foreground shrink-0" strokeWidth={1.7} />
                    )}
                    <span
                      className={`text-[12.5px] truncate ${
                        item.done
                          ? "text-faint-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {!item.done ? (
                    <Link
                      href={item.href}
                      className="text-[11px] text-navy-700 dark:text-navy-300 hover:underline shrink-0"
                    >
                      {item.cta ?? "Configurar"} →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
