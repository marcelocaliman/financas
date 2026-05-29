"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { SystemAlertRow } from "@/services/system-alerts";
import { acknowledgeUserAlertAction } from "@/app/(app)/_actions/system-alerts";

export function NotificationBellClient({
  alerts,
  tone = "dark",
}: {
  alerts: SystemAlertRow[];
  tone?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const count = alerts.length;
  const hasUnack = count > 0;

  const handleAck = (id: string) => {
    startTransition(async () => {
      const r = await acknowledgeUserAlertAction(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <TooltipRoot delayDuration={150}>
        <TooltipTrigger asChild>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={`Notificações ${hasUnack ? `(${count} pendentes)` : ""}`}
              className={cn(
                "relative inline-flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors",
                tone === "dark"
                  ? "text-ink-400 hover:text-white hover:bg-ink-800"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-muted",
              )}
            >
              <Bell className="w-[15px] h-[15px]" strokeWidth={1.8} />
              {hasUnack ? (
                <span
                  className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rust-600 text-white text-[9px] font-mono font-semibold flex items-center justify-center tabular-nums"
                  aria-hidden
                >
                  {count > 9 ? "9+" : count}
                </span>
              ) : null}
            </button>
          </Popover.Trigger>
        </TooltipTrigger>
        <TooltipContent>
          {hasUnack ? `${count} notificaç${count === 1 ? "ão" : "ões"} pendente${count === 1 ? "" : "s"}` : "Notificações"}
        </TooltipContent>
      </TooltipRoot>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="w-[340px] max-w-[90vw] rounded-[10px] border border-border bg-surface shadow-xl z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium">
              Notificações
            </div>
            <Popover.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="text-faint-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </Popover.Close>
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-6 h-6 text-faint-foreground mx-auto mb-2 opacity-50" strokeWidth={1.5} />
              <p className="text-[12.5px] text-muted-foreground">Sem novidades por aqui.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
                        a.severity === "error"
                          ? "bg-rust-600"
                          : a.severity === "warning"
                            ? "bg-gold-600"
                            : "bg-navy-700",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-foreground leading-snug">
                        {a.user_message ?? a.message}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-mono text-[10px] text-faint-foreground tabular-nums">
                          {formatRelative(a.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAck(a.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.06em] text-navy-700 dark:text-navy-300 hover:text-foreground disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" strokeWidth={2} />
                          ok
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "agora";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m atrás`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h atrás`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
