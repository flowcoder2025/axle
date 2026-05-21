import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/axle",
    // WI-726a-fix: Prisma 7.7 `migrate diff --from-migrations` requires
    // a shadow database. The CLI flag `--shadow-database-url` is no
    // longer accepted (it was removed between 7.0 and 7.7), so the URL
    // must come from this config. CI populates SHADOW_DATABASE_URL right
    // before the drift-detection step; prod and local dev leave it unset
    // (no shadow needed for `migrate deploy`).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
