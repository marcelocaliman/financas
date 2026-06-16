import { useState } from "react";
import {
  ArrowLeftRight,
  Eye,
  EyeOff,
  Settings,
  Lock,
  LogOut,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./nav-items";
import { CurrencyToggle } from "./currency-toggle";
import { scrollToSection } from "@/hooks/use-scroll-spy";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";
import { cn } from "@/lib/utils";

function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}

/** Header sticky, full-width, translúcido (blur) — sem pill flutuante. */
export function TopNav({ active }: { active: string }) {
  const { t } = useTranslation();
  const hidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-border">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4 h-[60px] px-5 md:px-10 lg:px-14">
        <div className="flex items-center gap-7 min-w-0">
          <button
            type="button"
            onClick={() => scrollToSection(NAV_ITEMS[0].id)}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="grid place-items-center w-[26px] h-[26px] rounded-[7px] bg-accent text-[#0A0B0D]">
              <ArrowLeftRight size={14} strokeWidth={2.6} />
            </div>
            <span className="font-semibold text-[15.5px] tracking-[-0.02em]">{t("app.name")}</span>
          </button>

          <nav className="hidden lg:flex items-center gap-5">
            {NAV_ITEMS.map(({ id, key }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={cn(
                    "text-[13px] transition-colors",
                    on ? "text-accent font-semibold" : "text-muted hover:text-text font-medium",
                  )}
                >
                  {t(`nav.${key}`)}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleNumbers}
            aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
            className="grid place-items-center w-9 h-9 rounded-[9px] text-faint hover:text-text hover:bg-card-hover transition-colors"
          >
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <CurrencyToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);
  const [open, setOpen] = useState(false);

  const name = nameFromEmail(email);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Conta"
        className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-[9px] bg-card2 border border-border hover:bg-card-hover transition-colors"
      >
        <span className="grid place-items-center w-[22px] h-[22px] rounded-full bg-accent text-[#0A0B0D] text-[11px] font-bold">
          {initial}
        </span>
        {name ? <span className="hidden sm:block text-[13px] font-medium">{name}</span> : null}
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 max-w-[calc(100vw-2.5rem)] z-50 rounded-[12px] border border-border bg-card shadow-[var(--shadow-float)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border">
              <div className="text-[13.5px] font-semibold truncate">{name || "Conta"}</div>
              {email ? <div className="text-[12px] text-muted truncate mt-0.5">{email}</div> : null}
            </div>
            <div className="p-1.5">
              <MenuItem
                icon={Settings}
                onClick={() => {
                  setOpen(false);
                  scrollToSection("config");
                }}
              >
                Configurações
              </MenuItem>
              <MenuItem
                icon={Lock}
                onClick={() => {
                  setOpen(false);
                  lock();
                }}
              >
                Trancar o cofre
              </MenuItem>
              <MenuItem
                icon={LogOut}
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                Sair
              </MenuItem>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  onClick,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[13.5px] text-muted hover:text-text hover:bg-card-hover transition-colors text-left"
    >
      <Icon size={15} />
      {children}
    </button>
  );
}
