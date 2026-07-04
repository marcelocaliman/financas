import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Check, Circle, Copy, Download, Film, GalleryHorizontalEnd, GraduationCap, Image as ImageIcon, Loader2 } from "lucide-react";
import { STORIES, EDU_STORIES, POSTS, EDU_POSTS, CAROUSELS, EDU_CAROUSELS, HIGHLIGHTS, drawStory, drawPost, drawCarouselSlide, drawHighlightCover, storyDuration, PHOTO_SRC, type Story, type Post, type Carousel, type Slide, type HighlightCover } from "@/admin/ads/engine";
import { exportStory, exportPostPNG, exportCarouselPNGs, exportHighlightPNG, downloadBlob, canExport, loadPhoto, getPhoto } from "@/admin/ads/export";
import { AdsCalendar } from "@/admin/ads/calendar";
import { useAdsCalendar } from "@/admin/ads/calendar-store";
import { CardSubNav } from "@/components/common/card-sub-nav";
import { cn } from "@/lib/utils";

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtDay = (k: string) => {
  const [, m, d] = k.split("-").map(Number);
  return `${d} ${MONTHS_ABBR[m - 1]}`;
};

/** Marca a peça como publicada HOJE (idempotente: não duplica se já registrada hoje). */
function markPostedToday(pieceId: string) {
  const s = useAdsCalendar.getState();
  const today = dateKey(new Date());
  if (!s.entries.some((e) => e.pieceId === pieceId && e.date === today && e.status === "posted")) {
    s.add({ date: today, pieceId, status: "posted" });
  }
}

/** Selo "publicado em <dia>" sobreposto à prévia — mostra a data do último registro postado da peça. */
function PostedBadge({ pieceId }: { pieceId: string }) {
  const date = useAdsCalendar((s) => {
    let latest: string | null = null;
    for (const e of s.entries) if (e.pieceId === pieceId && e.status === "posted" && (!latest || e.date > latest)) latest = e.date;
    return latest;
  });
  if (!date) return null;
  return (
    <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-[3px] text-[10.5px] font-semibold text-[#08130C] shadow">
      <Check size={11} /> Publicado {fmtDay(date)}
    </span>
  );
}

/** Botão "marcar como publicado hoje" (registra no calendário) — padrão em todo card de peça. */
function MarkTodayButton({ pieceId }: { pieceId: string }) {
  const [logged, setLogged] = useState(false);
  const posted = useAdsCalendar((s) => s.entries.some((e) => e.pieceId === pieceId && e.status === "posted"));
  const onClick = () => {
    markPostedToday(pieceId);
    setLogged(true);
    setTimeout(() => setLogged(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title="Marcar como publicado hoje (vai pro calendário)"
      className={cn(
        "inline-flex items-center gap-1 h-9 px-2.5 rounded-[9px] border text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        logged || posted ? "border-border text-accent" : "border-border text-muted hover:text-text hover:border-border-strong",
      )}
    >
      {logged || posted ? <Check size={14} /> : <CalendarCheck size={14} />} {logged ? "Marcado" : posted ? "Publicado" : "Hoje"}
    </button>
  );
}

/** Sub-abas (sticky, com sublinhado) da aba Ads — mesmas do painel do usuário. */
const SUBNAV: { id: string; label: string }[] = [
  { id: "ads-calendario", label: "Calendário" },
  { id: "ads-stories", label: "Stories" },
  { id: "ads-stories-edu", label: "Stories edu." },
  { id: "ads-posts", label: "Posts" },
  { id: "ads-posts-edu", label: "Posts edu." },
  { id: "ads-carrosseis", label: "Carrosséis" },
  { id: "ads-destaques", label: "Destaques" },
];

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
    const src = PHOTO_SRC[story.id];
    if (src) void loadPhoto(src).catch(() => {}); // pré-carrega (getPhoto vira não-null quando pronta)
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
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-bg">
        <PostedBadge pieceId={`story:${story.id}`} />
        <StoryPreview story={story} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{story.name}</div>
          <div className="text-[11.5px] text-faint tabular">
            {story.scenes.length} páginas · 9:16 · {storyDuration(story)}s
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <MarkTodayButton pieceId={`story:${story.id}`} />
          <button
            type="button"
            disabled={busy || !supported}
            onClick={run}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              busy || !supported ? "bg-card2 text-faint cursor-not-allowed" : "bg-accent text-[#08130C] hover:opacity-90",
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {busy ? "Gravando…" : "MP4"}
          </button>
        </div>
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
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-bg">
        <PostedBadge pieceId={`post:${post.id}`} />
        <PostPreview post={post} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{post.name}</div>
          <div className="text-[11.5px] text-faint tabular">{post.pillar} · PNG · 4:5</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <MarkTodayButton pieceId={`post:${post.id}`} />
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

const SLIDE_W = 264;
const SLIDE_H = 330; // 4:5

/** Miniatura de UM slide do carrossel (com o indicador n/total); recarrega quando a foto/fontes vêm. */
function SlideThumb({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let img: HTMLImageElement | null = null;
    const draw = () => drawCarouselSlide(ctx, slide, SLIDE_W, SLIDE_H, index, total, img);
    draw();
    if (typeof document !== "undefined" && document.fonts) document.fonts.ready.then(draw).catch(() => {});
    if (slide.photo)
      loadPhoto(slide.photo)
        .then((i) => {
          img = i;
          draw();
        })
        .catch(() => {});
  }, [slide, index, total]);
  return (
    <canvas
      ref={ref}
      width={SLIDE_W}
      height={SLIDE_H}
      className="block h-auto w-[150px] shrink-0 snap-start rounded-[10px] border border-border"
    />
  );
}

function CarouselCard({ carousel }: { carousel: Carousel }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const total = carousel.slides.length;

  const captionText = carousel.caption
    ? carousel.caption + (carousel.tags?.length ? "\n\n" + carousel.tags.map((t) => "#" + t).join(" ") : "")
    : "";

  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      const blobs = await exportCarouselPNGs(carousel);
      for (let i = 0; i < blobs.length; i++) {
        downloadBlob(blobs[i], `nossas-financas-${carousel.id}-${String(i + 1).padStart(2, "0")}.png`);
        await new Promise((r) => setTimeout(r, 350)); // espaça os downloads (o navegador pode pedir permissão p/ baixar vários)
      }
    } catch {
      setNote("Falha ao gerar as imagens. Tente de novo.");
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
      <div className="relative">
        <PostedBadge pieceId={`carousel:${carousel.id}`} />
        <div className="flex gap-2.5 overflow-x-auto scrollbar-subtle snap-x pb-1">
          {carousel.slides.map((sl, i) => (
            <SlideThumb key={i} slide={sl} index={i} total={total} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{carousel.name}</div>
          <div className="text-[11.5px] text-faint tabular">{carousel.pillar} · {total} imagens · PNG 4:5</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <MarkTodayButton pieceId={`carousel:${carousel.id}`} />
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              busy ? "bg-card2 text-faint cursor-not-allowed" : "bg-accent text-[#08130C] hover:opacity-90",
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {busy ? "Gerando…" : `${total} PNGs`}
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

const HL_PREV = 116; // px exibidos da prévia circular

/** Prévia circular de uma capa de destaque (mostra como o Instagram vai recortar). */
function HighlightPreview({ cover }: { cover: HighlightCover }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    drawHighlightCover(ctx, cover, HL_PREV * 2, HL_PREV * 2);
  }, [cover]);
  return (
    <canvas
      ref={ref}
      width={HL_PREV * 2}
      height={HL_PREV * 2}
      style={{ width: HL_PREV, height: HL_PREV }}
      className="rounded-full border border-border"
    />
  );
}

function HighlightsBlock() {
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const one = async (cover: HighlightCover) => {
    setBusyId(cover.id);
    setNote(null);
    try {
      const b = await exportHighlightPNG(cover);
      downloadBlob(b, `nossas-financas-destaque-${cover.id}.png`);
    } catch {
      setNote("Falha ao gerar a capa. Tente de novo.");
    } finally {
      setBusyId(null);
    }
  };

  const all = async () => {
    setBusy(true);
    setNote(null);
    try {
      for (const cover of HIGHLIGHTS) {
        const b = await exportHighlightPNG(cover);
        downloadBlob(b, `nossas-financas-destaque-${cover.id}.png`);
        await new Promise((r) => setTimeout(r, 350)); // espaça os downloads
      }
    } catch {
      setNote("Falha ao gerar as capas. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[16px] border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
        {HIGHLIGHTS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => one(c)}
            title={`Baixar capa — agrupar: ${c.hint}`}
            className="group flex w-[124px] flex-col items-center gap-1.5 outline-none"
          >
            <span className="relative">
              <HighlightPreview cover={c} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {busyId === c.id ? (
                  <Loader2 size={20} className="animate-spin text-white" />
                ) : (
                  <Download size={20} className="text-white" />
                )}
              </span>
            </span>
            <span className="mt-1 text-[12.5px] font-medium">{c.label}</span>
            <span className="text-center text-[11px] leading-snug text-faint">{c.hint}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={all}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            busy ? "bg-card2 text-faint cursor-not-allowed" : "bg-accent text-[#08130C] hover:opacity-90",
          )}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{" "}
          {busy ? "Gerando…" : `Baixar todas (${HIGHLIGHTS.length})`}
        </button>
        <span className="text-[11.5px] text-faint">Clique numa capa pra baixar só ela.</span>
      </div>
      {note ? <div className="mt-2 text-[11.5px] text-neg leading-snug">{note}</div> : null}
    </div>
  );
}

/** Cabeçalho padrão de uma sub-seção da aba. */
function SubHead({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        {icon}
        <h3 className="text-[14px] font-semibold text-text">{title}</h3>
      </div>
      <p className="mb-5 max-w-[640px] text-[13px] leading-relaxed text-muted">{children}</p>
    </>
  );
}

/** Aba "Ads" (super-admin): calendário + peças (stories, posts, carrosséis, destaques) pra divulgar.
 *  Sub-abas sticky (como no painel do usuário) pulam entre as seções; cada peça mostra se já foi
 *  publicada e em que dia (selo lido do calendário). */
export function AdsSection() {
  const supported = canExport();
  return (
    <div>
      <CardSubNav items={SUBNAV} />
      <div className="space-y-10 pt-6">
        <section id="ads-calendario">
          <SubHead icon={<CalendarCheck size={15} className="text-accent" />} title="Calendário de divulgação">
            Marque o que já postou (ou planeje) e acompanhe a cadência. Cada peça tem o botão{" "}
            <b className="text-text">Hoje</b> pra registrar num clique — e mostra um selo{" "}
            <b className="text-text">Publicado</b> com a data quando já foi ao ar.
          </SubHead>
          <AdsCalendar />
        </section>

        <section id="ads-stories">
          <SubHead icon={<Film size={15} className="text-accent" />} title="Stories · MP4 9:16">
            Institucionais (o app e o que faz), com mini-roteiro. Clique em <b className="text-text">MP4</b>:
            a gravação roda a animação em tempo real (~{storyDuration(STORIES[0])}s) e baixa sozinho.
          </SubHead>
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

        <section id="ads-stories-edu">
          <SubHead icon={<GraduationCap size={15} className="text-accent" />} title="Stories educativos · MP4 9:16">
            Conteúdo que ensina (orçamento, reserva, juros compostos…), cada um com foto temática.
            Alternam a autoridade com o institucional.
          </SubHead>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EDU_STORIES.map((st) => (
              <StoryCard key={st.id} story={st} />
            ))}
          </div>
        </section>

        <section id="ads-posts">
          <SubHead icon={<ImageIcon size={15} className="text-accent" />} title="Posts · PNG 4:5">
            Imagens estáticas pro feed (1080×1350), institucionais. Clique em <b className="text-text">PNG</b>{" "}
            e poste direto — o @nossasfinancasapp e o site já vão no rodapé.
          </SubHead>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POSTS.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>

        <section id="ads-posts-edu">
          <SubHead icon={<GraduationCap size={15} className="text-accent" />} title="Posts educativos · PNG 4:5">
            Dica · passo a passo · mito × verdade · conceito · número. Cada um já vem com uma legenda
            que ensina, pronta pra copiar.
          </SubHead>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EDU_POSTS.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>

        <section id="ads-carrosseis">
          <SubHead icon={<GalleryHorizontalEnd size={15} className="text-accent" />} title="Carrosséis · PNG 4:5 (várias imagens)">
            Vários slides numa publicação. Clique em <b className="text-text">PNGs</b> e o navegador salva
            uma imagem por slide, numeradas — no Instagram, crie um post e selecione todas.
          </SubHead>
          <div className="grid gap-4 sm:grid-cols-2">
            {CAROUSELS.map((c) => (
              <CarouselCard key={c.id} carousel={c} />
            ))}
          </div>
          <div className="mb-4 mt-7 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            Educativos — passo a passo
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {EDU_CAROUSELS.map((c) => (
              <CarouselCard key={c.id} carousel={c} />
            ))}
          </div>
        </section>

        <section id="ads-destaques">
          <SubHead icon={<Circle size={15} className="text-accent" />} title="Capas de destaque">
            Capas pros seus Destaques. No Instagram: <b className="text-text">perfil → Destaques → Editar
            → Capa → escolher da galeria</b>. Ele mostra só o círculo (o ícone); o nome você digita no
            próprio destaque. Sob cada capa está quais stories agrupar nela.
          </SubHead>
          <HighlightsBlock />
        </section>
      </div>
    </div>
  );
}

export function AdsSummary() {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-muted">
      <Film size={15} className="text-accent" />
      <span className="tabular">
        {STORIES.length + EDU_STORIES.length} stories · {POSTS.length + EDU_POSTS.length} posts · {CAROUSELS.length + EDU_CAROUSELS.length} carrosséis
      </span>
    </span>
  );
}
