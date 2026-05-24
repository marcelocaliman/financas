"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  completeAccountantProfile,
  type AccountantFormState,
} from "@/services/accountant.actions";

export function OnboardingForm({
  email,
  dpaText,
}: {
  email: string;
  dpaText: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    AccountantFormState | undefined,
    FormData
  >(completeAccountantProfile, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Perfil criado. Bem-vindo!");
      router.push("/contador");
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-4">
        <Field label="Nome completo" htmlFor="full_name" required>
          <Input id="full_name" name="full_name" required placeholder="João da Silva" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" defaultValue={email} disabled readOnly />
        </Field>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Field label="CRC (opcional)" htmlFor="crc_number" hint="ex.: 123456">
          <Input id="crc_number" name="crc_number" placeholder="123456" />
        </Field>
        <Field label="UF do CRC" htmlFor="crc_state" hint="MG, SP, RJ…">
          <Input id="crc_state" name="crc_state" maxLength={2} placeholder="MG" />
        </Field>
        <Field label="Telefone" htmlFor="phone" hint="opcional">
          <Input id="phone" name="phone" placeholder="(11) 99999-9999" />
        </Field>
      </div>

      <div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint-foreground font-medium mb-2">
          Termo de tratamento de dados (LGPD)
        </div>
        <pre className="text-[11.5px] leading-relaxed text-muted-foreground bg-surface-muted/40 border border-border rounded-[8px] p-4 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans">
{dpaText}
        </pre>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          id="accepted_dpa"
          name="accepted_dpa"
          required
          className="mt-0.5 accent-navy-700"
        />
        <span className="text-[13px] text-foreground">
          Li e aceito o termo de tratamento de dados acima. Entendo que cada
          visualização e download fica registrado e visível ao titular dos
          dados, e que posso ter meu acesso revogado a qualquer momento.
        </span>
      </label>

      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Criando perfil…" : "Criar perfil e continuar"}
        </Button>
      </div>
    </form>
  );
}
