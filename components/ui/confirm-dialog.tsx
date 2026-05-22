"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * ConfirmDialog — substitui `window.confirm()` por algo coerente com
 * o design system. Suporta dois modos:
 *
 *  1. Imperativo (via hook `useConfirm`):
 *
 *     const confirm = useConfirm();
 *     if (await confirm({ title, description, destructive: true })) {
 *       // user clicked confirm
 *     }
 *
 *  2. Controlado (component direto), pra casos onde já existe estado.
 */

type ConfirmOptions = {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  eyebrow?: React.ReactNode;
};

type ConfirmContext = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = React.createContext<ConfirmContext | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback<ConfirmContext>((next) => {
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    setOpts(null);
    resolverRef.current?.(value);
    resolverRef.current = null;
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog
        open={opts != null}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <DialogContent className="!w-[min(440px,calc(100vw-32px))]">
          {opts ? (
            <>
              <DialogHeader
                eyebrow={opts.eyebrow}
                title={opts.title}
                description={opts.description}
              />
              <DialogFooter className="!mt-2 !pt-0 !border-0">
                <Button variant="outline" onClick={() => close(false)}>
                  {opts.cancelLabel ?? "Cancelar"}
                </Button>
                <Button
                  variant={opts.destructive ? "danger" : "primary"}
                  onClick={() => close(true)}
                  autoFocus
                >
                  {opts.confirmLabel ?? "Confirmar"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

/**
 * Hook imperativo — retorna uma função `confirm(opts)` que abre o diálogo
 * e devolve `true`/`false` quando o usuário responder. Substitui o
 * `window.confirm()` nativo sem mudar o fluxo do código (basta `await`).
 *
 * Fora do provider, faz fallback pro confirm nativo (defensive — não deve
 * acontecer em runtime mas evita crash em testes/storybook).
 */
export function useConfirm(): ConfirmContext {
  const ctx = React.useContext(Ctx);
  if (ctx) return ctx;
  return async (opts) =>
    typeof window === "undefined"
      ? false
      : window.confirm(
          typeof opts.title === "string"
            ? opts.title
            : "Confirma essa ação?",
        );
}
