import { create } from "zustand";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/** Estado aberto/fechado dos accordions das seções (não persiste). */
interface SectionsState {
  open: Record<string, boolean>;
  setOpen: (id: string, v: boolean) => void;
  /** Define o estado de vários ids de uma vez (abrir/fechar tudo). */
  setMany: (ids: string[], v: boolean) => void;
}

// Seções do PAINEL (accordions) em modo "ABA ÚNICA": abrir uma fecha as outras. O "painel"
// é o hero (não é accordion), por isso fica de fora. A Config/admin usam outros ids e seguem
// multi-aberta. Tudo que abre uma seção passa por setOpen, então a regra vale em todo lugar
// (clique no cabeçalho, item do menu, rodapé).
const EXCLUSIVE = new Set(NAV_ITEMS.slice(1).map((n) => n.id));

export const useSections = create<SectionsState>((set) => ({
  open: {},
  setOpen: (id, v) =>
    set((s) => {
      if (v && EXCLUSIVE.has(id)) {
        const open: Record<string, boolean> = { ...s.open };
        EXCLUSIVE.forEach((x) => {
          open[x] = x === id;
        });
        return { open };
      }
      return { open: { ...s.open, [id]: v } };
    }),
  setMany: (ids, v) =>
    set((s) => ({ open: { ...s.open, ...Object.fromEntries(ids.map((id) => [id, v])) } })),
}));
