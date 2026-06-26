import type { ReactNode } from "react";
import { useIsPro } from "@/hooks/use-pro";
import { ProUpsell } from "./pro-upsell";

/** Envolve uma feature Pro: mostra `children` se Pro; senão o upsell.
 *  Enquanto não resolveu o estado no servidor, renderiza children (otimista — o
 *  servidor barra a ação real de qualquer forma; evita piscar paywall pra quem é Pro). */
export function ProGate({
  children,
  title,
  desc,
  feature,
}: {
  children: ReactNode;
  title?: string;
  desc?: string;
  feature?: string;
}) {
  const { isPro, resolved } = useIsPro();
  if (isPro || !resolved) return <>{children}</>;
  return <ProUpsell title={title} desc={desc} feature={feature} />;
}
