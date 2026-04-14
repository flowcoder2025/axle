"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Building2, ArrowLeft } from "lucide-react";
import { cn } from "@axle/ui";

const NAV_ITEMS = [
  { href: "/platform-admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/platform-admin/users", label: "사용자", icon: Users },
  { href: "/platform-admin/organizations", label: "조직", icon: Building2 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-semibold tracking-tight">AXLE Admin</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/platform-admin"
              ? pathname === "/platform-admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50"
        >
          <ArrowLeft className="h-4 w-4" />
          앱으로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
