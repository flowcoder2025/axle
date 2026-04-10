import Link from "next/link";

const NAV_ITEMS = [
  { href: "/settings/organization", label: "조직 설정" },
  { href: "/settings/team", label: "팀 관리" },
  { href: "/settings/notifications", label: "알림 설정" },
  { href: "/settings/integrations", label: "연동 설정" },
  { href: "/settings/ai", label: "AI 설정" },
] as const;

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar nav */}
      <aside className="w-56 shrink-0 border-r bg-muted/40 px-4 py-8">
        <h2 className="mb-6 px-2 text-lg font-semibold">설정</h2>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
