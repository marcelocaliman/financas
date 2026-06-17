import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings, LogOut, Eye, EyeOff, PanelsTopLeft } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useAppBoot } from "@/hooks/use-app-boot";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";
import { CurrencyMenu } from "@/components/layout/currency-toggle";
import { ConfigDrawer } from "@/components/config/config-drawer";
import { cn } from "@/lib/utils";
import { DashboardV2 } from "./dashboard-v2";
import Patrimonio from "@/pages/patrimonio";
import Investimentos from "@/pages/investimentos";
import Orcamento from "@/pages/orcamento";
import Historico from "@/pages/historico";
import Objetivos from "@/pages/objetivos";
import Projecao from "@/pages/projecao";
import CrossBorder from "@/pages/cross-border";

function initials(email: string | null): string {
  const h = (email ?? "").split("@")[0];
  const parts = h.split(/[._-]/).filter(Boolean);
  const s = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (s || h.slice(0, 2) || "··").toUpperCase();
}
function nameFrom(email: string | null): string {
  const h = (email ?? "").split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "—";
}

/** Páginas não-dashboard: reaproveitam os módulos atuais (herdam os tokens claros da V2). */
const PAGE: Record<string, React.ReactNode> = {
  painel: <DashboardV2 />,
  patrimonio: <Patrimonio />,
  investimentos: <Investimentos />,
  orcamento: <Orcamento />,
  historico: <Historico />,
  objetivos: <Objetivos />,
  projecao: <Projecao />,
  crossborder: <CrossBorder />,
};

/** Casca da V2: sidebar à esquerda + topbar + conteúdo. Mesmos dados/lógica da V1. */
export function AppShellV2() {
  const { t } = useTranslation();
  useAppBoot(); // mesmos efeitos de boot da V1 (cotações, snapshot, moeda principal, taxonomia)
  const [active, setActive] = useState("painel");
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const numbersHidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);
  const setConfigOpen = useUI((s) => s.setConfigOpen);
  const setUiVersion = useUI((s) => s.setUiVersion);

  // Topo da página ao trocar de seção (a V2 mostra uma seção por vez).
  useEffect(() => window.scrollTo({ top: 0 }), [active]);

  return (
    <div className="min-h-screen bg-bg text-text flex">
      {/* Sidebar */}
      <aside className="sticky top-0 h-screen shrink-0 w-[76px] lg:w-[248px] bg-bg2 border-r border-border flex flex-col py-5 px-2.5 lg:px-4">
        {/* Perfil */}
        <div className="flex items-center gap-3 px-1.5 lg:px-2 mb-7">
          <div className="grid place-items-center w-10 h-10 rounded-full bg-accent-soft text-accent font-semibold text-[14px] shrink-0">
            {initials(email)}
          </div>
          <div className="hidden lg:block min-w-0">
            <div className="text-[14px] font-semibold truncate leading-tight">{nameFrom(email)}</div>
            <div className="text-[11.5px] text-faint truncate">{email}</div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const on = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                title={t(`nav.${item.key}`)}
                className={cn(
                  "flex items-center gap-3 rounded-[12px] px-2.5 lg:px-3 h-11 text-[13.5px] font-medium transition-colors justify-center lg:justify-start",
                  on ? "bg-accent-soft text-accent" : "text-muted hover:text-text hover:bg-card-hover",
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span className="hidden lg:inline truncate">{t(`nav.${item.key}`)}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-5 border-t border-border flex flex-col gap-1">
          <SideBtn icon={Settings} label={t("nav.config")} onClick={() => setConfigOpen(true)} />
          <SideBtn icon={LogOut} label={t("v2.logout")} onClick={lock} />
        </div>
      </aside>

      {/* Coluna principal */}
      <div className="flex-1 min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between gap-4 px-5 md:px-8 lg:px-10 h-[68px]">
            <h1 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.02em] truncate">
              {t(`nav.${NAV_ITEMS.find((n) => n.id === active)?.key ?? "painel"}`)}
            </h1>
            <div className="flex items-center gap-2">
              <CurrencyMenu />
              <button
                type="button"
                onClick={toggleNumbers}
                aria-label={t("v2.togglePrivacy")}
                className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors"
              >
                {numbersHidden ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              <button
                type="button"
                onClick={() => setUiVersion("v1")}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border-strong text-[12.5px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors"
              >
                <PanelsTopLeft size={14} />
                {t("v2.backToV1")}
              </button>
            </div>
          </div>
        </header>

        <main className="px-5 md:px-8 lg:px-10 py-7 max-w-[1320px] mx-auto">{PAGE[active]}</main>
      </div>

      <ConfigDrawer />
    </div>
  );
}

function SideBtn({ icon: Icon, label, onClick }: { icon: typeof Settings; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex items-center gap-3 rounded-[12px] px-2.5 lg:px-3 h-11 text-[13.5px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors justify-center lg:justify-start"
    >
      <Icon size={18} className="shrink-0" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
