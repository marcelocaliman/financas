import { useTranslation } from "react-i18next";
import { Panel } from "./panel";

/** Placeholder de módulo ainda não construído (será feito sobre os dados locais). */
export function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Panel className="p-10 text-center">
      <div className="text-[15px] font-semibold">{t(titleKey)}</div>
      <div className="text-[13px] text-muted mt-2 max-w-md mx-auto">
        <span className="font-medium text-teal">{t("common.comingSoon")}</span>
        {" · "}
        {t("common.comingSoonDesc")}
      </div>
    </Panel>
  );
}
