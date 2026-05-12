export default function PackCatalogLoading() {
  return (
    <div className="max-w-6xl space-y-6" data-testid="pack-catalog-loading">
      <div>
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted/60" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border bg-muted/40"
          />
        ))}
      </div>

      <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />

      <div>
        <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
