import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ConsoleNav } from "@/components/admin/ConsoleNav";
import { Footer } from "@/components/ui/Chrome";
import { AdminBackground } from "@/components/ui/AdminBackground";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="relative flex min-h-screen flex-col bg-[#020408]">
      <AdminBackground />
      <div className="relative z-10 flex flex-col min-h-screen">
        <ConsoleNav />
        <main className="relative flex-1">{children}</main>
        <Footer status="console · ok" />
      </div>
    </div>
  );
}
