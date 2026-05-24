import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

/**
 * Layout das páginas de autenticação. Dois lados:
 *  - esquerda: brand discreto no topo + frase editorial em tipografia MASSIVA
 *    centrada vertical/horizontalmente, com palavra-chave em gold accent,
 *    múltiplos blobs de gradiente + textura de grão pra dar profundidade
 *  - direita: formulário sobre fundo escuro
 *
 * Em mobile a estrutura colapsa para uma coluna só.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1.15fr_1fr] relative">
      {/* Lado esquerdo — narrativa editorial */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-14 bg-ink-950 text-white overflow-hidden">
        {/* Camadas de profundidade — gradientes radiais + grão */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(176,123,50,0.22), rgba(176,123,50,0.08) 40%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -left-40 w-[480px] h-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(96,126,168,0.18), rgba(96,126,168,0.05) 50%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-1/4 w-[380px] h-[380px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(176,123,50,0.10), transparent 70%)",
          }}
        />

        {/* Grain overlay sutil — SVG fractal noise pra textura */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.035] mix-blend-overlay"
        >
          <filter id="auth-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#auth-noise)" />
        </svg>

        {/* Linha vertical sutil de gold à direita — separação editorial */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 right-0 w-px"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(176,123,50,0.25) 30%, rgba(176,123,50,0.25) 70%, transparent)",
          }}
        />

        {/* Topo — brand */}
        <div className="relative z-10">
          <BrandMark size="md" tone="light" />
          <div className="font-mono text-[10.5px] mt-1.5 tracking-[0.18em] uppercase text-navy-400 font-medium">
            Patrimônio · casal · vida
          </div>
        </div>

        {/* Centro — frase MASSIVA, vertical e horizontalmente centralizada */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-[680px] mx-auto w-full">
          {/* Label "respirando ao vivo" sutil */}
          <div className="flex items-center gap-2 mb-8">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-olive-600 animate-pulse" />
            <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-navy-400 font-medium">
              Editorial · respirando ao vivo
            </span>
          </div>

          <p className="font-display italic font-light text-[44px] xl:text-[52px] leading-[1.1] tracking-[-0.025em] text-navy-100">
            &ldquo;O dinheiro que sobra{" "}
            <span className="text-navy-200">silencioso</span> no fim do mês é o que
            constrói{" "}
            <span className="not-italic font-normal text-gold-600 relative inline-block">
              liberdade
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px bg-gold-600/40"
              />
            </span>{" "}
            no fim da década.&rdquo;
          </p>

          <div className="mt-8 flex items-center gap-3 text-navy-400">
            <span className="h-px w-10 bg-gold-600/50" />
            <span className="font-mono text-[11.5px] tracking-[0.18em] uppercase">
              O instrumento
            </span>
          </div>
        </div>

        {/* Rodapé */}
        <div className="relative z-10 flex items-center justify-between font-mono text-[10.5px] text-ink-600 tracking-[0.14em] uppercase">
          <span>v0.1 · Maio · 2026</span>
          <span className="text-ink-500">
            FIRE · 4% · 25× · <span className="text-gold-600/70">tempo</span>
          </span>
        </div>
      </aside>

      {/* Lado direito — formulário */}
      <main className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-12 bg-ink-950">
        {/* Sutil radial atrás do form pra dar respiro */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 600px 400px at center, rgba(96,126,168,0.05), transparent)",
          }}
        />
        <div className="relative z-10 w-full max-w-[400px]">
          <div className="lg:hidden mb-10 flex items-center gap-2">
            <BrandMark size="md" tone="light" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
