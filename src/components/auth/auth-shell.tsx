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

