import { useEffect, useRef, useState, useCallback } from "react";
import { useVault } from "@/vault/vault-store";
import { adminApi } from "./api";

/** E-mail do super-admin de bootstrap (fast-path da UI; a segurança REAL é o is_admin()
 *  do servidor, checado em todo RPC). */
const BOOTSTRAP_ADMIN = "marcelo.salgado.caliman@gmail.com";

let cached: boolean | null = null;

/** Caller é admin? Confirma no servidor (RPC is_admin) e cacheia por sessão. */
export function useIsAdmin(): boolean {
  const email = useVault((s) => s.email);
  const status = useVault((s) => s.status);
  const [isAdmin, setIsAdmin] = useState<boolean>(cached ?? false);

  useEffect(() => {
    if (status !== "unlocked") return;
    if (cached !== null) {
      setIsAdmin(cached);
      return;
    }
    let alive = true;
    adminApi
      .isAdmin()
      .then((ok) => {
        cached = !!ok;
        if (alive) setIsAdmin(cached);
      })
      .catch(() => {
        // fallback otimista pelo e-mail conhecido (o servidor ainda barra quem não for)
        cached = email === BOOTSTRAP_ADMIN ? true : false;
        if (alive) setIsAdmin(cached);
      });
    return () => {
      alive = false;
    };
  }, [status, email]);

  return isAdmin;
}

/** Hook genérico de carregamento assíncrono p/ as seções do painel. Com `refreshMs`,
 *  re-busca em segundo plano (silencioso, sem piscar o loading) — usado pelas seções
 *  "ao vivo". */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  opts?: { refreshMs?: number },
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const refreshMs = opts?.refreshMs;

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    const run = (silent: boolean) => {
      if (!silent) setLoading(true);
      setError(null);
      fnRef
        .current()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch((e: unknown) => {
          if (alive) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (alive && !silent) setLoading(false);
        });
    };
    run(false);
    const id = refreshMs ? setInterval(() => run(true), refreshMs) : undefined;
    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, refreshMs]);

  return { data, error, loading, reload };
}
