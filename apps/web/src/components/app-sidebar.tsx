"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Calendar,
  Video,
  BookOpen,
  DollarSign,
  FileSignature,
  Award,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@axle/ui";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "고객관리", icon: Users },
  { href: "/projects", label: "프로젝트", icon: FolderKanban },
  { href: "/documents", label: "서류", icon: FileText },
  { href: "/programs", label: "지원사업", icon: Award },
  { href: "/matching", label: "매칭 분석", icon: Sparkles },
  { href: "/calendar", label: "일정", icon: Calendar },
  { href: "/meetings", label: "미팅", icon: Video },
  { href: "/journal", label: "연구일지", icon: BookOpen },
  { href: "/finance", label: "재무", icon: DollarSign },
  { href: "/contracts", label: "견적/계약", icon: FileSignature },
];

interface AppSidebarProps {
  userMenu: React.ReactNode;
}

export function AppSidebar({ userMenu }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">AXLE</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="block">
                <SidebarItem
                  active={isActive}
                  icon={<Icon size={18} />}
                  label={item.label}
                />
              </Link>
            );
          })}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>{userMenu}</SidebarFooter>
    </Sidebar>
  );
}
