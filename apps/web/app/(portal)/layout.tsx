/**
 * Portal layout — minimal, no sidebar, no auth header.
 * Accessed by external clients via a unique token URL.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">AXLE</span>
          <span className="text-muted-foreground text-sm">클라이언트 포털</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
