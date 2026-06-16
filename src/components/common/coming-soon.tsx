import { useTranslation } from "react-i18next";

/** "Em breve" COMPACTO — tile de borda tracejada (nunca um vazio de tela cheia). */
export function ComingSoon() {
  const { t } = useTranslation();
  return (
    <div className="rounded-[16px] border border-dashed border-border-strong p-5 max-w-md">
      <div className="eyebrow">{t("common.comingSoon")}</div>
      <p className="text-[12.5px] text-faint mt-2 leading-relaxed">{t("common.comingSoonDesc")}</p>
    </div>
  );
}
