import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/common/logo";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { scrollToSection, goToSection } from "@/hooks/use-scroll-spy";
import { PrivacyLink } from "@/components/privacy-policy";
import { TermsLink } from "@/components/terms-of-use";
import { useViewer } from "@/store/viewer";

/** Barra inferior (copyright + selo cifrado) — reusada no footer cheio e no enxuto do viewer. */
function BottomBar() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-faint">
      <span>© 2026 {t("app.name")} · {t("footer.rights")}</span>
      <span className="eyebrow inline-flex items-center gap-1.5">
        <Lock size={12} />
        {t("footer.encrypted")}
      </span>
    </div>
  );
}

/** Footer editorial do app (página única). */
export function Footer() {
  const { t } = useTranslation();
  const viewerMode = useViewer((s) => s.viewerMode);

  // Painel compartilhado (só-leitura): footer enxuto — só a barra inferior, sem navegação/links.
  if (viewerMode) {
    return (
      <footer className="border-t border-border">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-8">
          <BottomBar />
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          <div className="col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => scrollToSection(NAV_ITEMS[0].id)}
              className="flex items-center gap-2.5"
            >
              <Logo size={28} />
              <span className="font-semibold text-[15.5px] tracking-[-0.02em]">
                {t("app.name")}
              </span>
            </button>
            <p className="text-[12.5px] text-muted mt-3.5 max-w-[230px] leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          <FooterCol title={t("footer.sections")} items={NAV_ITEMS.slice(0, 4)} label={(k) => t(`nav.${k}`)} />
          <FooterCol title={t("footer.more")} items={NAV_ITEMS.slice(4)} label={(k) => t(`nav.${k}`)} />

          <div>
            <div className="eyebrow mb-3.5">{t("footer.privacy")}</div>
            <PrivacyLink className="block text-[13px] text-muted hover:text-text transition-colors mb-2.5 text-left" />
            <TermsLink className="block text-[13px] text-muted hover:text-text transition-colors mb-2.5 text-left" />
            <span className="block text-[13px] text-muted">{t("footer.noTracking")}</span>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border">
          <BottomBar />
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
  label,
}: {
  title: string;
  items: NavItem[];
  label: (key: string) => string;
}) {
  return (
    <div>
      <div className="eyebrow mb-3.5">{title}</div>
      <ul className="space-y-2.5">
        {items.map(({ id, key }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => goToSection(id)}
              className="text-[13px] text-muted hover:text-text transition-colors"
            >
              {label(key)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
