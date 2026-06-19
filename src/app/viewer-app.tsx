import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Sun, Moon, ShieldCheck, Loader2 } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { CurrencyMenu } from "@/components/layout/currency-toggle";
import { OnePage } from "@/app/one-page";
import { db } from "@/data/db";
import { loadVault } from "@/vault/serialize";
import { setRepositoryReadOnly } from "@/data/dexie-repository";
import { useViewer } from "@/store/viewer";
import { useUI } from "@/store/ui";
import { useRates } from "@/store/rates";
import { useMainCurrency } from "@/hooks/use-main-currency";
import i18n from "@/i18n";
import { openShare, parseShareFragment, type ShareOpenResult } from "@/lib/shares";

type Stage = "checking" | "pin" | "loading" | "ready";

// "Lembrar 24h": guarda SÓ o PIN (gate de 4 dígitos) neste aparelho, com validade.
// O segredo de cripto já vive na URL; um PIN sem o link é inútil. No reload reabre
// sozinho e busca os dados FRESCOS do servidor (não guarda os números decifrados).
const UNLOCK_TTL_MS = 24 * 60 * 60 * 1000;
const unlockKey = (token: string) => `nf_share_unlock_${token}`;
function readCachedPin(token: string): string | null {
  try {
    const raw = localStorage.getItem(unlockKey(token));
    if (!raw) return null;
    const { pin, exp } = JSON.parse(raw) as { pin?: unknown; exp?: unknown };
    if (typeof pin !== "string" || typeof exp !== "number" || exp < Date.now()) {
      localStorage.removeItem(unlockKey(token));
      return null;
    }
    return pin;
  } catch {
    return null;
  }
}
function writeCachedPin(token: string, pin: string): void {
  try {
    localStorage.setItem(unlockKey(token), JSON.stringify({ pin, exp: Date.now() + UNLOCK_TTL_MS }));
  } catch {
    /* localStorage indisponível (modo privado) — segue sem lembrar */
  }
}
function clearCachedPin(token: string): void {
  try {
    localStorage.removeItem(unlockKey(token));
  } catch {
    /* ignora */
  }
}

const T: Record<string, Record<string, string>> = {
  pt: {
    title: "Painel compartilhado", sub: "Digite o PIN de 4 dígitos que você recebeu para ver o painel.",
    pin: "PIN", open: "Ver painel", opening: "Abrindo…", readonly: "Somente leitura",
    badInvalid: "Link inválido ou revogado.", badPin: "PIN incorreto.", badLocked: "Muitas tentativas. Tente de novo em {{s}}s.",
    badEmpty: "Este painel ainda não tem dados.", badErr: "Não foi possível abrir. Tente de novo.",
    invalidLink: "Link inválido. Confira o endereço que você recebeu.",
    remember: "Lembrar neste aparelho por 24h",
  },
  en: {
    title: "Shared dashboard", sub: "Enter the 4-digit PIN you received to view the dashboard.",
    pin: "PIN", open: "View dashboard", opening: "Opening…", readonly: "Read-only",
    badInvalid: "Invalid or revoked link.", badPin: "Wrong PIN.", badLocked: "Too many tries. Try again in {{s}}s.",
    badEmpty: "This dashboard has no data yet.", badErr: "Couldn't open. Try again.",
    invalidLink: "Invalid link. Check the address you received.",
    remember: "Remember on this device for 24h",
  },
  it: {
    title: "Pannello condiviso", sub: "Inserisci il PIN di 4 cifre che hai ricevuto per vedere il pannello.",
    pin: "PIN", open: "Vedi pannello", opening: "Apertura…", readonly: "Sola lettura",
    badInvalid: "Link non valido o revocato.", badPin: "PIN errato.", badLocked: "Troppi tentativi. Riprova tra {{s}}s.",
    badEmpty: "Questo pannello non ha ancora dati.", badErr: "Impossibile aprire. Riprova.",
    invalidLink: "Link non valido. Controlla l'indirizzo ricevuto.",
    remember: "Ricorda su questo dispositivo per 24h",
  },
};
// Idioma do viewer = o do DONO (vem no fragmento `&l=`), com fallback pro navegador.
// Assim o painel compartilhado abre no MESMO idioma do app do dono, não no do aparelho da esposa.
const LANG = (() => {
  const l = (parseShareFragment()?.lang || navigator.language || "pt").toLowerCase();
  return l.startsWith("en") ? "en" : l.startsWith("it") ? "it" : "pt";
})();
const tt = (k: string, s?: number) => (T[LANG][k] ?? T.pt[k] ?? k).replace("{{s}}", String(s ?? ""));

function errorMessage(r: Extract<ShareOpenResult, { ok: false }>): string {
  switch (r.error) {
    case "not_found": return tt("badInvalid");
    case "pin": return tt("badPin");
    case "locked": return tt("badLocked", r.retryAfter);
    case "empty": return tt("badEmpty");
    default: return tt("badErr");
  }
}

/** Tela do PIN — verifica AUTOMATICAMENTE ao completar 4 dígitos (sem botão) e redireciona no acerto. */
function PinGate({ onOpen, busy, error }: { onOpen: (pin: string, remember: boolean) => Promise<boolean>; busy: boolean; error: string }) {
  const [pin, setPin] = useState("");
  const [remember, setRemember] = useState(true);
  const submittedRef = useRef("");

  // Ao completar 4 dígitos: verifica sozinho. Acerto → redireciona; erro → limpa p/ re-tentar.
  useEffect(() => {
    if (pin.length < 4) { submittedRef.current = ""; return; }
    if (busy || submittedRef.current === pin) return;
    submittedRef.current = pin;
    void onOpen(pin, remember).then((okRes) => { if (!okRes) setPin(""); });
  }, [pin, busy, remember, onOpen]);

  return (
    <div className="min-h-screen grid place-items-center bg-bg text-text px-4">
      <div className="w-full max-w-[360px] rounded-[18px] border border-border bg-card p-6 sm:p-7 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2.5 mb-5">
          <Logo size={32} />
          <span className="font-semibold text-[15.5px] tracking-[-0.02em]">Nossas Finanças</span>
        </div>
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">{tt("title")}</h1>
        <p className="text-[13px] text-muted mt-1.5 leading-relaxed">{tt("sub")}</p>
        <label className="block mt-5">
          <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-faint mb-1.5">{tt("pin")}</span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            disabled={busy}
            placeholder="••••"
            className="w-full h-12 text-center text-[22px] tracking-[0.4em] tabular rounded-[11px] border border-border-strong bg-bg2 text-text outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)] transition-colors disabled:opacity-60"
          />
        </label>
        {error ? <p className="text-[12.5px] text-neg mt-3">{error}</p> : null}
        <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={busy}
            className="h-4 w-4 rounded border-border-strong bg-bg2 accent-[var(--accent)]"
          />
          <span className="text-[12.5px] text-muted">{tt("remember")}</span>
        </label>
        <div className="mt-5 h-5 flex items-center gap-2 text-[12.5px] text-muted">
          {busy ? <><Loader2 size={15} className="animate-spin" /> {tt("opening")}</> : null}
        </div>
        <p className="text-[11px] text-faint mt-2 leading-relaxed">{tt("readonly")} · E2EE</p>
      </div>
    </div>
  );
}

/** Barra superior enxuta do viewer (sem conta/config/admin). */
function ViewerBar() {
  const { t } = useTranslation();
  const numbersHidden = useUI((s) => s.numbersHidden);
  const toggleNumbers = useUI((s) => s.toggleNumbers);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  return (
    <header className="sticky top-0 z-40 glass border-b border-border">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 h-[60px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size={28} />
          <span className="font-semibold text-[15px] tracking-[-0.02em] truncate">{t("app.name")}</span>
          <span className="hidden sm:inline-flex items-center gap-1 ml-1 rounded-full border border-border bg-card2 px-2 py-0.5 text-[10.5px] font-medium text-muted">
            <ShieldCheck size={11} /> {tt("readonly")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleNumbers} aria-label={numbersHidden ? t("menu.show") : t("menu.hide")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors">
            {numbersHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <CurrencyMenu />
          <button type="button" onClick={toggleTheme} aria-label={t("common.theme")} className="grid place-items-center w-9 h-9 rounded-[10px] text-muted hover:text-text hover:bg-card-hover transition-colors">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}

/** Conteúdo destravado: sincroniza moeda do dono + câmbio, e mostra o painel. */
function ReadyView() {
  useMainCurrency(); // espelha a moeda principal do DONO (das settings cifradas) no useUI
  useEffect(() => {
    void useRates.getState().refresh();
  }, []);
  return (
    <div className="min-h-screen bg-bg text-text">
      <ViewerBar />
      <OnePage />
    </div>
  );
}

export function ViewerApp() {
  const theme = useUI((s) => s.theme);
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState("");
  const frag = useRef(parseShareFragment());
  const didInit = useRef(false);

  // idioma do viewer = o do dono (do fragmento) → seções do painel (react-i18next) seguem ele
  useEffect(() => {
    void i18n.changeLanguage(LANG);
  }, []);

  // tema do viewer
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // higiene: ao sair, melhor-esforço de apagar o Dexie (não reter o dado decifrado no aparelho).
  useEffect(() => {
    const clear = () => { void db.delete().catch(() => {}); };
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, []);

  const open = async (pin: string, remember: boolean, auto = false): Promise<boolean> => {
    const f = frag.current;
    if (!f) return false;
    setError("");
    setStage(auto ? "checking" : "loading"); // auto: spinner; manual: form com spinner
    const r = await openShare(f.token, f.secret, pin);
    if (!r.ok) {
      if (auto) clearCachedPin(f.token); // PIN lembrado não vale mais (revogado/expirado)
      setError(errorMessage(r));
      setStage("pin");
      return false;
    }
    if (remember) writeCachedPin(f.token, pin); // janela deslizante de 24h
    else clearCachedPin(f.token);
    await loadVault(db, r.data);     // popula o Dexie com o cofre decifrado do dono
    setRepositoryReadOnly(true);     // garantia dura: nenhuma escrita persiste
    useViewer.getState().setViewer(null);
    setStage("ready");
    return true;
  };

  // No load: se há PIN lembrado (≤24h) p/ este link, reabre sozinho (dados frescos do servidor).
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const f = frag.current;
    if (!f) return;
    const cached = readCachedPin(f.token);
    if (cached) void open(cached, true, true);
    else setStage("pin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!frag.current) {
    return (
      <div className="min-h-screen grid place-items-center bg-bg text-text px-4">
        <div className="max-w-[360px] text-center">
          <Logo size={36} className="mx-auto mb-4" />
          <p className="text-[14px] text-muted leading-relaxed">{tt("invalidLink")}</p>
        </div>
      </div>
    );
  }
  if (stage === "ready") return <ReadyView />;
  if (stage === "checking") {
    return (
      <div className="min-h-screen grid place-items-center bg-bg text-text">
        <Loader2 size={22} className="animate-spin text-muted" />
      </div>
    );
  }
  return <PinGate onOpen={open} busy={stage === "loading"} error={error} />;
}
