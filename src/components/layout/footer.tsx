import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Rodapé ENXUTO do app: só copyright + selo cifrado. O rodapé editorial (navegação, links legais e
 * comunidade) foi removido da área logada pra não poluir — os links legais vivem em Configurações →
 * Privacidade e na tela de cadastro; a comunidade (Discord) fica na landing.
 */
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="hidden sm:block border-t border-border">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-faint">
          <span>© 2026 {t("app.name")} · {t("footer.rights")}</span>
          <span className="eyebrow inline-flex items-center gap-1.5">
            <Lock size={12} />
            {t("footer.encrypted")}
          </span>
        </div>
      </div>
    </footer>
  );
}
