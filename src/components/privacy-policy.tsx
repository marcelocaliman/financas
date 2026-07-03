import { useTranslation } from "react-i18next";

/**
 * Link para a Política de Privacidade — abre a PÁGINA PÚBLICA canônica (public/privacidade.html ou
 * /privacy em inglês) numa nova aba, no idioma atual do app. O texto legal vive só nessas páginas
 * (fonte única, bilíngue); o app não duplica mais o conteúdo em diálogo.
 */
export function PrivacyLink({ className, label }: { className?: string; label?: string }) {
  const { i18n } = useTranslation();
  const en = (i18n.resolvedLanguage ?? i18n.language ?? "pt").startsWith("en");
  return (
    <a
      href={en ? "/privacy" : "/privacidade"}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "text-muted hover:text-text underline"}
    >
      {label ?? (en ? "Privacy Policy" : "Política de Privacidade")}
    </a>
  );
}
