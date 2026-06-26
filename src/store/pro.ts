import { create } from "zustand";
import type { ProSubscription } from "@/lib/pro-api";

/** Estado Pro (sessão) + controle do diálogo de assinatura (paywall).
 *  isPro vem do servidor (is_pro RPC; admin é sempre Pro). É METADADO — sem dado financeiro.
 *  O gate é validado também no servidor em cada feature paga; isto é só a UI. */
interface ProState {
  resolved: boolean; // já checou no servidor nesta sessão
  isPro: boolean;
  sub: ProSubscription | null;
  /** diálogo de assinatura (Stripe) — implementado na Fase B */
  paywallOpen: boolean;
  paywallFeature: string | null;
  setPro: (isPro: boolean, sub: ProSubscription | null) => void;
  resetPro: () => void;
  openPaywall: (feature?: string) => void;
  closePaywall: () => void;
}

export const useProStore = create<ProState>((set) => ({
  resolved: false,
  isPro: false,
  sub: null,
  paywallOpen: false,
  paywallFeature: null,
  setPro: (isPro, sub) => set({ isPro, sub, resolved: true }),
  resetPro: () => set({ resolved: false, isPro: false, sub: null }),
  openPaywall: (feature) => set({ paywallOpen: true, paywallFeature: feature ?? null }),
  closePaywall: () => set({ paywallOpen: false }),
}));
