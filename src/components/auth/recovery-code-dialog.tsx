import { useState } from "react";
import { ShieldAlert, Copy, Check } from "lucide-react";
import { useVault } from "@/vault/vault-store";
import { Panel } from "@/components/common/panel";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");

/**
 * Mostrado UMA vez, logo após a criação do cofre. Exige que o usuário confirme
 * que salvou o código (re-digitando) — é a ÚNICA forma de recuperar o cofre se
 * esquecer a senha. Some-o-código só depois da confirmação.
 */
export function RecoveryCodeDialog() {
  const code = useVault((s) => s.recoveryCodeOnce);
  const dismiss = useVault((s) => s.dismissRecoveryCode);
  const [confirm, setConfirm] = useState("");
  const [copied, setCopied] = useState(false);

  if (!code) return null;
  const matches = norm(confirm) === norm(code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-md">
        <Panel className="p-6">
          <div className="flex items-center gap-2 text-teal mb-2">
            <ShieldAlert size={20} strokeWidth={1.8} />
            <h2 className="text-[16px] font-bold text-text">Guarde seu código de recuperação</h2>
          </div>
          <p className="text-[13px] text-muted leading-relaxed">
            É a <b className="text-text">única</b> forma de recuperar seus dados se você esquecer a
            senha. Não dá pra recuperar por e-mail. Guarde num gerenciador de senhas ou no papel.
          </p>

          <div className="mt-4 rounded-[10px] bg-bg border border-border p-4 flex items-center justify-between gap-3">
            <code className="font-mono text-[14px] tracking-[0.04em] text-text break-all">{code}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 inline-flex items-center gap-1 text-[12px] text-muted hover:text-text"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <label className="block mt-4">
            <span className="block text-[12px] text-muted font-medium mb-1">
              Cole/digite o código pra confirmar que salvou
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="XXXXX-XXXXX-…"
              className="w-full h-10 px-3 rounded-[8px] border border-border bg-card text-[14px] outline-none focus:border-teal"
            />
          </label>

          <button
            type="button"
            disabled={!matches}
            onClick={dismiss}
            className={cn(
              "mt-4 w-full h-10 rounded-[8px] font-semibold text-[14px] transition-opacity",
              matches ? "bg-teal text-[#04140d]" : "bg-border text-faint cursor-not-allowed",
            )}
          >
            Salvei — continuar
          </button>
        </Panel>
      </div>
    </div>
  );
}
