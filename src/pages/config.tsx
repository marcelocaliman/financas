import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { User, ShieldCheck, Tags, Palette, Database, Lock } from "lucide-react";
import { useUI, type Theme } from "@/store/ui";
import { useMainCurrency } from "@/hooks/use-main-currency";
import { CURRENCIES, CURRENCY_SYMBOL } from "@/money/currency";
import { SUPPORTED_LANGS } from "@/i18n";
import { actions } from "@/data/actions";
import { exportBackupJSON, importBackupJSON, exportCSV } from "@/data/backup";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
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
  { id: "conta", label: "Conta", icon: User },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "dados", label: "Dados", icon: Database },
  { id: "privacidade", label: "Privacidade", icon: Lock },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Config() {
  const [tab, setTab] = useState<TabId>("conta");

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">
      {/* Nav: tabs horizontais (mobile) / sidebar vertical (desktop) */}
      <nav className="shrink-0 flex sm:flex-col gap-1 sm:gap-0.5 overflow-x-auto no-scrollbar border-b border-border sm:border-b-0 sm:border-r px-3 py-2 sm:py-4 sm:w-[208px]">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={cn(
                "flex items-center gap-2.5 shrink-0 rounded-[9px] px-3 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors",
                active ? "bg-card2 text-text" : "text-muted hover:text-text hover:bg-card-hover",
              )}
            >
              <Icon size={16} className={active ? "text-accent" : "text-faint"} />
              {tb.label}
            </button>
          );
        })}
      </nav>

      {/* Conteúdo (rola independente da sidebar) */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-subtle px-5 sm:px-7 py-6">
        {tab === "conta" && (
          <div className="max-w-xl space-y-5">
            <Card>
              <AccountSection />
            </Card>
            <DangerZone />
          </div>
        )}
        {tab === "seguranca" && (
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl items-start">
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
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[14px] border border-border bg-card p-5", className)}>{children}</div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-semibold mb-3">{children}</div>;
}

function Appearance() {
  const { t, i18n } = useTranslation();
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const { baseCurrency, setMainCurrency } = useMainCurrency();
  return (
    <div className="max-w-2xl space-y-5">
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
  const { t } = useTranslation();
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
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
