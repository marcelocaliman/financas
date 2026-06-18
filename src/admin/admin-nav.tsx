import { ArrowLeftRight, ArrowLeft, Sun, Moon, Lock, LogOut, ShieldCheck } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./nav-items";
import { goToSection } from "@/hooks/use-scroll-spy";
import { useAdminUI } from "@/store/admin-ui";
import { useUI } from "@/store/ui";
import { useVault } from "@/vault/vault-store";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  overview: "Visão geral",
  users: "Usuários",
  analytics: "Analytics",
  access: "Acessos & logs",
  admins: "Administradores",
};

function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const h = email.split("@")[0].split(/[._-]/)[0];
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : "";
}

/** Rail lateral do painel (lg+): marca "Admin" + seções + rodapé (voltar/tema/sair). */
export function AdminSideNav({ active }: { active: string }) {
  const close = useAdminUI((s) => s.setAdminOpen);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const email = useVault((s) => s.email);
  const lock = useVault((s) => s.lock);
  const signOut = useVault((s) => s.signOut);
  const name = nameFromEmail(email);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col fixed left-4 top-4 z-40 w-[244px] rounded-[20px] bg-card border border-border shadow-[var(--shadow-float)] max-h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex flex-col overflow-y-auto scrollbar-subtle">
        <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-3.5">
          <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
            <ShieldCheck size={16} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[14.5px] tracking-[-0.02em] leading-none">Painel</div>
            <div className="text-[10.5px] text-faint mt-0.5">administração</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 px-2.5 pb-2">
          {ADMIN_NAV_ITEMS.map(({ id, key, icon: Icon }) => {
            const on = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goToSection(id)}
                className={cn(
                  "flex items-center gap-3 h-10 px-3 rounded-[11px] text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                  on ? "text-accent bg-card2" : "text-muted hover:text-text hover:bg-card-hover",
                )}
              >
                <Icon size={17} className="shrink-0" />
                <span className="truncate">{LABEL[key]}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 pt-3 mt-1 border-t border-border">
          <button
            type="button"
            onClick={() => close(false)}
            className="w-full flex items-center gap-2.5 h-10 px-3 rounded-[11px] text-[13px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors mb-1"
          >
            <ArrowLeft size={16} /> Voltar ao app
          </button>
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-accent text-[#0A0B0D] text-[12px] font-bold shrink-0">{initial}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold truncate leading-tight">{name || "Admin"}</div>
              {email ? <div className="text-[11px] text-faint truncate">{email}</div> : null}
            </div>
            <button type="button" onClick={toggleTheme} aria-label="Tema" className="grid place-items-center w-8 h-8 rounded-[9px] text-muted hover:text-text hover:bg-card-hover transition-colors shrink-0">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button type="button" onClick={lock} aria-label="Travar" className="grid place-items-center w-8 h-8 rounded-[9px] text-muted hover:text-text hover:bg-card-hover transition-colors shrink-0">
              <Lock size={15} />
            </button>
            <button type="button" onClick={() => void signOut()} aria-label="Sair" className="grid place-items-center w-8 h-8 rounded-[9px] text-muted hover:text-neg hover:bg-card-hover transition-colors shrink-0">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Barra superior do painel no mobile (<lg): marca + voltar + abas horizontais roláveis. */
export function AdminTopBar({ active }: { active: string }) {
  const close = useAdminUI((s) => s.setAdminOpen);
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="flex items-center justify-between gap-3 h-[54px] px-4">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center w-[26px] h-[26px] rounded-[8px] bg-accent text-[#0A0B0D]"><ShieldCheck size={14} strokeWidth={2.4} /></div>
          <span className="font-semibold text-[14.5px] tracking-[-0.02em]">Painel</span>
        </div>
        <button type="button" onClick={() => close(false)} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[9px] border border-border text-[12px] font-medium text-muted hover:text-text transition-colors">
          <ArrowLeftRight size={13} /> App
        </button>
      </div>
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-subtle">
        {ADMIN_NAV_ITEMS.map(({ id, key }) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => goToSection(id)}
              className={cn(
                "shrink-0 h-8 px-3 rounded-[9px] text-[12.5px] font-medium transition-colors whitespace-nowrap",
                on ? "text-accent bg-card2" : "text-muted hover:text-text",
              )}
            >
              {LABEL[key]}
            </button>
          );
        })}
      </div>
    </header>
  );
}
