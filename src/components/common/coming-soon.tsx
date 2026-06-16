import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";

/** Estado vazio intencional e discreto — ícone fino + 1 linha (sem card pesado). */
export function ComingSoon() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center py-16 lg:py-20">
      <Compass size={26} strokeWidth={1.4} className="text-faint" />
      <span className="eyebrow mt-5">{t("common.comingSoon")}</span>
      <p className="text-[13.5px] text-muted mt-2 max-w-sm leading-relaxed">
        {t("common.comingSoonDesc")}
      </p>
    </div>
  );
}
