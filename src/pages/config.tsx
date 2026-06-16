import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUI, type Theme } from "@/store/ui";
import { SUPPORTED_LANGS } from "@/i18n";
import { actions } from "@/data/actions";
import { Panel } from "@/components/common/panel";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
import {
  AccountSection,
  ChangePassword,
  NewRecoveryCode,
  DangerZone,
} from "@/components/auth/account-settings";
import { PrivacyLink, PrivacyPolicyContent } from "@/components/privacy-policy";
import { cn } from "@/lib/utils";

const THEMES: Theme[] = ["light", "dark"];

const TABS = [
  { id: "conta", label: "Conta" },
  { id: "seguranca", label: "Segurança" },
  { id: "aparencia", label: "Aparência" },
  { id: "dados", label: "Dados" },
  { id: "privacidade", label: "Privacidade" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Config() {
  const [tab, setTab] = useState<TabId>("conta");

  return (
    <Panel className="overflow-hidden max-w-5xl">
      {/* Abas no topo do card */}
      <div className="flex border-b border-border px-3 no-scrollbar overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              "relative px-4 py-3.5 text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors",
              tab === tb.id ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {tb.label}
            {tab === tb.id ? (
              <span className="absolute left-3 right-3 -bottom-px h-[2px] rounded-full bg-accent" />
            ) : null}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div className="p-6 lg:p-8 min-h-[340px]">
        {tab === "conta" && (
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <AccountSection />
            <DangerZone />
          </div>
        )}
        {tab === "seguranca" && (
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <ChangePassword />
            <NewRecoveryCode />
          </div>
        )}
        {tab === "aparencia" && <Appearance />}
        {tab === "dados" && <DataSection />}
        {tab === "privacidade" && (
          <div className="max-w-3xl">
            <PrivacyPolicyContent />
            <div className="mt-5">
              <PrivacyLink className="text-accent font-medium hover:underline text-[13px]" />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <div className="text-[14px] font-semibold mb-3">{children}</div>;
}

function Appearance() {
  const { t, i18n } = useTranslation();
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  return (
    <div className="grid sm:grid-cols-2 gap-8 max-w-2xl">
      <section>
        <SubHeading>{t("common.theme")}</SubHeading>
        <div className="flex gap-2">
          {THEMES.map((opt) => (
            <Pill key={opt} active={theme === opt} onClick={() => setTheme(opt)}>
              {opt === "light" ? t("common.themeLight") : t("common.themeDark")}
            </Pill>
          ))}
        </div>
      </section>
      <section>
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
      </section>
    </div>
  );
}

function DataSection() {
  const { t } = useTranslation();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      <DataRow title={t("data.sample")} desc={t("data.sampleDesc")}>
        <Button variant="secondary" onClick={() => void actions.loadSample()}>
          {t("data.loadSample")}
        </Button>
      </DataRow>

      <DataRow title={t("data.reset")} desc={t("data.resetDesc")}>
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          {t("data.resetBtn")}
        </Button>
      </DataRow>

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

function DataRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{title}</div>
        <div className="text-[12px] text-muted leading-relaxed">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
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
        "px-3.5 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
        active ? "bg-accent text-[#0b0c0e] border-accent" : "border-border text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
