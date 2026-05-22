"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resetHouseholdData } from "@/services/danger.actions";

export function ResetDataSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const canConfirm = confirmText.trim().toUpperCase() === "APAGAR";

  const handleReset = () => {
    startTransition(async () => {
      const r = await resetHouseholdData();
      if (r.error) toast.error(r.error);
      else {
        toast.success("Dados apagados. Bem-vindo de volta ao zero.");
        setOpen(false);
        setConfirmText("");
        // Força recarregar pra remover tudo da tela
        setTimeout(() => window.location.assign("/dashboard"), 600);
      }
    });
  };

  return (
    <>
      <p className="text-[13.5px] text-muted-foreground leading-relaxed mb-3">
        Apaga <b className="text-foreground">tudo</b> que está nesse lar: contas, transações,
        ativos, lotes, regras de saque, metas e bens físicos. Categorias padrão são re-semeadas.
        Seu usuário e o lar continuam existindo.
      </p>
      <p className="text-[12.5px] text-rust-600 mb-4">
        Operação irreversível. Use só pra refazer testes do zero.
      </p>
      <Button variant="outline" onClick={() => setOpen(true)} className="!text-rust-600 !border-rust-600/40 hover:!bg-rust-100 dark:hover:!bg-rust-700/20">
        Apagar todos os dados
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setConfirmText("");
        }}
      >
        <DialogContent>
          <DialogHeader
            eyebrow="Reset definitivo"
            title="Apagar tudo deste lar."
            description="Última camada de proteção. Digite APAGAR no campo abaixo pra confirmar."
          />

          <div className="rounded-[10px] bg-rust-100 dark:bg-rust-700/20 border border-rust-600/30 px-4 py-3 mb-4 space-y-1.5 text-[12.5px]">
            <p className="text-rust-700 dark:text-rust-500 font-medium">
              O que será apagado:
            </p>
            <ul className="text-rust-700 dark:text-rust-500 list-disc list-inside leading-relaxed">
              <li>Todas as contas, transações e saldos</li>
              <li>Investimentos, lotes, rendimentos, regras de saque</li>
              <li>Metas, bens físicos, lembretes pendentes</li>
              <li>Categorias customizadas (as 15 padrão voltam)</li>
            </ul>
            <p className="text-rust-700 dark:text-rust-500 text-[11.5px] mt-2">
              Seu perfil e o lar continuam intactos.
            </p>
          </div>

          <Field
            label="Digite APAGAR pra confirmar"
            htmlFor="confirm-reset"
          >
            <Input
              id="confirm-reset"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="APAGAR"
              autoComplete="off"
              autoFocus
              className="font-mono uppercase tracking-[0.1em]"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!canConfirm || pending}
              onClick={handleReset}
            >
              {pending ? "Apagando…" : "Apagar tudo definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
