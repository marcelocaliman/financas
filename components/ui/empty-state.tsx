import Link from "next/link";
import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";

/**
 * Estado vazio padronizado pra páginas sem dados.
 *
 * Uso: <EmptyState eyebrow="..." title={...} description="..." cta={{href, label}} />
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  cta,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  cta?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <Panel className="!py-14 grid place-items-center text-center">
      <div className="max-w-[520px]">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground font-medium">
          {eyebrow}
        </div>
        <h2 className="font-display text-[26px] tracking-[-0.02em] mt-2">{title}</h2>
        <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">
          {description}
        </p>
        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-[8px] bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 transition-colors"
          >
            {cta.label} →
          </Link>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </Panel>
  );
}
