import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Check, Copy, Download, Film, Image as ImageIcon, Loader2 } from "lucide-react";
import { STORIES, POSTS, drawStory, drawPost, storyDuration, PHOTO_SRC, type Story, type Post } from "@/admin/ads/engine";
import { exportStory, exportPostPNG, downloadBlob, canExport, loadPhoto, getPhoto } from "@/admin/ads/export";
import { AdsCalendar } from "@/admin/ads/calendar";
import { useAdsCalendar } from "@/admin/ads/calendar-store";
import { cn } from "@/lib/utils";

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PREVIEW_W = 330;
const PREVIEW_H = 587; // 9:16
const POST_W = 340;
const POST_H = 425; // 4:5

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
    void loadPhoto(PHOTO_SRC[story.id]).catch(() => {}); // pré-carrega (getPhoto vira não-null quando pronta)
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30fps (poupa CPU com 3 prévias juntas)
      last = now;
      drawStory(ctx, story, ((now - start) / 1000) % dur, PREVIEW_W, PREVIEW_H, true, getPhoto(story.id));
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

/** Prévia ESTÁTICA de um post (um quadro só; redesenha quando as fontes E a foto de fundo carregam). */
function PostPreview({ post }: { post: Post }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let img: HTMLImageElement | null = null;
    const draw = () => drawPost(ctx, post, POST_W, POST_H, img);
    draw();
    // as fontes (Inter/JetBrains) e a foto podem não estar prontas no 1º paint → redesenha quando ficarem
    if (typeof document !== "undefined" && document.fonts) document.fonts.ready.then(draw).catch(() => {});
    if (post.photo)
      loadPhoto(post.photo)
        .then((i) => {
          img = i;
          draw();
        })
        .catch(() => {});
  }, [post]);
  return <canvas ref={ref} width={POST_W} height={POST_H} className="block w-full h-auto" />;
}

function PostCard({ post }: { post: Post }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [logged, setLogged] = useState(false);
  const addCal = useAdsCalendar((s) => s.add);

  const markToday = () => {
    addCal({ date: dateKey(new Date()), pieceId: `post:${post.id}`, status: "posted" });
    setLogged(true);
    setTimeout(() => setLogged(false), 1600);
  };

  const captionText = post.caption
    ? post.caption + (post.tags?.length ? "\n\n" + post.tags.map((t) => "#" + t).join(" ") : "")
    : "";

  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      const blob = await exportPostPNG(post);
      downloadBlob(blob, `nossas-financas-${post.id}.png`);
    } catch {
      setNote("Falha ao gerar o PNG. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(captionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setNote("Não consegui copiar — selecione o texto e copie manual.");
    }
  };

  return (
    <div className="rounded-[16px] border border-border bg-card p-3.5">
      <div className="overflow-hidden rounded-[14px] border border-border bg-bg">
        <PostPreview post={post} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{post.name}</div>
          <div className="text-[11.5px] text-faint tabular">{post.pillar} · PNG · 4:5</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={markToday}
            title="Marcar como postado hoje (vai pro calendário)"
            className={cn(
              "inline-flex items-center gap-1 h-9 px-2.5 rounded-[9px] border text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              logged ? "border-border text-accent" : "border-border text-muted hover:text-text hover:border-border-strong",
            )}
          >
            {logged ? <Check size={14} /> : <CalendarCheck size={14} />} {logged ? "Marcado" : "Hoje"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              busy ? "bg-card2 text-faint cursor-not-allowed" : "bg-accent text-[#08130C] hover:opacity-90",
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PNG
          </button>
        </div>
      </div>
      {note ? <div className="mt-2 text-[11.5px] text-neg leading-snug">{note}</div> : null}
      {captionText ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Legenda</span>
            <button
              type="button"
              onClick={copyCaption}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] text-[11.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                copied ? "border border-border text-accent" : "border border-border text-muted hover:text-text hover:border-border-strong",
              )}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto scrollbar-subtle whitespace-pre-wrap rounded-[10px] border border-border bg-bg px-2.5 py-2 text-[12px] leading-relaxed text-muted">
            {captionText}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Aba "Ads" (super-admin): stories animados (MP4 9:16) + posts estáticos (PNG 4:5) pra divulgar. */
export function AdsSection() {
  const supported = canExport();
  return (
    <div className="space-y-9">
      <section>
        <div className="mb-1.5 flex items-center gap-2">
          <CalendarCheck size={15} className="text-accent" />
          <h3 className="text-[14px] font-semibold text-text">Calendário de divulgação</h3>
        </div>
        <p className="mb-4 max-w-[640px] text-[13px] leading-relaxed text-muted">
          Marque o que já postou (ou planeje) e acompanhe a cadência. Cada peça abaixo tem o botão{" "}
          <b className="text-text">Hoje</b> pra registrar num clique.
        </p>
        <AdsCalendar />
      </section>

      <section>
        <div className="mb-1.5 flex items-center gap-2">
          <Film size={15} className="text-accent" />
          <h3 className="text-[14px] font-semibold text-text">Stories · MP4 9:16</h3>
        </div>
        <p className="mb-5 max-w-[640px] text-[13px] leading-relaxed text-muted">
          Cada um com um mini-roteiro (dor → o app → benefício → CTA). Clique em{" "}
          <b className="text-text">Baixar MP4</b>: a gravação roda a animação em tempo real
          (~{storyDuration(STORIES[0])}s) e o arquivo baixa sozinho. É só postar como Story ou Reels.
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
      </section>

      <section>
        <div className="mb-1.5 flex items-center gap-2">
          <ImageIcon size={15} className="text-accent" />
          <h3 className="text-[14px] font-semibold text-text">Posts · PNG 4:5</h3>
        </div>
        <p className="mb-5 max-w-[640px] text-[13px] leading-relaxed text-muted">
          Imagens estáticas pro feed (1080×1350) nos 4 pilares — multimoeda, privacidade, organização
          e build-in-public. Clique em <b className="text-text">Baixar PNG</b> e poste direto. O
          @nossasfinancasapp e o site já vão marcados no rodapé.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POSTS.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdsSummary() {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-muted">
      <Film size={15} className="text-accent" />
      <span className="tabular">{STORIES.length} stories · {POSTS.length} posts</span>
    </span>
  );
}
