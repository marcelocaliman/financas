import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUI, type Theme } from "@/store/ui";
import { SUPPORTED_LANGS } from "@/i18n";
import { actions } from "@/data/actions";
import { Panel } from "@/components/common/panel";
import { Button } from "@/components/common/button";
import { Dialog } from "@/components/common/dialog";
import {
  AccountCard,
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
    <div>
      {/* Abas horizontais (underline) */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              "relative px-4 py-3 text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors",
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
      <div className="pt-8">
        {tab === "conta" && (
          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <AccountCard />
            <DangerZone />
          </div>
        )}
        {tab === "seguranca" && (
          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <ChangePassword />
            <NewRecoveryCode />
          </div>
        )}
        {tab === "aparencia" && (
          <div className="max-w-2xl">
            <Appearance />
          </div>
        )}
        {tab === "dados" && (
          <div className="max-w-2xl">
            <DataSection />
          </div>
        )}
        {tab === "privacidade" && (
          <div className="max-w-3xl">
            <PrivacySection />
          </div>
        )}
      </div>
    </div>
  );
}

function Appearance() {
  const { t, i18n } = useTranslation();
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  return (
    <Panel className="p-6">
      <div className="grid sm:grid-cols-2 gap-6">
        <section>
          <div className="text-[15px] font-semibold mb-2.5">{t("common.theme")}</div>
          <div className="flex gap-2">
            {THEMES.map((opt) => (
              <Pill key={opt} active={theme === opt} onClick={() => setTheme(opt)}>
                {opt === "light" ? t("common.themeLight") : t("common.themeDark")}
              </Pill>
            ))}
          </div>
        </section>
        <section>
          <div className="text-[15px] font-semibold mb-2.5">{t("common.language")}</div>
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
    </Panel>
  );
}

function PrivacySection() {
  return (
    <Panel className="p-6 space-y-3">
      <div className="text-[15px] font-semibold">Privacidade</div>
      <PrivacyPolicyContent />
      <PrivacyLink className="text-accent font-medium hover:underline text-[13px]" />
    </Panel>
  );
}

function DataSection() {
  const { t } = useTranslation();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Panel className="p-6 space-y-5">
      <div className="text-[15px] font-semibold">{t("data.title")}</div>

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
    </Panel>
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
