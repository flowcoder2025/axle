import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { Toaster } from "@axle/ui";
import { AdminSidebar } from "@/src/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <AdminSidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <div className="md:hidden text-sm font-semibold">AXLE Admin</div>
          <div className="hidden md:block" />
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
