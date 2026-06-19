import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Eye, EyeOff, MoveRight, ShieldCheck, TrendingUp } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { PrivacyLink } from "@/components/privacy-policy";
import { cn } from "@/lib/utils";

/** Marca do app (ícone + nome). */
function Brand({ className }: { className?: string }) {
  return (
    <a href="/" className={cn("flex items-center gap-2.5", className)}>
      <Logo size={34} className="shrink-0" />
      <span className="font-semibold text-[16.5px] tracking-[-0.02em]">Nossas Finanças</span>
    </a>
  );
}

/** Link discreto de volta à landing. */
function BackToSite({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={cn(
        "inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-text bg-card/50 border border-border rounded-full px-3 h-8 transition-colors",
        className,
      )}
    >
      Voltar ao site <ArrowUpRight size={14} />
    </a>
  );
}

/** Frases que giram na vitrine — manchete grande e apertada, com pontinhos. */
const PHRASES = [
  "Constância vira liberdade.",
  "Seu patrimônio, em qualquer moeda.",
  "Só você lê os seus números.",
];
function RotatingTagline() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PHRASES.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      {/* Não é heading semântico (a h1 da página é o título do formulário) — é copy de marketing. */}
      <div className="text-[clamp(1.9rem,2.9vw,2.6rem)] font-semibold tracking-[-0.035em] leading-[1.08] min-h-[2em] transition-opacity duration-500">
        {PHRASES[i]}
      </div>
      <div className="flex gap-2 mt-6">
        {PHRASES.map((_, k) => (
          <button
            key={k}
            type="button"
            onClick={() => setI(k)}
            aria-label={`Frase ${k + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              k === i ? "w-8 bg-accent" : "w-3.5 bg-[var(--border-strong)] hover:bg-faint",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Mini-gráfico de área (ilustrativo) — linha fina no acento + gradiente sutil. */
function PreviewChart() {
  const line = "M0,52 C28,48 44,34 70,36 C96,38 110,22 140,24 C172,26 188,12 224,9 C248,7 262,6 280,4";
  return (
    <svg viewBox="0 0 280 64" className="w-full h-[58px] mt-4" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="auth-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L280,64 L0,64 Z`} fill="url(#auth-spark)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Vitrine do produto: um mini-painel flutuante que evoca o app (números ilustrativos). */
function AuthPreview() {
  return (
    <div className="relative w-full max-w-[420px]">
      {/* Card principal — patrimônio líquido + tendência + composição */}
      <div className="rounded-[20px] border border-border bg-card2 p-6 shadow-[var(--shadow-float)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">Patrimônio líquido</div>
            <div className="hero-number text-[34px] mt-2">R$ 512.480</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] text-accent px-2.5 py-1 text-[12px] font-semibold tabular shrink-0">
            <TrendingUp size={13} /> +6,2%
          </span>
        </div>

        <PreviewChart />

        <div className="mt-5">
          <div className="flex h-2 rounded-full overflow-hidden bg-card2">
            <div className="h-full bg-accent" style={{ width: "64%" }} />
            <div className="h-full bg-[var(--accent-2)]" style={{ width: "36%" }} />
          </div>
          <div className="flex items-center gap-4 mt-2.5 text-[11.5px] text-muted tabular">
            <span className="flex items-center gap-1.5">
              <span className="chip chip-BRL">BRL</span> 64%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="chip chip-EUR">EUR</span> 36%
            </span>
          </div>
        </div>
      </div>

      {/* Chip flutuante — câmbio (multimoeda) */}
      <div className="absolute -left-5 -top-5 hidden xl:flex items-center gap-2 rounded-[12px] border border-border bg-card2 px-3 py-2 shadow-[var(--shadow-float)]">
        <span className="chip chip-BRL">BRL</span>
        <MoveRight size={13} className="text-faint" />
        <span className="chip chip-EUR">EUR</span>
        <span className="text-[12px] text-muted tabular">0,1623</span>
      </div>

      {/* Card flutuante — rentabilidade dos investimentos */}
      <div className="absolute -right-5 -bottom-6 rounded-[14px] border border-border bg-card2 px-4 py-3 shadow-[var(--shadow-float)]">
        <div className="eyebrow">Rentabilidade</div>
        <div className="text-[19px] font-semibold tabular text-accent mt-1">+12,4%</div>
      </div>
    </div>
  );
}

/** Vitrine (lg+): CARD flutuante — marca + preview do produto + manchete rotativa, sobre brilho verde. */
function AuthShowcase() {
  return (
    <div className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-[20px] border border-border bg-card shadow-[var(--shadow-float)] p-12 xl:p-14">
      {/* Brilhos radiais (cantos opostos) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 w-[560px] h-[560px]"
        style={{ background: "radial-gradient(ellipse, rgba(62,207,142,0.18), transparent 62%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 w-[520px] h-[520px]"
        style={{ background: "radial-gradient(ellipse, rgba(62,207,142,0.07), transparent 65%)" }}
      />
      {/* Malha discreta com máscara radial (textura premium) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 60% 40%, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, black, transparent 78%)",
        }}
      />

      <div className="relative">
        <Brand />
      </div>

      <div className="relative flex-1 grid place-items-center py-10">
        <AuthPreview />
      </div>

      <div className="relative">
        <div className="eyebrow mb-4" style={{ color: "var(--accent)" }}>
          Privado · Multimoeda · Cross-border
        </div>
        <RotatingTagline />
        <p className="text-[13.5px] text-muted leading-relaxed mt-5 max-w-[44ch]">
          Patrimônio, orçamento, investimentos e projeção num só lugar — cifrado de ponta a ponta.
          Nem nós conseguimos ler os seus números.
        </p>
      </div>
    </div>
  );
}

/** Casca das telas de autenticação — split full-screen: formulário (esq.) + vitrine (dir.). */
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
    <div className="min-h-screen w-full bg-bg lg:grid lg:grid-cols-[1.06fr_1fr]">
      {/* ESQUERDA — vitrine como CARD flutuante (lg+), recuada das bordas como o menu lateral.
          lg:h-screen garante que o card preencha 100vh (a row do grid não estica sozinha). */}
      <div className="hidden lg:flex p-4 lg:h-screen">
        <AuthShowcase />
      </div>

      {/* DIREITA — formulário */}
      <div className="relative flex min-h-screen flex-col px-5 py-7 sm:px-8 lg:min-h-0 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between gap-3">
          <Brand className="lg:hidden" />
          <BackToSite className="ml-auto" />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-[400px] mx-auto">
            <h1 className="text-[clamp(1.7rem,3.4vw,2.3rem)] font-semibold tracking-[-0.035em] leading-[1.05]">
              {title}
            </h1>
            {subtitle ? <p className="text-[14px] text-muted mt-3 leading-relaxed">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="text-[13.5px] text-muted mt-6">{footer}</div> : null}
          </div>
        </div>

        <div className="w-full max-w-[400px] mx-auto flex items-center justify-between gap-3 text-[11.5px] text-faint">
          <PrivacyLink />
          <span>© Nossas Finanças</span>
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

/** Nota de credibilidade: sem login social, de propósito — a senha é a chave de cifragem (E2EE). */
export function SecurityNote() {
  return (
    <div className="mt-6 pt-5 border-t border-border flex items-start gap-2.5">
      <ShieldCheck size={15} className="text-accent shrink-0 mt-0.5" />
      <p className="text-[11.5px] text-faint leading-relaxed">
        <b className="text-muted font-medium">Sem login social — por segurança.</b> A sua senha é a
        chave que cifra os seus dados (criptografia ponta a ponta): ela nunca passa por terceiros,
        nem pela Google. Nem nós conseguimos ler o que você guarda.
      </p>
    </div>
  );
}
