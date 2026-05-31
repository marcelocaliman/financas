"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { grantConsent } from "@/services/lgpd.actions";

/**
 * Banner que aparece quando o usuário ainda não aceitou as versões atuais
 * de Termos + Privacidade. Bloqueia uso de novas features até aceitar.
 *
 * Renderizado pelo layout autenticado quando hasAcceptedCurrentTerms() = false.
 */
export function ConsentBanner({
  termsVersion,
  privacyVersion,
}: {
  termsVersion: string;
  privacyVersion: string;
}) {
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  const handleAccept = () => {
    startTransition(async () => {
      await Promise.all([
        grantConsent("terms_of_service", termsVersion),
        grantConsent("privacy_policy", privacyVersion),
      ]);
      setDismissed(true);
      // soft reload pra atualizar estado em layouts SSR
      window.location.reload();
    });
  };

  if (dismissed) return null;

  return (
    <>
      {/* Overlay modal — BLOQUEIA interação com a página até aceitar (gate real,
          não cosmético). Os links de termos abrem em nova aba. */}
      <div
        aria-hidden
        className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-md pointer-events-auto"
      />
      <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 pointer-events-none">
        <div className="max-w-[760px] mx-auto rounded-[var(--radius-lg)] bg-ink-950 text-white border border-ink-700 shadow-2xl p-5 sm:p-6 pointer-events-auto">
        <div className="flex items-start gap-3 mb-3">
          <Shield className="w-5 h-5 text-gold-600 shrink-0 mt-0.5" strokeWidth={1.7} />
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-navy-400 font-medium">
              Aceite obrigatório · LGPD
            </div>
            <h3 className="font-display text-[18px] tracking-[-0.015em] mt-1 text-white">
              Atualizamos nossos termos
            </h3>
          </div>
        </div>
        <p className="text-[13px] text-navy-200 leading-relaxed mb-4">
          Pra continuar usando o Finanças, aceite os{" "}
          <Link href="/termos" className="text-gold-600 hover:underline" target="_blank">
            Termos de Uso (v{termsVersion})
          </Link>{" "}
          e a{" "}
          <Link
            href="/privacidade"
            className="text-gold-600 hover:underline"
            target="_blank"
          >
            Política de Privacidade (v{privacyVersion})
          </Link>
          . Vc pode ler antes de aceitar — abre em nova aba.
        </p>
          <Button variant="primary" disabled={pending} onClick={handleAccept}>
            {pending ? "Registrando…" : "Li e aceito os termos"}
          </Button>
        </div>
      </div>
    </>
  );
}
