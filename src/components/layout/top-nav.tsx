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
import { scrollToSection, useScrolled } from "@/hooks/use-scroll-spy";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";
import { cn } from "@/lib/utils";

function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}

/** Header que FLUTUA ao rolar (pill descolada do topo) e fica transparente sobre o hero. */
export function TopNav({ active }: { active: string }) {
  const { t } = useTranslation();
  const scrolled = useScrolled(48);
  const hidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);

  return (
    <header className="fixed top-0 left-0 right-0 z-40">
      <div
        className={cn(
          "transition-[padding] duration-300 ease-out",
          scrolled ? "pt-3 px-3 sm:px-5" : "pt-0 px-0",
        )}
      >
        <div
          className={cn(
            "max-w-[1560px] mx-auto flex items-center justify-between gap-4 transition-all duration-300 ease-out",
            scrolled
              ? "h-14 px-4 md:px-6 rounded-[16px] glass border border-border shadow-[var(--shadow-float)]"
              : "h-16 px-5 md:px-8 lg:px-12 xl:px-16 border border-transparent",
          )}
        >
          <button
            type="button"
            onClick={() => scrollToSection(NAV_ITEMS[0].id)}
            className="flex items-center gap-2.5 shrink-0"
          >
            <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0b0c0e]">
              <ArrowLeftRight size={16} />
            </div>
            <span className="font-display font-bold text-[16px] tracking-[-0.02em]">{t("app.name")}</span>
          </button>

          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map(({ id, key }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                    on ? "text-accent" : "text-muted hover:text-text",
                  )}
                >
                  {t(`nav.${key}`)}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleNumbers}
              aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
              className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors"
            >
              {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <CurrencyToggle />
            <UserMenu />
          </div>
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
        className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-full hover:bg-card-hover transition-colors"
      >
        <span className="grid place-items-center w-8 h-8 rounded-full bg-accent text-[#0b0c0e] text-[13px] font-bold">
          {initial}
        </span>
        {name ? <span className="hidden md:inline text-[13.5px] font-medium">{name}</span> : null}
        <ChevronDown size={14} className="hidden md:block text-faint" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 z-50 rounded-[14px] border border-border bg-card shadow-[var(--shadow-float)] overflow-hidden">
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
