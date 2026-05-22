import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

/**
 * Layout das páginas de autenticação. Dois lados:
 *  - esquerda: marca + frase editorial sobre papel quente
 *  - direita: formulário em superfície branca
 *
 * Em mobile a estrutura colapsa para uma coluna só.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1.05fr_1fr] relative">
      {/* Lado esquerdo — narrativa */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-ink-950 text-white overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(176,123,50,0.16), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 w-[360px] h-[360px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(96,126,168,0.12), transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <BrandMark size="md" tone="light" />
          <div className="font-mono text-[10.5px] mt-1.5 tracking-[0.18em] uppercase text-navy-400 font-medium">
            Patrimônio · casal · vida
          </div>
        </div>

        <div className="relative z-10 max-w-[440px]">
          <p className="font-display italic font-light text-[28px] leading-[1.25] tracking-[-0.015em] text-navy-100">
            &ldquo;O dinheiro que sobra silencioso no fim do mês é o que constrói
            liberdade no fim da década.&rdquo;
          </p>
          <div className="mt-6 flex items-center gap-2 text-navy-400">
            <span className="h-px w-8 bg-navy-700" />
            <span className="font-mono text-[11px] tracking-[0.16em] uppercase">
              O instrumento
            </span>
          </div>
        </div>

        <div className="relative z-10 font-mono text-[10.5px] text-ink-600 tracking-[0.14em] uppercase">
          v0.1 · Maio · 2026
        </div>
      </aside>

      {/* Lado direito — formulário */}
      <main className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-10 flex items-center gap-2">
            <BrandMark size="md" tone="dark" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
