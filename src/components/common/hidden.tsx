import type { ReactNode } from "react";
import { useUI } from "@/store/ui";
import { MONEY_MASK } from "./money";

/**
 * Oculta conteúdo sensível (porcentagens, variações, progresso…) quando o modo
 * privacidade está ligado — o mesmo mascaramento do componente Money, para coerência.
 * Use em valores que NÃO são <Money> (ex.: rentabilidade %, FIRE %, taxa de poupança).
 */
export function Hidden({ children, mask = MONEY_MASK }: { children: ReactNode; mask?: string }) {
  const hidden = useUI((s) => s.numbersHidden);
  return <>{hidden ? mask : children}</>;
}
