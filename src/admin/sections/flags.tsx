import { useState } from "react";
import { adminApi } from "../api";
import { useAsync } from "../use-admin";
import { AdminCard, StateBlock } from "../components";
import { HeaderKpis, HeaderKpi } from "@/components/common/header-kpis";
import { cn } from "@/lib/utils";

/** Flags de funcionalidade (só admin). Hoje: cotação ao vivo paga (Pro Investidor). */
export function FlagsSection() {
  const { data, error, loading, reload } = useAsync(() => adminApi.getFlag("quotes_live"), []);
  const [busy, setBusy] = useState(false);
  const on = data === true;

  const toggle = async () => {
    setBusy(true);
    try {
      await adminApi.setFlag("quotes_live", !on);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminCard title="Cotação ao vivo (paga)">
      <StateBlock loading={loading} error={error}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">Cotação automática pros assinantes do Pro Investidor</div>
            <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-faint">
              Uma só chave liga as DUAS fontes: <b className="text-muted">B3 (brapi)</b> + <b className="text-muted">internacional (Finnhub)</b>.
              {" "}<b className="text-muted">OFF</b>: cotação automática só na sua conta (free). <b className="text-muted">ON</b>: quem assina o Pro
              Investidor também recebe. <b className="text-muted">Só ligue depois de assinar os planos PAGOS</b> da brapi e do Finnhub (licença comercial).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={() => void toggle()}
            title={on ? "Desligar cotação paga" : "Ligar cotação paga"}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
              on ? "bg-accent" : "bg-border-strong",
            )}
          >
            <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
          </button>
        </div>
      </StateBlock>
    </AdminCard>
  );
}

/** Resumo p/ o cabeçalho do accordion. */
export function FlagsSummary() {
  const { data } = useAsync(() => adminApi.getFlag("quotes_live"), []);
  return (
    <HeaderKpis>
      <HeaderKpi label="cotação ao vivo" value={data ? "ON" : "OFF"} raw />
    </HeaderKpis>
  );
}
