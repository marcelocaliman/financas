import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { User, ShieldCheck, Tags, Palette, Database, Lock, Printer, ChevronLeft, ChevronRight, X, Settings } from "lucide-react";
import { useUI, type Theme } from "@/store/ui";
import { useMainCurrency } from "@/hooks/use-main-currency";
import { CURRENCIES, CURRENCY_SYMBOL } from "@/money/currency";
import { SUPPORTED_LANGS } from "@/i18n";
import { actions } from "@/data/actions";
import { exportBackupJSON, importBackupJSON, exportCSV } from "@/data/backup";
import { MonthlyReport, currentMonthStr, shiftReportMonth, reportMonthLabel } from "@/components/monthly-report";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
import { Eyebrow } from "@/components/common/tile";
import {
  AccountSection,
  ChangePassword,
  NewRecoveryCode,
  DangerZone,
} from "@/components/auth/account-settings";
import { TaxonomyEditor } from "@/components/config/taxonomy-editor";
import { PrivacyLink, PrivacyPolicyContent } from "@/components/privacy-policy";
import { cn } from "@/lib/utils";

const THEMES: Theme[] = ["light", "dark"];

const TABS = [
  { id: "conta", labelKey: "config.account", icon: User },
  { id: "seguranca", labelKey: "config.security", icon: ShieldCheck },
  { id: "categorias", labelKey: "config.categories", icon: Tags },
  { id: "aparencia", labelKey: "config.appearance", icon: Palette },
  { id: "dados", labelKey: "data.title", icon: Database },
  { id: "privacidade", labelKey: "config.privacy", icon: Lock },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Página de Configurações em tela cheia (renderizada pelo ConfigOverlay): cabeçalho +
 *  navegação lateral de seções + conteúdo — coerente com a UI editorial do app. */
export default function Config({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("conta");
  const active = TABS.find((x) => x.id === tab)!;

  return (
    <div className="h-full flex flex-col bg-bg text-text">
      {/* Cabeçalho */}
      <header className="shrink-0 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between gap-4 h-[62px] px-5 md:px-8">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
              <Settings size={15} strokeWidth={2.4} />
            </span>
            <span className="font-semibold text-[16px] tracking-[-0.02em] truncate">{t("menu.settings")}</span>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      </header>

      {/* Corpo: navegação de seções + conteúdo */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-subtle">
        <div className="max-w-[1120px] mx-auto px-5 md:px-8 py-8 flex flex-col lg:flex-row gap-8 lg:gap-12">
          <nav className="lg:w-[210px] shrink-0 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:sticky lg:top-8 self-start -mx-1 px-1 lg:mx-0 lg:px-0">
            {TABS.map((tb) => {
              const Icon = tb.icon;
              const on = tab === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={cn(
                    "flex items-center gap-3 shrink-0 rounded-[11px] px-3 h-10 text-[13.5px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    on ? "bg-card2 text-accent" : "text-muted hover:text-text hover:bg-card-hover",
                  )}
                >
                  <Icon size={17} className="shrink-0" />
                  {t(tb.labelKey)}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 min-w-0">
            <h2 className="text-[clamp(1.4rem,2.3vw,1.85rem)] font-semibold tracking-[-0.03em] mb-6">{t(active.labelKey)}</h2>
            {tab === "conta" && (
              <div className="max-w-xl space-y-5">
                <Card>
                  <AccountSection />
                </Card>
                <DangerZone />
              </div>
            )}
            {tab === "seguranca" && (
              <div className="grid sm:grid-cols-2 gap-5 items-start">
                <Card>
                  <ChangePassword />
                </Card>
                <Card>
                  <NewRecoveryCode />
                </Card>
              </div>
            )}
            {tab === "categorias" && <TaxonomyEditor />}
            {tab === "aparencia" && <Appearance />}
            {tab === "dados" && <DataSection />}
            {tab === "privacidade" && (
              <div className="max-w-2xl">
                <PrivacyPolicyContent />
                <div className="mt-5">
                  <PrivacyLink className="text-accent font-medium hover:underline text-[13px]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[16px] border border-border bg-card p-6", className)}>{children}</div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <Eyebrow className="mb-3">{children}</Eyebrow>;
}

function Appearance() {
  const { t, i18n } = useTranslation();
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const navLayout = useUI((s) => s.navLayout);
  const setNavLayout = useUI((s) => s.setNavLayout);
  const { baseCurrency, setMainCurrency } = useMainCurrency();
  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <SubHeading>{t("menu.position")}</SubHeading>
        <div className="flex gap-2">
          <Pill active={navLayout === "top"} onClick={() => setNavLayout("top")}>
            {t("menu.top")}
          </Pill>
          <Pill active={navLayout === "side"} onClick={() => setNavLayout("side")}>
            {t("menu.side")}
          </Pill>
        </div>
        <p className="text-[12px] text-muted leading-relaxed mt-3">{t("menu.hint")}</p>
      </Card>
      <Card>
        <SubHeading>{t("common.baseCurrency")}</SubHeading>
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map((c) => (
            <Pill key={c} active={baseCurrency === c} onClick={() => setMainCurrency(c)}>
              <span className="tabular">{CURRENCY_SYMBOL[c]}</span>
              <span className="ml-1.5">{c}</span>
            </Pill>
          ))}
        </div>
        <p className="text-[12px] text-muted leading-relaxed mt-3">{t("common.baseCurrencyHint")}</p>
      </Card>
      <div className="grid sm:grid-cols-2 gap-5">
        <Card>
          <SubHeading>{t("common.theme")}</SubHeading>
          <div className="flex gap-2">
            {THEMES.map((opt) => (
              <Pill key={opt} active={theme === opt} onClick={() => setTheme(opt)}>
                {opt === "light" ? t("common.themeLight") : t("common.themeDark")}
              </Pill>
            ))}
          </div>
        </Card>
        <Card>
          <SubHeading>{t("common.language")}</SubHeading>
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
        </Card>
      </div>
    </div>
  );
}

function DataCard({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="text-[12px] text-muted leading-relaxed mt-1">{desc}</div>
      </div>
      <div className="self-start">{children}</div>
    </Card>
  );
}

function DataSection() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt";
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reportMonth, setReportMonth] = useState(currentMonthStr());
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (f) {
      setMsg(null);
      setPendingFile(f);
    }
  };
  const doImport = async () => {
    const file = pendingFile;
    setPendingFile(null);
    if (!file) return;
    try {
      await importBackupJSON(file);
      setMsg({ kind: "ok", text: t("data.imported") });
    } catch {
      setMsg({ kind: "err", text: t("data.importError") });
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div role="status" aria-live="polite">
        {msg ? (
          <div
            className={cn(
              "rounded-[10px] border px-3.5 py-2.5 text-[12.5px]",
              msg.kind === "ok"
                ? "border-accent/30 bg-accent-soft text-text"
                : "border-red-500/30 bg-red-500/[0.06] text-red-400",
            )}
          >
            {msg.text}
          </div>
        ) : null}
      </div>

      <div className="grid sm:grid-cols-2 gap-5 items-start">
        <DataCard title={t("data.exportJson")} desc={t("data.exportJsonDesc")}>
          <Button variant="secondary" onClick={() => void exportBackupJSON()}>
            {t("data.export")}
          </Button>
        </DataCard>

        <DataCard title={t("data.importJson")} desc={t("data.importJsonDesc")}>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {t("data.import")}
          </Button>
        </DataCard>

        <DataCard title={t("data.exportCsv")} desc={t("data.exportCsvDesc")}>
          <Button variant="secondary" onClick={() => void exportCSV()}>
            {t("data.exportCsvBtn")}
          </Button>
        </DataCard>

        <DataCard title={t("report.title")} desc={t("report.desc")}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setReportMonth(shiftReportMonth(reportMonth, -1))}
                aria-label={t("orcamento.prevMonth")}
                className="grid place-items-center w-8 h-8 rounded-[8px] text-muted hover:text-text hover:bg-card-hover transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[13px] font-medium capitalize min-w-[120px] text-center tabular">{reportMonthLabel(reportMonth, lang)}</span>
              <button
                type="button"
                onClick={() => setReportMonth(shiftReportMonth(reportMonth, 1))}
                aria-label={t("orcamento.nextMonth")}
                className="grid place-items-center w-8 h-8 rounded-[8px] text-muted hover:text-text hover:bg-card-hover transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} className="mr-1.5" />
              {t("report.print")}
            </Button>
          </div>
        </DataCard>

        <DataCard title={t("data.sample")} desc={t("data.sampleDesc")}>
          <Button variant="secondary" onClick={() => void actions.loadSample()}>
            {t("data.loadSample")}
          </Button>
        </DataCard>

        <DataCard title={t("data.reset")} desc={t("data.resetDesc")}>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            {t("data.resetBtn")}
          </Button>
        </DataCard>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onPickFile}
      />

      <Dialog open={!!pendingFile} onClose={() => setPendingFile(null)} title={t("data.importJson")}>
        <p className="text-[13.5px] text-muted leading-relaxed mb-4">{t("data.importConfirm")}</p>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => void doImport()}>
            {t("data.import")}
          </Button>
          <Button variant="secondary" onClick={() => setPendingFile(null)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Dialog>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title={t("data.reset")}>
        <p className="text-[13.5px] text-muted leading-relaxed mb-4">{t("data.resetConfirm")}</p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              void actions.resetAll();
              setConfirmReset(false);
            }}
          >
            {t("data.resetBtn")}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmReset(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Dialog>

      <MonthlyReport month={reportMonth} />
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
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
        active ? "bg-accent text-[#0A0B0D] border-accent" : "border-border text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
