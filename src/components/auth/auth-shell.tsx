import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeftRight, ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { PrivacyLink } from "@/components/privacy-policy";
import { cn } from "@/lib/utils";

/** Marca do app (ícone + nome). */
function Brand({ className }: { className?: string }) {
  return (
    <a href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="grid place-items-center w-[32px] h-[32px] rounded-[9px] bg-accent text-[#0A0B0D] shrink-0">
        <ArrowLeftRight size={16} strokeWidth={2.5} />
      </span>
      <span className="font-semibold text-[16px] tracking-[-0.02em]">Nossas Finanças</span>
    </a>
  );
}

/** Frases que giram no painel esquerdo (com pontinhos). */
const PHRASES = [
  "Constância vira liberdade.",
  "Seu patrimônio, em qualquer moeda.",
  "Privado de verdade — só você lê seus números.",
];
function RotatingTagline() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PHRASES.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.03em] leading-[1.15] min-h-[2.4em] transition-opacity duration-500">
        {PHRASES[i]}
      </div>
      <div className="flex gap-2 mt-6">
        {PHRASES.map((_, k) => (
          <span
            key={k}
            className={cn("h-1.5 rounded-full transition-all duration-300", k === i ? "w-7 bg-accent" : "w-3 bg-[var(--border-strong)]")}
          />
        ))}
      </div>
    </div>
  );
}

/** Casca das telas de autenticação — split-card: painel da marca (esquerda) + formulário (direita). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center bg-bg p-4 sm:p-6">
      <div className="w-full max-w-[940px] grid md:grid-cols-[1.02fr_1fr] rounded-[22px] overflow-hidden border border-border bg-card shadow-[var(--shadow-float)]">
        {/* ESQUERDA — marca + brilho + frase (só no desktop) */}
        <div className="relative hidden md:flex flex-col justify-between p-9 bg-bg2 overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-24 -left-10 w-[460px] h-[420px] pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(62,207,142,0.16), transparent 62%)" }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <Brand />
            <a
              href="/"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-text bg-card/60 border border-border rounded-full px-3 h-8 transition-colors"
            >
              Voltar ao site <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="relative mt-12">
            <RotatingTagline />
          </div>
        </div>

        {/* DIREITA — formulário */}
        <div className="p-7 sm:p-9 lg:p-11">
          <div className="flex items-center justify-between gap-3 mb-7">
            <Brand className="md:hidden" />
            <a
              href="/"
              className="md:hidden inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-text ml-auto"
            >
              Voltar ao site <ArrowUpRight size={14} />
            </a>
          </div>
          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.03em] leading-tight">{title}</h1>
          {subtitle ? <p className="text-[13.5px] text-muted mt-2.5 leading-relaxed">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="text-[13.5px] text-muted mt-6">{footer}</div> : null}
          <div className="text-[12px] text-faint mt-7">
            <PrivacyLink />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  type,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <label className="block mb-3.5">
      <span className="block text-[12px] text-muted font-medium mb-1.5">{label}</span>
      <div className="relative">
        <input
          {...props}
          type={isPw ? (show ? "text" : "password") : type}
          className={cn(
            "w-full h-11 px-3.5 rounded-[10px] border border-border bg-bg2 text-[14.5px] text-text outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-[var(--ring)]",
            isPw && "pr-11",
          )}
        />
        {isPw ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-[8px] text-faint hover:text-text transition-colors"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : null}
      </div>
      {hint ? <span className="block text-[11px] text-faint mt-1">{hint}</span> : null}
    </label>
  );
}

export function SubmitButton({
  children,
  loading,
  className,
  ...props
}: { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      {...props}
      className={cn(
        "w-full h-11 rounded-[10px] bg-accent text-[#0A0B0D] font-semibold text-[14.5px] transition-[opacity,transform] hover:opacity-95 active:scale-[0.99] disabled:opacity-50",
        className,
      )}
    >
      {loading ? "…" : children}
    </button>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[12.5px] text-neg mb-3.5 leading-relaxed">
      {children}
    </p>
  );
}

export function LinkButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="text-accent font-medium hover:underline">
      {children}
    </button>
  );
}

/** Login social — Google ainda não está pronto: botão "em breve" desabilitado. */
export function SocialRow({ verb = "entre" }: { verb?: string }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-[11px] text-faint">
        <span className="h-px flex-1 bg-border" />
        ou {verb} com
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Em breve"
        className="mt-4 w-full h-11 rounded-[10px] border border-border bg-bg2 text-[13.5px] font-medium text-muted flex items-center justify-center gap-2.5 cursor-not-allowed opacity-80"
      >
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39 36 44 30.7 44 24a20 20 0 0 0-.4-3.5z" />
        </svg>
        Google
        <span className="ml-1 text-[10px] font-mono uppercase tracking-[0.1em] text-faint border border-border rounded-full px-1.5 py-0.5">
          em breve
        </span>
      </button>
    </div>
  );
}
