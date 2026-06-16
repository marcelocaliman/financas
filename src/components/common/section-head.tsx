import { useTranslation } from "react-i18next";

/** Cabeçalho de bloco editável (eyebrow mono + contagem) — usado nos módulos. */
export function SectionHead({ title, count }: { title: string; count: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-baseline justify-between mb-3 px-1">
      <h3 className="eyebrow">{title}</h3>
      <span className="text-[11.5px] text-faint tabular">
        {count} {t(count === 1 ? "patrimonio.itemOne" : "patrimonio.itemOther")}
      </span>
    </div>
  );
}
