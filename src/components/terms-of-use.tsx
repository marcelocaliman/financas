import { useTranslation } from "react-i18next";

/**
 * Link para os Termos de Serviço — abre a PÁGINA PÚBLICA canônica (public/termos.html ou /terms em
 * inglês) numa nova aba, no idioma atual do app. O texto legal vive só nessas páginas (fonte única,
 * bilíngue); o app não duplica mais o conteúdo em diálogo.
 */
export function TermsLink({ className, label }: { className?: string; label?: string }) {
  const { i18n } = useTranslation();
  const en = (i18n.resolvedLanguage ?? i18n.language ?? "pt").startsWith("en");
  return (
    <a
      href={en ? "/terms" : "/termos"}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "text-muted hover:text-text underline"}
    >
      {label ?? (en ? "Terms of Service" : "Termos de Uso")}
    </a>
  );
}
