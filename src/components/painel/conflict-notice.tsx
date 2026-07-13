import { useTranslation } from "react-i18next";
import { X, GitMerge, Download } from "lucide-react";
import { useConflictNotice, getConflictBackup } from "@/vault/conflict-backup";
import { downloadFile } from "@/data/backup";

/**
 * Aviso de CONFLITO de sincronização: dois dispositivos escreveram "ao mesmo tempo" e as
 * mudanças deste aparelho que não subiram foram substituídas pelas do outro. Nada se perdeu
 * em silêncio: a cópia local pré-merge fica guardada e baixável aqui (formato de backup —
 * dá pra conferir e até re-importar em Config → Dados). Dispensar APAGA a cópia.
 */
export function ConflictNotice() {
  const { t } = useTranslation();
  const at = useConflictNotice((s) => s.at);
  const saved = useConflictNotice((s) => s.saved);
  const dismiss = useConflictNotice((s) => s.dismiss);
  if (!at) return null;

  const when = new Date(at);
  const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  const download = () => {
    const json = getConflictBackup();
    if (json) downloadFile(`nossasfinancas-conflito-${stamp}.json`, json, "application/json");
  };

  return (
    <div className="relative mb-7 rounded-[16px] border border-[#e0a33c]/35 bg-gradient-to-br from-[var(--card-2)] to-card p-4 pr-11 sm:p-5 sm:pr-12">
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-[#e0a33c]/10 blur-3xl" />
      <div className="relative flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e0a33c]/15 text-[#e0a33c]">
          <GitMerge size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold tracking-[-0.01em]">{t("conflict.title")}</div>
          {/* Sem cópia salva (storage cheio): o aviso ainda aparece — mas HONESTO, sem botão de
              download de uma cópia que não existe. */}
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t(saved ? "conflict.desc" : "conflict.descNoCopy")}</p>
          {saved ? (
            <button
              type="button"
              onClick={download}
              className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-border bg-card2 px-3 text-[12px] font-medium text-text transition-colors hover:border-border-strong outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Download size={13} />
              {t("conflict.download")}
            </button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.close")}
        title={t("conflict.dismissHint")}
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-[8px] text-faint transition-colors hover:bg-card-hover hover:text-text"
      >
        <X size={15} />
      </button>
    </div>
  );
}
