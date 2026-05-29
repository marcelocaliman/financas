"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Saved Views — persiste combinações de filtros (kind + q) em localStorage,
 * com um nome amigável. Útil pra checagens recorrentes ("delivery" → busca q
 * + categoria delivery, etc).
 *
 * Persistência local (sem backend) — fica por device, não compartilha entre
 * usuários. Suficiente pro caso de uso: cada um tem suas views.
 *
 * Storage key: `financas:txn-views:v1`
 */
type View = {
  id: string;
  name: string;
  kind: string; // "all" | "income" | "expense" | "transfer"
  q: string;
};

const STORAGE_KEY = "financas:txn-views:v1";

function loadViews(): View[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as View[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveViews(views: View[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function SavedViews() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [views, setViews] = useState<View[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    // localStorage só está disponível no client. Hidratamos uma vez depois
    // do mount — server inicial sempre renderiza [].
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViews(loadViews());
  }, []);

  const currentKind = searchParams.get("kind") ?? "all";
  const currentQ = searchParams.get("q") ?? "";
  const hasAnyFilter = currentKind !== "all" || currentQ.length > 0;

  const apply = (v: View) => {
    const sp = new URLSearchParams();
    if (v.kind && v.kind !== "all") sp.set("kind", v.kind);
    if (v.q) sp.set("q", v.q);
    router.push(`${pathname}?${sp.toString()}`);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Dê um nome pra view.");
      return;
    }
    const v: View = {
      id: crypto.randomUUID(),
      name: name.trim(),
      kind: currentKind,
      q: currentQ,
    };
    const next = [...views, v];
    setViews(next);
    saveViews(next);
    toast.success(`View "${v.name}" salva.`);
    setName("");
    setOpen(false);
  };

  const handleDelete = async (v: View) => {
    const ok = await confirm({
      title: `Apagar view "${v.name}"?`,
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    const next = views.filter((x) => x.id !== v.id);
    setViews(next);
    saveViews(next);
  };

  if (views.length === 0 && !hasAnyFilter) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint-foreground font-medium mr-1 inline-flex items-center gap-1">
        <Star className="w-3 h-3" strokeWidth={1.7} />
        Views
      </span>

      {views.map((v) => {
        const isCurrent = v.kind === currentKind && v.q === currentQ;
        return (
          <div key={v.id} className="inline-flex items-center">
            <button
              type="button"
              onClick={() => apply(v)}
              className={
                "inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-l-[7px] border text-[12px] transition-colors " +
                (isCurrent
                  ? "bg-navy-50 dark:bg-navy-700/10 border-navy-700/30 text-navy-700 dark:text-navy-300"
                  : "bg-surface-muted border-border text-foreground hover:bg-bone-100 dark:hover:bg-ink-700")
              }
            >
              {v.name}
            </button>
            <Tooltip content={`Apagar view "${v.name}"`}>
              <button
                type="button"
                onClick={() => handleDelete(v)}
                className="inline-flex items-center px-1.5 py-1 rounded-r-[7px] border border-l-0 border-border bg-surface-muted text-faint-foreground hover:text-rust-600 transition-colors"
                aria-label={`Apagar view ${v.name}`}
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.7} />
              </button>
            </Tooltip>
          </div>
        );
      })}

      {hasAnyFilter ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          + Salvar view atual
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!w-[min(440px,calc(100vw-32px))]">
          <DialogHeader title="Salvar combinação de filtros" />
          <p className="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
            Vai ficar na lista de views e fica salvo nesse dispositivo (não
            compartilha entre você e sua parceira).
          </p>
          <div>
            <Label htmlFor="view-name">Nome</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: delivery, gasolina, dividendos do mês"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
