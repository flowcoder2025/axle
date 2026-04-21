"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@axle/ui";
import {
  LayoutDashboard,
  Users,
  Building2,
  ArrowLeft,
  Menu,
  FileStack,
  ClipboardList,
  Brain,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/platform-admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/platform-admin/users", label: "사용자", icon: Users },
  { href: "/platform-admin/organizations", label: "조직", icon: Building2 },
  { href: "/platform-admin/hwpx-templates", label: "HWPX 템플릿", icon: FileStack },
  {
    href: "/platform-admin/checklist-templates",
    label: "체크리스트 템플릿",
    icon: ClipboardList,
  },
  { href: "/platform-admin/ai-patterns", label: "AI 패턴", icon: Brain },
];

export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="text-sm font-semibold">AXLE Admin</SheetTitle>
        </SheetHeader>
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
                onClick={close}
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
            onClick={close}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50"
          >
            <ArrowLeft className="h-4 w-4" />
            앱으로 돌아가기
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
