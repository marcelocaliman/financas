import { ArrowLeftRight, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { scrollToSection } from "@/hooks/use-scroll-spy";
import { PrivacyLink } from "@/components/privacy-policy";

/** Footer editorial do app (página única). */
export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border mt-20 lg:mt-28">
      <div className="max-w-[1560px] mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          <div className="col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => scrollToSection(NAV_ITEMS[0].id)}
              className="flex items-center gap-2.5"
            >
              <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0b0c0e]">
                <ArrowLeftRight size={16} />
              </div>
              <span className="font-display font-bold text-[16px] tracking-[-0.02em]">
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
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-faint mb-3.5">
              {t("footer.privacy")}
            </div>
            <PrivacyLink className="block text-[13px] text-muted hover:text-text transition-colors mb-2.5 text-left" />
            <span className="block text-[13px] text-muted">{t("footer.noTracking")}</span>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3 text-[12px] text-faint">
          <span>© 2026 {t("app.name")} · {t("footer.rights")}</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} />
            {t("footer.encrypted")}
          </span>
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
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-faint mb-3.5">
        {title}
      </div>
      <ul className="space-y-2.5">
        {items.map(({ id, key }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => scrollToSection(id)}
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
