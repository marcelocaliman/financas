import type { ReactNode } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Panel } from "@/components/common/panel";
import { cn } from "@/lib/utils";

/** Casca centralizada das telas de autenticação (login, cadastro, unlock…). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-teal flex items-center justify-center">
            <ArrowLeftRight size={18} color="#fff" />
          </div>
          <span className="font-bold text-[18px] tracking-[-0.01em]">Finanças</span>
        </div>
        <Panel className="p-6">
          <h1 className="text-[18px] font-bold tracking-[-0.01em]">{title}</h1>
          {subtitle ? <p className="text-[13px] text-muted mt-1 leading-relaxed">{subtitle}</p> : null}
          <div className="mt-5">{children}</div>
        </Panel>
        {footer ? <div className="text-center text-[13px] text-muted mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-3">
      <span className="block text-[12px] text-muted font-medium mb-1">{label}</span>
      <input
        {...props}
        className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[14px] text-text outline-none transition-colors focus:border-teal"
      />
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
        "w-full h-10 rounded-[8px] bg-teal text-white font-semibold text-[14px] transition-opacity disabled:opacity-50",
        className,
      )}
    >
      {loading ? "…" : children}
    </button>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-[12.5px] text-red-600 mb-3 leading-relaxed">{children}</p>;
}

export function LinkButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="text-teal font-medium hover:underline">
      {children}
    </button>
  );
}
