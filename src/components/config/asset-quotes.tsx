import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { usePatrimonio } from "@/hooks/use-patrimonio";
import { useQuotes } from "@/store/quotes";
import { actions } from "@/data/actions";
import { cn } from "@/lib/utils";

function ago(ts: number | null): string {
  if (!ts) return "nunca";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** Cotação de ativos (brapi): token cifrado + atualização do valor das posições. */
export function AssetQuotes() {
  const settings = useSettings();
  const data = usePatrimonio();
  const updatedAt = useQuotes((s) => s.updatedAt);
  const status = useQuotes((s) => s.status);

  const [token, setToken] = useState(settings.brapiToken ?? "");
  useEffect(() => setToken(settings.brapiToken ?? ""), [settings.brapiToken]);

  const saved = (settings.brapiToken ?? "") === token.trim();
  const quotable = data?.assets.filter((a) => a.ticker && (a.quantity ?? 0) > 0).length ?? 0;

  const saveToken = () =>
    void actions.putSettings({ ...settings, brapiToken: token.trim() || undefined });
  const refresh = () => {
    if (token.trim() && data) void useQuotes.getState().refresh(token.trim(), data.assets, true);
  };

  return (
    <div className="max-w-xl mt-10 pt-8 border-t border-border">
      <div className="text-[14px] font-semibold mb-1">Cotação de ativos (brapi)</div>
      <p className="text-[12px] text-faint mb-4 leading-relaxed">
        Cole seu token da brapi. Ele fica <span className="text-muted">cifrado</span> junto dos seus
        dados; o navegador chama a brapi direto — nosso servidor não vê o token nem seus ativos.
        Ativos com <span className="text-muted">ticker + quantidade</span> passam a ter o valor
        atualizado sozinho (quantidade × cotação do dia).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveToken();
          }}
          placeholder="Token brapi"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-[200px] h-9 px-3 rounded-[8px] border border-border bg-card text-[13.5px] outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={saveToken}
          disabled={saved}
          className="h-9 px-3.5 rounded-[8px] bg-accent text-[#0A0B0D] text-[13px] font-semibold hover:brightness-105 transition disabled:opacity-50"
        >
          {saved ? "Salvo" : "Salvar"}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p className="text-[12px] text-faint">
          {quotable} {quotable === 1 ? "ativo com ticker" : "ativos com ticker"} · atualizado {ago(updatedAt)}
          {status === "error" ? <span className="text-neg"> · falha ao atualizar</span> : null}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={!token.trim() || status === "loading"}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] border border-border text-[12.5px] text-muted hover:text-text hover:bg-card-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(status === "loading" && "animate-spin")} />
          Atualizar cotações
        </button>
      </div>

      <a
        href="https://brapi.dev/dashboard"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 mt-4 text-[12px] text-accent hover:underline"
      >
        Pegar um token grátis na brapi <ExternalLink size={12} />
      </a>
    </div>
  );
}
