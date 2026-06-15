import { useTranslation } from "react-i18next";
import { useUI, type Theme } from "@/store/ui";
import { SUPPORTED_LANGS } from "@/i18n";
import { Panel } from "@/components/common/panel";
import { cn } from "@/lib/utils";

const THEMES: Theme[] = ["light", "dark"];

export default function Config() {
  const { t, i18n } = useTranslation();
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);

  return (
    <div className="space-y-5 max-w-md">
      <Panel className="p-6 space-y-5">
        <section>
          <div className="text-[15px] font-semibold mb-2">{t("common.theme")}</div>
          <div className="flex gap-2">
            {THEMES.map((opt) => (
              <Pill key={opt} active={theme === opt} onClick={() => setTheme(opt)}>
                {opt === "light" ? t("common.themeLight") : t("common.themeDark")}
              </Pill>
            ))}
          </div>
        </section>

        <section>
          <div className="text-[15px] font-semibold mb-2">{t("common.language")}</div>
          <div className="flex gap-2">
            {SUPPORTED_LANGS.map((lng) => (
              <Pill
                key={lng}
                active={i18n.resolvedLanguage === lng}
                onClick={() => void i18n.changeLanguage(lng)}
              >
                <span className="uppercase">{lng}</span>
              </Pill>
            ))}
          </div>
        </section>
      </Panel>

      <Panel className="p-6 text-[12px] text-faint">{t("common.sampleData")}</Panel>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
        active
          ? "bg-teal text-white border-teal"
          : "border-border text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
