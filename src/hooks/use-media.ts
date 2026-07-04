import { useEffect, useState } from "react";

/** Reage a uma media query (ex.: largura). SSR-safe (assume desktop antes do mount). */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** True em telas de celular (abaixo do breakpoint `sm` do Tailwind). */
export const useIsMobile = () => useMediaQuery("(max-width: 639px)");
