import { redirect } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { AppSidebar } from "../../src/components/app-sidebar";
import { UserMenu } from "../../src/components/user-menu";

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
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="container mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
