# @axle/core-module-system

Foundation package for the AXLE v3 module system: 단일 플랫폼 + 6 Pack × 35 모듈 + Multi-org tenancy.

All Pack/module metadata (WI-617 ~ WI-626) is registered through this package, which provides:

- **Registry** — in-memory catalog of `ModuleConfig` and `PackConfig`
- **Installer** — `OrgModuleInstall` CRUD with hard-dependency enforcement and `onInstall` / `onUninstall` hooks
- **Dependency resolver** — topological sort + cascade-uninstall detection
- **Sidebar builder** — turns installed modules + ReBAC permissions into navigation sections

The package is intentionally Prisma-free at the import layer (see `PrismaClientLike` in `src/types.ts`). The installer takes the Prisma client through `deps.prisma`, which keeps the package unit-testable with a hand-rolled in-memory mock and avoids a cross-package coupling to `@axle/db`.

## Usage

### 1. Register a module

```ts
import { registerModule } from "@axle/core-module-system";

registerModule({
  id: "payroll",
  packId: "D",
  label: "급여",
  route: "/payroll",
  permission: "hr:write",
  multiOrg: true,
  pbc: ["hr-payroll"],
  deps: { hard: ["employees"] },
  prismaModels: ["Payroll"],
  onInstall: async ({ orgId, prisma }) => {
    // seed default payroll settings, etc.
  },
});
```

### 2. Install a Pack for an org

```ts
import { registerPack, installPack } from "@axle/core-module-system";
import { prisma } from "@axle/db";

registerPack({
  id: "D",
  label: "HR",
  modules: ["employees", "payroll", "attendance", "leave", "nomu"],
  pricing: { monthly: 49000, perUnit: 1000 },
});

await installPack("org-123", "D", { prisma });
// employees is installed first (hard dep), then payroll, attendance, leave, nomu
```

`installPack` performs a topological sort over `pack.modules` so hard deps always install before their dependents. `installModule` is idempotent — re-installing an already-installed module is a no-op.

### 3. Build the sidebar

```ts
import { buildSidebar, getInstalledModules } from "@axle/core-module-system";

const installed = await getInstalledModules(orgId, { prisma });
const sections = buildSidebar({
  orgId,
  userId,
  activeTenant: session.activeTenant, // optional managed-org id
  installedModules: installed,
  userPermissions: session.scopes, // ["customers:*", "hr:write", ...]
});

// sections[0] = recommended Pack A (if installed + permitted)
// sections[N-1] = admin section (if any admin modules installed)
```

The returned `SidebarSection[]` is a pure data structure — JSX rendering is the consumer's responsibility. Pack G's `requiresDesktop` modules are flagged on each `NavItem` so the UI can render a Companion-app badge.

## Design constraints (WI-616)

- **No `@prisma/client` import** — the package uses a structural `PrismaClientLike` type. Callers pass the real client through `deps.prisma`.
- **No React/JSX** — pure TypeScript. The sidebar API returns data only.
- **Hard vs. soft deps** — only hard deps block install/uninstall. Soft deps are advisory (UI hints for cross-pack integrations).
- **ManagedOrg model, pricing, and ReBAC scope enforcement** are deliberately out of scope; they ship in WI-619 (ReBAC) and WI-620 (Multi-org tenancy).

## Related

- `wireframes/architecture.md` §4 — v3 module system spec
- `wireframes/module-catalog.md` — 35-module catalog
- `.flowset/contracts/sprint-616.md` — sprint contract
