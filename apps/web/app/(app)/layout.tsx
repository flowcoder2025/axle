import { redirect } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { AppSidebar } from "../../src/components/app-sidebar";
import { UserMenu } from "../../src/components/user-menu";
import { NotificationBell } from "../../src/components/notifications/notification-bell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        userMenu={
          <UserMenu
            name={user.name}
            email={user.email}
            image={user.image}
          />
        }
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-end border-b bg-background px-4">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
