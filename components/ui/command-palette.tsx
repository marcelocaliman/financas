"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Home,
  ArrowLeftRight,
  Wallet,
  Package,
  Repeat,
  Target,
  Flame,
  CreditCard,
  Landmark,
  Tag,
  Users,
  Settings,
  RefreshCw,
  Plus,
  FileText,
  Layers,
  HandCoins,
  LineChart,
  Bell,
} from "lucide-react";

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string;
};

/**
 * Command palette estilo Linear/Notion. Cmd+K abre, digita pra filtrar,
 * Enter executa. Setas pra navegar.
 *
 * Faz match fuzzy simples (todas as letras do query aparecem em ordem na label).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      // Navegação
      { id: "home", label: "Home", icon: <Home className="w-3.5 h-3.5" />, action: () => router.push("/dashboard") },
      { id: "tx", label: "Transações", icon: <ArrowLeftRight className="w-3.5 h-3.5" />, action: () => router.push("/transacoes") },
      { id: "rec", label: "Recorrentes", icon: <Repeat className="w-3.5 h-3.5" />, action: () => router.push("/recorrentes") },
      { id: "ass", label: "Assinaturas", icon: <RefreshCw className="w-3.5 h-3.5" />, action: () => router.push("/assinaturas") },
      { id: "ana", label: "Análise", icon: <LineChart className="w-3.5 h-3.5" />, action: () => router.push("/analise") },
      { id: "rel", label: "Relatórios", icon: <FileText className="w-3.5 h-3.5" />, action: () => router.push("/relatorios") },
      { id: "ir", label: "IRPF", icon: <Landmark className="w-3.5 h-3.5" />, action: () => router.push("/ir") },
      { id: "inv", label: "Investimentos", icon: <Wallet className="w-3.5 h-3.5" />, action: () => router.push("/investimentos") },
      { id: "invenc", label: "Investimentos encerrados", icon: <Wallet className="w-3.5 h-3.5" />, action: () => router.push("/investimentos/encerrados") },
      { id: "invmov", label: "Movimentações de investimentos", icon: <Wallet className="w-3.5 h-3.5" />, action: () => router.push("/investimentos/movimentacoes") },
      { id: "pat", label: "Patrimônio", icon: <Package className="w-3.5 h-3.5" />, action: () => router.push("/patrimonio") },
      { id: "div", label: "Dívidas", icon: <HandCoins className="w-3.5 h-3.5" />, action: () => router.push("/dividas") },
      { id: "res", label: "Resgates", icon: <Layers className="w-3.5 h-3.5" />, action: () => router.push("/resgates") },
      { id: "met", label: "Metas", icon: <Target className="w-3.5 h-3.5" />, action: () => router.push("/metas") },
      { id: "ind", label: "Independência financeira", icon: <Flame className="w-3.5 h-3.5" />, action: () => router.push("/independencia"), keywords: "fire" },
      { id: "con", label: "Contas", icon: <CreditCard className="w-3.5 h-3.5" />, action: () => router.push("/contas") },
      { id: "cat", label: "Categorias", icon: <Tag className="w-3.5 h-3.5" />, action: () => router.push("/categorias") },
      { id: "dec", label: "Declarantes", icon: <Users className="w-3.5 h-3.5" />, action: () => router.push("/declarantes") },
      { id: "cfg", label: "Configurações", icon: <Settings className="w-3.5 h-3.5" />, action: () => router.push("/configuracoes") },
      { id: "not", label: "Notificações", icon: <Bell className="w-3.5 h-3.5" />, action: () => router.push("/configuracoes/notificacoes") },
      // Ações
      {
        id: "new-tx",
        label: "Nova transação",
        hint: "Atalho ⌘+Shift+T",
        icon: <Plus className="w-3.5 h-3.5" />,
        action: () => {
          // Dispara evento global que o QuickAddProvider escuta
          window.dispatchEvent(new CustomEvent("financas:quick-add"));
        },
      },
    ],
    [router],
  );

  // Fuzzy match: letras do query aparecem na label em ordem
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.label} ${c.keywords ?? ""}`.toLowerCase();
      let i = 0;
      for (const ch of q) {
        const found = hay.indexOf(ch, i);
        if (found === -1) return false;
        i = found + 1;
      }
      return true;
    });
  }, [commands, query]);

  // Abre com Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const handleSelect = (cmd: Command) => {
    cmd.action();
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIdx]) handleSelect(filtered[activeIdx]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[520px] rounded-[12px] bg-surface border border-border-strong shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="w-4 h-4 text-faint-foreground" strokeWidth={1.7} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pra onde? (digite pra filtrar)"
            className="flex-1 py-3 bg-transparent outline-none text-[14px] text-foreground placeholder:text-faint-foreground"
          />
          <kbd className="font-mono text-[10px] text-faint-foreground px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              Nada bateu com &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  i === activeIdx ? "bg-surface-muted" : ""
                }`}
              >
                <span className="text-muted-foreground">{cmd.icon}</span>
                <span className="text-[13.5px] text-foreground flex-1">{cmd.label}</span>
                {cmd.hint ? (
                  <span className="font-mono text-[10.5px] text-faint-foreground">
                    {cmd.hint}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-bone-100/30 dark:bg-ink-800/30">
          <div className="flex items-center gap-3 text-[10.5px] font-mono text-faint-foreground">
            <span>
              <kbd className="px-1 border border-border rounded">↑↓</kbd> navegar
            </span>
            <span>
              <kbd className="px-1 border border-border rounded">↵</kbd> abrir
            </span>
          </div>
          <span className="font-mono text-[10.5px] text-faint-foreground">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
