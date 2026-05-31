"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RotateCw } from "lucide-react";

/**
 * Fallback de erro compartilhado pelos error boundaries (error.tsx por route
 * group + global-error.tsx). Reporta ao Sentry no mount (no-op sem DSN) e
 * oferece "tentar de novo" via reset(). Nunca mostra stack/detalhe ao usuário.
 */
export function ErrorFallback({
  error,
  reset,
  scope,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Identifica de qual área veio o erro (ex.: "app", "auth", "contador"). */
  scope?: string;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: scope ? { boundary: scope } : undefined });
  }, [error, scope]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-rust-600 dark:text-rust-500">
          Algo deu errado
        </div>
        <h1 className="font-display text-[26px] tracking-[-0.02em] text-foreground mt-3">
          Tivemos um problema ao carregar isto
        </h1>
        <p className="text-[13.5px] text-muted-foreground mt-2 leading-relaxed">
          O erro foi registrado e já estamos de olho. Você pode tentar de novo —
          seus dados estão a salvo.
        </p>
        {error.digest ? (
          <p className="font-mono text-[10.5px] text-faint-foreground mt-3">
            ref: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-navy-700 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-navy-800 transition-colors"
        >
          <RotateCw className="w-4 h-4" strokeWidth={1.8} />
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
