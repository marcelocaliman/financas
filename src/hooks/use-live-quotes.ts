import { useEffect, useState } from "react";
import { useVault } from "@/vault/vault-store";
import { proApi } from "@/lib/pro-api";

let cached: boolean | null = null;

/**
 * Pode receber cotação ao vivo? admin SEMPRE (brapi free, 4×/dia); assinante do Pro
 * Investidor só quando a flag 'quotes_live' estiver ON. Espelha o cache-por-sessão do
 * useIsAdmin/useIsPro (resolve no unlock, zera ao travar).
 */
export function useCanLiveQuotes(): boolean {
  const status = useVault((s) => s.status);
  const [can, setCan] = useState<boolean>(cached ?? false);

  useEffect(() => {
    if (status !== "unlocked") {
      cached = null;
      setCan(false);
      return;
    }
    if (cached != null) {
      setCan(cached);
      return;
    }
    let alive = true;
    proApi
      .canLiveQuotes()
      .then((v) => {
        cached = v;
        if (alive) setCan(v);
      })
      .catch(() => {
        if (alive) setCan(false);
      });
    return () => {
      alive = false;
    };
  }, [status]);

  return can;
}
