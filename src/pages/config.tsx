import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
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
import { FamilyAccess } from "@/components/config/family-access";
import { LiberdadeSettings } from "@/components/config/liberdade-settings";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { countShares } from "@/lib/shares";
import { PrivacyLink, PrivacyPolicyContent } from "@/components/privacy-policy";
import { TermsLink } from "@/components/terms-of-use";
import { Accordion } from "@/components/common/accordion";
import { BillingSection, BillingSummary } from "@/components/config/billing-section";
import { CONFIG_NAV_ITEMS } from "@/components/layout/nav-items";
import { useSections } from "@/store/sections";
import { useVault } from "@/vault/vault-store";
import { cn } from "@/lib/utils";

const THEMES: Theme[] = ["light", "dark"];

const GUTTERS = "px-5 md:px-10 lg:px-14";
const CONTAINER = "max-w-[1280px] mx-auto";

/** Configurações como CONTEÚDO PRINCIPAL — mesma linguagem editorial da página inicial:
 *  faixa de cabeçalho (eyebrow mono + manchete) + seções em accordions idênticos aos da home
 *  (mesmos gutters, mesmas fontes, mesmos divisores). Entra no lugar da página (não é modal). */
export default function Config({ onClose }: { onClose?: () => void }) {
  const { t, i18n } = useTranslation();
  const email = useVault((s) => s.email);
  const theme = useUI((s) => s.theme);
  const navLayout = useUI((s) => s.navLayout);
  const configOpen = useUI((s) => s.configOpen);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Ao ENTRAR na Config, todas as abas começam fechadas (o usuário escolhe o que abrir).
  useEffect(() => {
    if (configOpen) useSections.getState().setMany(CONFIG_NAV_ITEMS.map((c) => c.id), false);
  }, [configOpen]);

  const themeLabel = theme === "dark" ? t("common.themeDark") : t("common.themeLight");
  const layoutLabel = navLayout === "side" ? t("menu.side") : t("menu.top");
  const langLabel = (i18n.resolvedLanguage ?? "pt").toUpperCase();

  // KPIs das abas (mesma vibe dos KPIs do painel): contagens reais + descritores curtos.
  const tax = useTaxonomy();
  const { data: dash } = useDashboardData();
  const [shareCount, setShareCount] = useState<number | null>(null);
  useEffect(() => {
    if (!configOpen) return;
    let alive = true;
    void countShares().then((n) => { if (alive) setShareCount(n); }).catch(() => undefined);
    return () => { alive = false; };
  }, [configOpen]);

  const catCount = tax.expenseCategories.length + tax.incomeCategories.length;
  const entryCount = dash
    ? dash.assets.length + dash.liabilities.length + dash.expenses.length + dash.incomes.length + dash.snapshots.length
    : null;

  return (
    <div>
      {/* Cabeçalho — mesma faixa/gutters/topo do HERO da página inicial */}
      <section className="scroll-mt-20">
        <div className={cn(CONTAINER, GUTTERS, "pt-[108px] pb-12")}>
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent mb-4">
              {t("config.eyebrow")}
            </div>
            <h1 className="font-semibold text-[clamp(2.4rem,5vw,3.6rem)] tracking-[-0.04em] leading-[1.04]">
              {t("menu.settings")}
            </h1>
            <p className="mt-4 text-muted text-[14.5px] leading-relaxed max-w-[560px]">{t("config.subtitle")}</p>
          </div>
        </div>
        <div className="border-t border-border" />
      </section>

      {/* Seções — mesmos accordions/gutters/fontes da página inicial */}
      <div className={cn(CONTAINER, GUTTERS, "pb-20 lg:pb-28")}>
        <Accordion id="cfg-account" title={t("config.account")} summary={<CfgPreview>{email}</CfgPreview>}>
          <div className="grid gap-5 sm:grid-cols-2 items-start">
            <Card>
              <AccountSection />
            </Card>
            <DangerZone />
          </div>
        </Accordion>

        <Accordion id="cfg-billing" title={t("billing.title")} summary={<CfgPreview><BillingSummary /></CfgPreview>}>
          <BillingSection />
        </Accordion>

        <Accordion id="cfg-security" title={t("config.security")} summary={<CfgPreview>{t("config.kpiSecurity")}</CfgPreview>}>
          <div className="grid sm:grid-cols-2 gap-5 items-start">
            <Card>
              <ChangePassword />
            </Card>
            <Card>
              <NewRecoveryCode />
            </Card>
          </div>
        </Accordion>

        <Accordion
          id="cfg-family"
          title={t("config.family")}
          summary={<CfgPreview>{shareCount == null ? "" : `${t("config.kpiAccesses")}: ${shareCount}`}</CfgPreview>}
        >
          <FamilyAccess />
        </Accordion>

        <Accordion
          id="cfg-categories"
          title={t("config.categories")}
          summary={<CfgPreview>{`${t("config.categories")}: ${catCount}`}</CfgPreview>}
        >
          <TaxonomyEditor />
        </Accordion>

        <Accordion id="cfg-appearance" title={t("config.appearance")} summary={<CfgPreview>{`${themeLabel} · ${layoutLabel} · ${langLabel}`}</CfgPreview>}>
          <Appearance />
        </Accordion>

        <Accordion id="cfg-liberdade" title={t("config.liberdade")} summary={<CfgPreview>{t("config.kpiLiberdade")}</CfgPreview>}>
          <LiberdadeSettings />
        </Accordion>

        <Accordion
          id="cfg-data"
          title={t("data.title")}
          summary={<CfgPreview>{entryCount == null ? "" : `${t("config.kpiEntries")}: ${entryCount}`}</CfgPreview>}
        >
          <DataSection />
        </Accordion>

        <Accordion id="cfg-privacy" title={t("config.privacy")} summary={<CfgPreview>{t("config.kpiPrivacy")}</CfgPreview>}>
          <div className="max-w-2xl">
            <PrivacyPolicyContent />
            <div className="mt-5 flex flex-wrap gap-4">
              <PrivacyLink className="text-accent font-medium hover:underline text-[13px]" />
              <TermsLink className="text-accent font-medium hover:underline text-[13px]" />
            </div>
          </div>
        </Accordion>
      </div>
    </div>
  );
}

/** Prévia discreta no cabeçalho da seção (mesma vibe dos KPIs da home), oculta no mobile. */
function CfgPreview({ children }: { children: ReactNode }) {
  return (
    <span className="hidden md:block max-w-[260px] truncate text-[12.5px] text-muted tabular">{children}</span>
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
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">
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
    <div className="space-y-5">
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

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">
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
              <span className="text-[13px] font-medium capitalize min-w-[92px] text-center tabular">{reportMonthLabel(reportMonth, lang)}</span>
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
