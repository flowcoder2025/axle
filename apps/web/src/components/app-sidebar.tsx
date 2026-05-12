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
  BarChart3,
  Shield,
  Settings,
  Package,
  type LucideIcon,
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
import type { SidebarSection } from "@axle/core-module-system";

/**
 * Static fallback used when `sections` is empty (no Pack installed yet or
 * the builder failed). Keeps the 12 legacy nav items available so the app
 * never renders a blank rail.
 */
const FALLBACK_NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "고객관리", icon: Users },
  { href: "/projects", label: "프로젝트", icon: FolderKanban },
  { href: "/documents", label: "서류", icon: FileText },
  { href: "/programs", label: "지원사업", icon: Award },
  { href: "/matching", label: "매칭 분석", icon: Sparkles },
  { href: "/calendar", label: "일정", icon: Calendar },
  { href: "/meetings", label: "미팅", icon: Video },
  { href: "/journals", label: "연구일지", icon: BookOpen },
  { href: "/finance", label: "재무", icon: DollarSign },
  { href: "/analytics", label: "분석", icon: BarChart3 },
  { href: "/estimates", label: "견적/계약", icon: FileSignature },
];

/** Icon lookup for the dynamic moduleId → icon mapping. */
const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  customers: Users,
  projects: FolderKanban,
  estimates: FileSignature,
  contracts: FileSignature,
  documents: FileText,
  calendar: Calendar,
  meetings: Video,
  finance: DollarSign,
  analytics: BarChart3,
  programs: Award,
  matching: Sparkles,
  journals: BookOpen,
};

function iconForModule(moduleId: string): LucideIcon {
  return MODULE_ICON_MAP[moduleId] ?? Package;
}

interface AppSidebarProps {
  userMenu: React.ReactNode;
  platformRole?: string;
  /**
   * Dynamic Pack/Module sections from the platform sidebar builder. When this
   * is undefined or empty the static fallback nav renders so the app stays
   * usable for orgs that haven't installed any Pack yet.
   */
  sections?: SidebarSection[];
}

export function AppSidebar({
  userMenu,
  platformRole,
  sections,
}: AppSidebarProps) {
  const pathname = usePathname();
  const useDynamic = Array.isArray(sections) && sections.length > 0;

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-[hsl(var(--sidebar-primary))]">
            <span className="text-[hsl(var(--sidebar-primary))] text-sm font-extrabold">A</span>
          </div>
          <span className="text-[hsl(var(--sidebar-primary))] text-sm font-bold tracking-widest">AXLE</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {useDynamic ? (
          // Dynamic mode: render every section the builder returned.
          sections!.map((section) => (
            <SidebarGroup
              key={section.id}
              data-testid={`sidebar-section-${section.id}`}
            >
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              {section.items.map((item) => {
                const Icon = iconForModule(item.moduleId);
                const isActive = pathname.startsWith(item.route);
                return (
                  <Link
                    key={item.moduleId}
                    href={item.route}
                    className="block"
                    data-testid={`sidebar-nav-${item.moduleId}`}
                  >
                    <SidebarItem
                      active={isActive}
                      icon={<Icon size={18} />}
                      label={
                        item.tenantScoped ? `${item.label} ⊛` : item.label
                      }
                    />
                  </Link>
                );
              })}
            </SidebarGroup>
          ))
        ) : (
          // Fallback mode: static 12 nav items (legacy + pre-Pack orgs).
          <SidebarGroup data-testid="sidebar-section-fallback">
            <SidebarGroupLabel>메뉴</SidebarGroupLabel>
            {FALLBACK_NAV_ITEMS.map((item) => {
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
        )}

        <SidebarGroup data-testid="sidebar-section-settings">
          <SidebarGroupLabel>설정</SidebarGroupLabel>
          <Link href="/settings/modules" className="block">
            <SidebarItem
              active={pathname.startsWith("/settings/modules")}
              icon={<Package size={18} />}
              label="Pack 카탈로그"
            />
          </Link>
          <Link href="/settings/organization" className="block">
            <SidebarItem
              active={
                pathname.startsWith("/settings") &&
                !pathname.startsWith("/settings/modules")
              }
              icon={<Settings size={18} />}
              label="설정"
            />
          </Link>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {platformRole === "PLATFORM_ADMIN" && (
          <Link href="/platform-admin" className="block">
            <SidebarItem
              icon={<Shield size={18} />}
              label="관리자 콘솔"
            />
          </Link>
        )}
        {userMenu}
      </SidebarFooter>
    </Sidebar>
  );
}
