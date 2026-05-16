# Prisma Migrations

AXLE uses **Prisma Migrate** (versioned migrations) instead of `prisma db push` (schema-sync) as of WI-720.

## Why versioned migrations

`db push` synchronizes the DB to match `schema.prisma` without recording history. That worked early on but caused drift risk:

- No way to reproduce prod schema on a fresh DB step-by-step
- No audit trail of when each column / index landed
- Hotfixes applied via `db push` invisible to next developer
- Rollbacks impossible — `db push --accept-data-loss` can silently drop columns

`migrate deploy` records each migration in the `_prisma_migrations` table on the target DB and refuses to drift.

## Files

- `prisma/migrations/0_init/migration.sql` — baseline. Captures the entire schema as of 2026-05-17 (Phase 0 through Phase 20). `CREATE EXTENSION vector` is at the top.
- `prisma/migrations/migration_lock.toml` — provider lock (postgresql).
- `sql/2026-04-21-pgvector-hnsw-indexes.sql` — out-of-band: `CREATE INDEX CONCURRENTLY` for the HNSW cosine index. Not in baseline because `CONCURRENTLY` cannot run inside a transaction (Prisma wraps each migration in one).

## Local workflow

```bash
# Add a new column to schema.prisma, then:
cd packages/db
npx prisma migrate dev --name describe_the_change

# This creates prisma/migrations/<timestamp>_describe_the_change/migration.sql
# and applies it to your local DB.
```

For schemas that need raw SQL (`CONCURRENTLY`, extensions, etc.), edit the generated `migration.sql` before committing.

## CI drift detection

`e2e-write.yml` runs `prisma migrate diff --from-migrations --to-schema --exit-code` against a shadow DB on every PR. If `schema.prisma` was edited without a matching migration, the build fails.

## Production deploy

Use `Actions → DB Migrate (manual) → Run workflow`:

| Action | Use case |
|---|---|
| `migrate_status` | Inspect pending migrations (read-only) |
| `migrate_deploy` | Apply pending migrations |
| `baseline_resolve` | **One-time** — mark `0_init` as applied on a DB that was previously schema-synced via `db push` |
| `backfill_aijob_orgid` | One-off backfill script |

Always run with `dry_run=true` first.

### One-time baseline (WI-720)

Prod DB was built via `db push` from Phase 0 through Phase 20, so `_prisma_migrations` is empty. To adopt versioned migrations:

```
Actions → DB Migrate (manual) → Run workflow
  action: baseline_resolve
  dry_run: false
```

This inserts a row in `_prisma_migrations` marking `0_init` as already applied, without re-running its SQL (which would conflict with existing tables). After this, all future schema changes go through `migrate_deploy`.

### Adding a migration to prod

1. Local: `npx prisma migrate dev --name <name>` → commits `migration.sql` to repo
2. Open PR → CI drift check passes
3. Merge to main
4. Trigger `migrate_deploy` workflow with `dry_run=true` first
5. If diff looks correct, re-run with `dry_run=false`

## pgvector HNSW index

The HNSW index on `DocumentEmbedding.embedding` is applied manually:

```bash
psql "$DIRECT_URL" -f packages/db/sql/2026-04-21-pgvector-hnsw-indexes.sql
```

It's idempotent (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`). Rerun is safe.
