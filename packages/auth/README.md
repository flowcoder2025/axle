# @axle/auth

Auth.js v5 Split Config (Edge + Node.js) for the AXLE platform, plus the
Data Access Layer (`requireUser` / `requireOrg` / `requireOrgAdmin` /
`requirePlatformAdmin`) and the 3-tier session cache.

## Module ReBAC scopes (WI-619)

Module-level Relationship-Based Access Control built on the existing
`@axle/db` `RelationTuple` table. Each grant is one row:

```
namespace:   "module-scope"
objectId:    <orgId>             // org the grant applies to
relation:    <scope>              // e.g. "customers:read" or "hr:admin"
subjectType: "user"
subjectId:   <userId>
```

### Scope catalog

`MODULE_SCOPES` exports every recognised scope across the 35-module catalog:

| Pack | Scope shape | Examples |
|---|---|---|
| A (10) | `<resource>:{read,write,admin,*}` | `customers:*`, `projects:read`, `finance:admin` |
| B (3 + 3 admin) | wildcard + `platform:admin` | `programs:*`, `matching:*`, `journals:*`, `platform:admin` |
| D (5) | `hr:{read,write,admin}` | `hr:read`, `hr:write`, `hr:admin` |
| E (4) | `content:{read,write,admin}` | `content:read`, `content:write`, `content:admin` |
| F (7) | `erp:{read,write}` | `erp:read`, `erp:write` |
| G (3) | `<resource>:*` | `automation:*`, `certs:*`, `recording:*` |

### Matching rules

`scopeSatisfies(held, required)` decides whether a held grant covers a
required scope:

1. **Exact match** — `customers:read` covers `customers:read`.
2. **Wildcard** — `customers:*` covers any `customers:<verb>` (and vice-versa).
3. **Hierarchy within a resource** — `admin ≥ write ≥ read`.
   So `hr:admin` covers `hr:write` and `hr:read`.
4. Different resources never overlap. `platform:admin` does not satisfy
   module scopes.

### Usage examples

#### 1. RSC page guard (legacy-safe)

Use `checkModulePermissionLegacy` when adding a guard to a page that already
ships in production. Orgs with zero grants pass through (legacy), but once
any scope is granted the user must hold a satisfying one.

```ts
// apps/web/app/(app)/finance/page.tsx
import { getCurrentUser, checkModulePermissionLegacy } from "@axle/auth";
import { notFound } from "next/navigation";

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const allowed = await checkModulePermissionLegacy(
    user.id,
    user.orgId,
    "finance:read",
  );
  if (!allowed) notFound();
  // ... render
}
```

#### 2. Strict server action

Use `checkModulePermission` when you want a hard gate — no legacy fallthrough.

```ts
"use server";
import { requireOrg, checkModulePermission } from "@axle/auth";

export async function approvePayroll(payrollId: string) {
  const user = await requireOrg();
  const ok = await checkModulePermission(user.id, user.orgId, "hr:write");
  if (!ok) throw new Error("FORBIDDEN");
  // ... mutate
}
```

#### 3. Route handler

```ts
import { NextResponse } from "next/server";
import { requireOrg, checkModulePermission } from "@axle/auth";

export async function POST() {
  const user = await requireOrg();
  if (!(await checkModulePermission(user.id, user.orgId, "documents:write"))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  // ...
}
```

#### 4. Loading the sidebar permission set

Used by `apps/web/src/lib/sidebar-builder.ts` (WI-618):

```ts
import { getUserModuleScopes } from "@axle/auth";

const scopes = await getUserModuleScopes(user.id, user.orgId);
// scopes is the input to buildSidebar({ userPermissions: scopes, ... })
```

#### 5. Multi-org tenant gate (WI-620 cooperation)

When the user has switched into a managed-org tenant, gate the page on both
the module scope AND the tenant scope:

```ts
import {
  getCurrentUser,
  checkModulePermission,
  checkTenantScope,
} from "@axle/auth";

const user = await getCurrentUser();
const activeTenant = session.activeTenant;

if (
  !(await checkModulePermission(user.id, user.orgId, "hr:read")) ||
  (activeTenant && !(await checkTenantScope(user.id, activeTenant)))
) {
  notFound();
}
```

### Grants & revokes

```ts
import { grantModuleScope, revokeModuleScope } from "@axle/auth";

// Grant `customers:*` for org-1 to user u1
await grantModuleScope("u1", "org-1", "customers:*");

// Revoke
await revokeModuleScope("u1", "org-1", "customers:*");
```

Both are idempotent and safe to retry. Grants live in the same
`RelationTuple` table as everything else, so backups/seeds keep working
unchanged.
