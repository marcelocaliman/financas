"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, formatMoney } from "@/lib/utils/format";
import { MoneyMask } from "@/components/ui/privacy-provider";
import { deleteMovement } from "@/services/movements.actions";
import type { MovementKind, Tables } from "@/types/database";
import { MovementDialog } from "./movement-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";

type Investment = Tables<"investments">;
type Movement = Tables<"investment_movements">;

const kindLabels: Record<MovementKind, string> = {
  buy: "Compra",
  sell: "Venda",
  dividend: "Provento",
  jcp: "JCP",
  split: "Desdobramento",
  exercise: "Exercício",
  assignment: "Assignment",
  expiration: "Vencimento",
};

export function MovementsSheet({
  open,
  onOpenChange,
  investment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  investment: Investment;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  // Refetch via API REST quando abre
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/movements?investmentId=${investment.id}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { movements: Movement[] };
        if (!cancelled) setMovements(data.movements);
      } catch {
        if (!cancelled) setMovements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Re-roda quando fecha o dialog de novo/edição → garante lista fresca
  }, [open, investment.id, adding, editing]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Excluir esse movimento?",
      description: "Quantidade e preço médio são recalculados.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteMovement(id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Movimento excluído.");
        setMovements((m) => m.filter((x) => x.id !== id));
      }
    });
  };

  const currentQty = Number(investment.quantity ?? 0);
  const isCrypto = investment.asset_type === "crypto";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader
            eyebrow={`Extrato · ${investment.ticker}`}
            title={
              <>
                Histórico de <em className="italic">{investment.ticker}</em>
              </>
            }
            description={`${currentQty.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} ${isCrypto ? "unidades" : "cotas"} no total. Cada lote afeta quantidade e preço médio.`}
          />

          <div className="mb-4">
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Novo movimento
            </Button>
          </div>

          {loading ? (
            <p className="text-[13px] text-muted-foreground italic">Carregando…</p>
          ) : movements.length === 0 ? (
            <p className="text-[13px] text-muted-foreground italic">
              Nenhum movimento ainda. Use o botão acima para registrar compras ou vendas.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <Th>Data</Th>
                  <Th>Tipo</Th>
                  <Th right>Qtd</Th>
                  <Th right>Preço</Th>
                  <Th right>Total</Th>
                  <th className="w-9" />
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-b-0 group">
                    <td className="py-3 font-mono text-[11.5px] text-muted-foreground whitespace-nowrap">
                      {formatDateShort(m.date)}
                    </td>
                    <td className="py-3">
                      <Badge
                        tone={
                          m.kind === "buy"
                            ? "navy"
                            : m.kind === "sell"
                              ? "rust"
                              : "olive"
                        }
                        dot
                      >
                        {kindLabels[m.kind]}
                      </Badge>
                    </td>
                    <td className="text-right font-mono text-[12.5px] whitespace-nowrap">
                      <MoneyMask>
                        {Number(m.quantity).toLocaleString("pt-BR", {
                          maximumFractionDigits: 8,
                        })}
                      </MoneyMask>
                    </td>
                    <td className="text-right font-mono text-[12.5px] text-muted-foreground whitespace-nowrap">
                      <MoneyMask>{formatMoney(m.unit_price)}</MoneyMask>
                    </td>
                    <td className="text-right font-mono text-[12.5px] font-medium whitespace-nowrap">
                      <MoneyMask>{formatMoney(m.total_amount)}</MoneyMask>
                    </td>
                    <td className="text-right pl-2 whitespace-nowrap">
                      <div className="inline-flex items-center gap-0.5">
                        {m.kind === "buy" || m.kind === "sell" ? (
                          <IconButton
                            tooltip="Editar (corrigir valor pago, quantidade…)"
                            disabled={pending}
                            onClick={() => setEditing(m)}
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
                          </IconButton>
                        ) : null}
                        <IconButton
                          tooltip="Excluir movimento"
                          tone="danger"
                          disabled={pending}
                          onClick={() => handleDelete(m.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SheetContent>
      </Sheet>
      <MovementDialog open={adding} onOpenChange={setAdding} investment={investment} />
      <MovementDialog
        open={editing != null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        investment={investment}
        movement={editing}
      />
    </>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground py-2 font-medium ${right ? "text-right pl-2" : "text-left pr-2"}`}
    >
      {children}
    </th>
  );
}
