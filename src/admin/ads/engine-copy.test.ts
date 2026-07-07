import { describe, it, expect } from "vitest";
import { STORIES, EDU_STORIES, REEL_COPY, REEL_COVER } from "./engine";

// Invariante de alinhamento: TODO vídeo (Story/EduStory que vira Reel) precisa ter capa (REEL_COVER)
// E legenda (REEL_COPY). Sem isso, o card do Reel fica sem "Capa" ou sem "Copiar legenda" e a série
// perde consistência. Este teste trava regressões quando alguém adiciona um story novo.
const ALL = [...STORIES, ...EDU_STORIES];

describe("alinhamento das peças (reels)", () => {
  it("todo story tem capa (REEL_COVER) e legenda (REEL_COPY)", () => {
    const semCapa = ALL.filter((s) => !REEL_COVER[s.id]).map((s) => s.id);
    const semLegenda = ALL.filter((s) => !REEL_COPY[s.id]).map((s) => s.id);
    expect(semCapa, `stories sem capa: ${semCapa.join(", ")}`).toEqual([]);
    expect(semLegenda, `stories sem legenda: ${semLegenda.join(", ")}`).toEqual([]);
  });

  it("capa e legenda não têm sobras órfãs (id que não existe mais)", () => {
    const ids = new Set(ALL.map((s) => s.id));
    const capaOrfa = Object.keys(REEL_COVER).filter((id) => !ids.has(id));
    const legendaOrfa = Object.keys(REEL_COPY).filter((id) => !ids.has(id));
    expect(capaOrfa, `capas órfãs: ${capaOrfa.join(", ")}`).toEqual([]);
    expect(legendaOrfa, `legendas órfãs: ${legendaOrfa.join(", ")}`).toEqual([]);
  });

  it("toda capa tem eyebrow e 1–3 linhas de título", () => {
    for (const [id, c] of Object.entries(REEL_COVER)) {
      expect(c.eyebrow, `${id}: eyebrow vazio`).toBeTruthy();
      expect(c.title.length, `${id}: título fora de 1–3 linhas`).toBeGreaterThan(0);
      expect(c.title.length).toBeLessThanOrEqual(3);
    }
  });
});
