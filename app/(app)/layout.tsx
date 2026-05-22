import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getCurrentUserContext } from "@/services/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <Sidebar
        user={{ name: ctx.profile.display_name, email: ctx.email }}
        householdName={ctx.household.name}
      />
      <div className="flex-1 min-w-0 relative">
        <main className="max-w-[1320px] mx-auto px-5 sm:px-10 lg:px-14 pt-8 pb-28 lg:pb-20">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
