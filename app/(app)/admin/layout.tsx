import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/services/platform-admin";

/**
 * Layout das páginas de superadmin.
 * Guard server-side: qualquer não-admin → /dashboard.
 *
 * Sem sidebar própria — a sidebar principal detecta o pathname `/admin`
 * e troca seu conteúdo (slide animation) pra exibir nav do admin.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isPlatformAdmin();
  if (!ok) redirect("/dashboard");
  return <>{children}</>;
}
