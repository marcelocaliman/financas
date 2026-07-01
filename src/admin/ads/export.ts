// Grava um story (canvas 1080×1920) em VÍDEO via MediaRecorder — MP4 quando o navegador suporta
// (Chrome recente, Safari), senão WebM. Captura em tempo real (captureStream do canvas). Só o dono
// usa isso (aba Ads do super-admin), então rodar ~9s de gravação na máquina dele é aceitável.
import { drawStory, storyDuration, type Story } from "./engine";

const MIME_CANDS = [
  "video/mp4;codecs=avc1.640028",
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickMime(): string {
  for (const m of MIME_CANDS) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignora e tenta a próxima */
    }
  }
  return "";
}

/** Suporte a exportar vídeo (MediaRecorder + captureStream do canvas). */
export function canExport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** Garante que Inter + JetBrains Mono estejam carregadas antes de desenhar no canvas. */
async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("600 120px Inter"),
      document.fonts.load("400 40px Inter"),
      document.fonts.load('600 40px "JetBrains Mono"'),
      document.fonts.load('500 40px "JetBrains Mono"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* segue com fallback de fonte */
  }
}

export interface ExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
  mime: string;
}

export async function exportStory(story: Story): Promise<ExportResult> {
  await ensureFonts();
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");

  drawStory(ctx, story, 0, W, H); // 1º quadro antes de gravar (evita frame preto)
  const mime = pickMime();
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 9_000_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((res) => {
    rec.onstop = () => res();
  });

  const dur = storyDuration(story);
  rec.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= dur) {
        drawStory(ctx, story, dur - 0.01, W, H);
        resolve();
        return;
      }
      drawStory(ctx, story, t, W, H);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await new Promise((r) => setTimeout(r, 140)); // deixa o último quadro entrar
  rec.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  await stopped;

  const type = mime || "video/webm";
  const blob = new Blob(chunks, { type });
  return { blob, ext: type.includes("mp4") ? "mp4" : "webm", mime: type };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
