import { useTranslation } from "react-i18next";
import { Tile } from "./tile";

/** Teaser "em breve" — usado nas seções de módulos ainda não construídos. */
export function ComingSoon() {
  const { t } = useTranslation();
  return (
    <Tile className="p-8 lg:p-10">
      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
        {t("common.comingSoon")}
      </span>
      <p className="text-[15px] text-muted mt-3 max-w-lg leading-relaxed">
        {t("common.comingSoonDesc")}
      </p>
    </Tile>
  );
}
