import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/services/auth";
import { env } from "@/lib/env";
import { CancelDeletionButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export default async function ContaExcluindoPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  // Conta ativa não deveria estar aqui.
  if (ctx.profile.is_active !== false) redirect("/dashboard");

  const since = ctx.profile.deactivated_at ? new Date(ctx.profile.deactivated_at) : null;
  const grace = env.LGPD_DELETION_GRACE_DAYS;
  const deleteOn = since ? new Date(since.getTime() + grace * 86_400_000) : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-rust-600">
          Conta agendada para exclusão
        </div>
        <h1 className="font-display text-[24px] tracking-[-0.02em] text-foreground mt-3">
          Sua conta está em período de arrependimento
        </h1>
        <p className="text-[13.5px] text-muted-foreground mt-2 leading-relaxed">
          Pedimos a exclusão dos seus dados. Você tem {grace} dias pra mudar de ideia
          {deleteOn
            ? ` — a exclusão definitiva acontece em ${deleteOn.toLocaleDateString("pt-BR")}.`
            : "."}{" "}
          Até lá, o app fica bloqueado. Depois disso, os dados são apagados sem volta.
        </p>
        <div className="mt-6">
          <CancelDeletionButton />
        </div>
      </div>
    </div>
  );
}
