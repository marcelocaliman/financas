import { create } from "zustand";

/**
 * Modo VISITANTE (acesso da família, só-leitura). Setado UMA vez no boot da entrada
 * /share. A UI esconde afordâncias de edição; a garantia dura é o repositório no-op
 * (writes inertes) + a ausência de sessão/endpoint de escrita no servidor.
 */
interface ViewerState {
  viewerMode: boolean;
  ownerLabel: string | null; // rótulo do dono (ex.: e-mail mascarado), opcional
  setViewer: (ownerLabel: string | null) => void;
}

export const useViewer = create<ViewerState>((set) => ({
  viewerMode: false,
  ownerLabel: null,
  setViewer: (ownerLabel) => set({ viewerMode: true, ownerLabel }),
}));
