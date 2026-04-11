import { redirect } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { Toaster } from "@axle/ui";
import { AppSidebar } from "../../src/components/app-sidebar";
import { UserMenu } from "../../src/components/user-menu";
import { NotificationBell } from "../../src/components/notifications/notification-bell";
import { MobileSidebar } from "../../src/components/mobile-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const userMenu = (
    <UserMenu name={user.name} email={user.email} image={user.image} />
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <AppSidebar userMenu={userMenu} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          {/* Mobile hamburger — visible only on mobile */}
          <div className="md:hidden">
            <MobileSidebar userMenu={userMenu} />
          </div>
          {/* Spacer for desktop */}
          <div className="hidden md:block" />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
