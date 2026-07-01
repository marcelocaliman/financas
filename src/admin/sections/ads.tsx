import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2 } from "lucide-react";
import { STORIES, drawStory, storyDuration, type Story } from "@/admin/ads/engine";
import { exportStory, downloadBlob, canExport } from "@/admin/ads/export";
import { cn } from "@/lib/utils";

const PREVIEW_W = 330;
const PREVIEW_H = 587; // 9:16

/** Prévia em loop do story (canvas pequeno, ~30fps). */
function StoryPreview({ story }: { story: Story }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let raf = 0;
    let last = 0;
    const dur = storyDuration(story);
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30fps (poupa CPU com 3 prévias juntas)
      last = now;
      drawStory(ctx, story, ((now - start) / 1000) % dur, PREVIEW_W, PREVIEW_H);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [story]);
  return <canvas ref={ref} width={PREVIEW_W} height={PREVIEW_H} className="block w-full h-auto" />;
}

function StoryCard({ story }: { story: Story }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const supported = canExport();

  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { blob, ext, mime } = await exportStory(story);
      downloadBlob(blob, `nossas-financas-${story.id}.${ext}`);
      if (!mime.includes("mp4")) {
        setNote("Baixou em WebM (seu navegador não faz MP4). Use Chrome recente ou Safari pra sair MP4.");
      }
    } catch {
      setNote("Falha ao gerar o vídeo. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[16px] border border-border bg-card p-3.5">
      <div className="overflow-hidden rounded-[14px] border border-border bg-bg">
        <StoryPreview story={story} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{story.name}</div>
          <div className="text-[11.5px] text-faint tabular">
            {story.scenes.length} páginas · 9:16 · {storyDuration(story)}s
          </div>
        </div>
        <button
          type="button"
          disabled={busy || !supported}
          onClick={run}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 h-9 px-3 rounded-[9px] text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            busy || !supported ? "bg-card2 text-faint cursor-not-allowed" : "bg-accent text-[#08130C] hover:opacity-90",
          )}
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Gravando…
            </>
          ) : (
            <>
              <Download size={14} /> Baixar MP4
            </>
          )}
        </button>
      </div>
      {note ? <div className="mt-2 text-[11.5px] text-neg leading-snug">{note}</div> : null}
    </div>
  );
}

/** Aba "Ads" (super-admin): 3 stories animados prontos pra divulgar, exportáveis em MP4 9:16. */
export function AdsSection() {
  const supported = canExport();
  return (
    <div>
      <p className="mb-5 max-w-[640px] text-[13px] leading-relaxed text-muted">
        Stories prontos pra divulgar (9:16, formato Instagram) — cada um com um mini-roteiro
        (dor → o app → benefício → CTA). Clique em <b className="text-text">Baixar MP4</b>: a gravação
        roda a animação em tempo real (~{storyDuration(STORIES[0])}s) e o arquivo baixa sozinho. É só
        postar como Story ou Reels.
      </p>
      {!supported ? (
        <div className="mb-4 rounded-[12px] border border-border bg-card2 p-3 text-[12.5px] text-muted">
          Este navegador não suporta gravar o canvas em vídeo. Use Chrome recente ou Safari.
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STORIES.map((st) => (
          <StoryCard key={st.id} story={st} />
        ))}
      </div>
    </div>
  );
}

export function AdsSummary() {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-muted">
      <Film size={15} className="text-accent" />
      <span className="tabular">{STORIES.length} stories · MP4 9:16</span>
    </span>
  );
}
