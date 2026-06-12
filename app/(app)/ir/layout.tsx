import { redirect } from "next/navigation";
import { isIrEnabled } from "@/services/ir-flag";

/**
 * Guard de toda a árvore /ir. Se o IRPF estiver desligado pro household
 * (households.ir_enabled = false), redireciona — cobre /ir e todas as
 * subpáginas (/ir/[year], configuracoes, revisao, auditoria) de uma vez.
 * Reversível: religar ir_enabled traz tudo de volta intacto.
 */
export default async function IrLayout({ children }: { children: React.ReactNode }) {
  if (!(await isIrEnabled())) redirect("/dashboard");
  return <>{children}</>;
}
