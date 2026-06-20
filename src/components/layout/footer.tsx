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
            <a
              href="https://discord.gg/J3yzjQVw3v"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-[13px] text-muted hover:text-text transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
              {t("footer.community")}
            </a>
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
