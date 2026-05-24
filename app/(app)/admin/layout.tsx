import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/services/platform-admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

/**
 * Layout das páginas de superadmin.
 * Guard server-side: qualquer não-admin → /dashboard.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isPlatformAdmin();
  if (!ok) redirect("/dashboard");

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-6 -mx-4 sm:mx-0">
      <AdminSidebar />
      <div className="min-w-0 px-4 sm:px-0">{children}</div>
    </div>
  );
}
