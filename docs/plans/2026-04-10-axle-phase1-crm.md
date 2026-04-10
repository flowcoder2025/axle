# AXLE Phase 1: CRM Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CRM module — Client and Contact CRUD, business card OCR, Popbill business number validation, pipeline kanban view, and client detail page with tabs. This is the first user-facing feature on top of the Phase 0 foundation.

**Architecture:** Next.js 16 App Router with Server Actions for mutations, Zod validation, @axle/db Prisma queries, @axle/auth DAL for auth. New package: packages/ocr (Gemini Vision for business card OCR + Popbill validation).

**Tech Stack:** Next.js 16, React 19, Server Actions, Zod, @axle/db (Prisma 7), @axle/auth (Auth.js v5 DAL), @axle/ui (shadcn/ui), Vitest, packages/ocr (Google Gemini Vision API, Popbill API)

**Depends on:** Phase 0 (packages/db, packages/auth, packages/ui, apps/web)

---

## File Structure

```
axle/
├── packages/
│   └── ocr/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                  # Public API exports
│       │   ├── business-card.ts          # Business card OCR (Gemini Vision)
│       │   ├── popbill.ts                # Popbill business number validation
│       │   └── types.ts                  # Shared OCR types
│       └── tests/
│           ├── business-card.test.ts
│           └── popbill.test.ts
│
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── (app)/
│           │   │   └── clients/
│           │   │       ├── page.tsx                   # Client list (table + kanban)
│           │   │       ├── new/
│           │   │       │   └── page.tsx               # Create client form
│           │   │       └── [clientId]/
│           │   │           ├── page.tsx               # Client detail (tabs)
│           │   │           ├── edit/
│           │   │           │   └── page.tsx           # Edit client form
│           │   │           └── contacts/
│           │   │               └── new/
│           │   │                   └── page.tsx       # Add contact (manual + OCR)
│           │   └── api/
│           │       ├── clients/
│           │       │   ├── route.ts                   # GET list, POST create
│           │       │   └── [clientId]/
│           │       │       ├── route.ts               # GET detail, PATCH update, DELETE
│           │       │       └── contacts/
│           │       │           ├── route.ts           # GET list, POST create
│           │       │           └── [contactId]/
│           │       │               └── route.ts       # PATCH update, DELETE
│           │       ├── ocr/
│           │       │   └── business-card/
│           │       │       └── route.ts               # POST OCR business card
│           │       └── popbill/
│           │           └── validate/
│           │               └── route.ts               # POST validate business number
│           ├── lib/
│           │   ├── validations/
│           │   │   ├── client.ts                      # Client Zod schemas
│           │   │   └── contact.ts                     # Contact Zod schemas
│           │   └── actions/
│           │       ├── client-actions.ts              # Server actions for clients
│           │       └── contact-actions.ts             # Server actions for contacts
│           └── components/
│               ├── clients/
│               │   ├── client-table.tsx               # Client data table
│               │   ├── client-kanban.tsx              # Pipeline kanban view
│               │   ├── client-form.tsx                # Create/edit form
│               │   ├── client-detail-tabs.tsx         # Detail tabs container
│               │   ├── client-info-tab.tsx            # Info tab content
│               │   ├── client-contacts-tab.tsx        # Contacts tab content
│               │   ├── client-projects-tab.tsx        # Projects tab (placeholder)
│               │   ├── client-documents-tab.tsx       # Documents tab (placeholder)
│               │   ├── client-status-badge.tsx        # Status badge component
│               │   └── view-toggle.tsx                # Table/kanban toggle
│               └── contacts/
│                   ├── contact-form.tsx               # Create/edit contact form
│                   ├── contact-card.tsx               # Contact display card
│                   └── business-card-upload.tsx        # OCR upload component
```

---

## Task 1: Zod Validation Schemas

**Files:**
- Create: `apps/web/src/lib/validations/client.ts`
- Create: `apps/web/src/lib/validations/contact.ts`

- [ ] **Step 1: Create client validation schema**

Create `apps/web/src/lib/validations/client.ts`:

```typescript
import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().min(1, "고객사명을 입력해주세요"),
  businessNumber: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{5}$/, "사업자번호 형식: 000-00-00000")
    .optional()
    .or(z.literal("")),
  ceoName: z.string().optional(),
  industry: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("올바른 이메일을 입력해주세요").optional().or(z.literal("")),
  website: z.string().url("올바른 URL을 입력해주세요").optional().or(z.literal("")),
  memo: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("ACTIVE"),
  assignedTo: z.string().optional(),
  employeeCount: z.coerce.number().int().positive().optional(),
  capitalAmount: z.coerce.number().positive().optional(),
  foundedDate: z.coerce.date().optional(),
  region: z.string().optional(),
  isVenture: z.boolean().default(false),
  isInnoBiz: z.boolean().default(false),
  isMainBiz: z.boolean().default(false),
  isSocial: z.boolean().default(false),
  ventureValidUntil: z.coerce.date().optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const clientSearchSchema = z.object({
  q: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
  assignedTo: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
export type ClientSearchInput = z.infer<typeof clientSearchSchema>;
```

- [ ] **Step 2: Create contact validation schema**

Create `apps/web/src/lib/validations/contact.ts`:

```typescript
import { z } from "zod";

export const contactCreateSchema = z.object({
  clientId: z.string().min(1, "고객사를 선택해주세요"),
  name: z.string().min(1, "이름을 입력해주세요"),
  position: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("올바른 이메일을 입력해주세요").optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
  memo: z.string().optional(),
  source: z.enum(["BUSINESS_CARD", "MANUAL", "IMPORT"]).default("MANUAL"),
  businessCardUrl: z.string().optional(),
  isResearcher: z.boolean().default(false),
  researchField: z.string().optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial().omit({ clientId: true });

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
```

- [ ] **Step 3: Install zod in apps/web**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npm install zod
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validations/
git commit -m "feat: add Zod validation schemas for Client and Contact"
```

---

## Task 2: Client API Routes

**Files:**
- Create: `apps/web/src/app/api/clients/route.ts`
- Create: `apps/web/src/app/api/clients/[clientId]/route.ts`

- [ ] **Step 1: Write failing test for client list API**

Create `apps/web/src/app/api/clients/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    client: {
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
    },
  },
}));

vi.mock("@axle/auth/dal", () => ({
  getVerifiedOrgMember: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    member: { orgId: "org-1", role: "MEMBER" },
    org: { id: "org-1", name: "Test Org" },
  }),
}));

import { GET, POST } from "../route";

describe("GET /api/clients", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated client list", async () => {
    const clients = [
      { id: "c1", name: "테스트 기업", status: "ACTIVE", createdAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(clients);
    mockCount.mockResolvedValue(1);

    const req = new Request("http://localhost/api/clients?page=1&limit=20");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("filters by status", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const req = new Request("http://localhost/api/clients?status=PROSPECT");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PROSPECT",
        }),
      })
    );
  });
});

describe("POST /api/clients", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a client with valid data", async () => {
    const newClient = { id: "c-new", name: "새 기업", status: "ACTIVE" };
    mockCreate.mockResolvedValue(newClient);

    const req = new Request("http://localhost/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "새 기업" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("c-new");
  });

  it("returns 400 for missing name", async () => {
    const req = new Request("http://localhost/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/clients/__tests__/route.test.ts
```

Expected: FAIL — "Cannot find module '../route'"

- [ ] **Step 3: Implement client list and create API route**

Create `apps/web/src/app/api/clients/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { clientCreateSchema, clientSearchSchema } from "@/lib/validations/client";

export async function GET(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember(
      // TODO: orgId from session — for now use first org
      "" // Will be replaced with actual org resolution
    );
    const orgId = member.orgId;

    const { searchParams } = new URL(req.url);
    const parsed = clientSearchSchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q, status, assignedTo, sortBy, sortOrder, page, limit } = parsed.data;

    const where = {
      orgId,
      ...(status ? { status } : {}),
      ...(assignedTo ? { assignedTo } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { businessNumber: { contains: q } },
              { ceoName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contacts: { where: { isPrimary: true }, take: 1 },
          _count: { select: { projects: true, documents: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");
    const orgId = member.orgId;

    const body = await req.json();
    const parsed = clientCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        ...parsed.data,
        orgId,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Implement client detail, update, and delete API route**

Create `apps/web/src/app/api/clients/[clientId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { clientUpdateSchema } from "@/lib/validations/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: member.orgId },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
        projects: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            fileType: true,
            category: true,
            createdAt: true,
          },
        },
        achievements: { orderBy: { date: "desc" } },
        financials: { orderBy: { year: "desc" }, take: 3 },
        _count: {
          select: { projects: true, documents: true, contacts: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("GET /api/clients/[clientId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { member } = await getVerifiedOrgMember("");

    // Verify ownership
    const existing = await prisma.client.findFirst({
      where: { id: clientId, orgId: member.orgId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = clientUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: parsed.data,
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("PATCH /api/clients/[clientId] error:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const existing = await prisma.client.findFirst({
      where: { id: clientId, orgId: member.orgId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    await prisma.client.delete({ where: { id: clientId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/clients/[clientId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/clients/__tests__/route.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/clients/
git commit -m "feat: add Client API routes (list, create, detail, update, delete)"
```

---

## Task 3: Contact API Routes

**Files:**
- Create: `apps/web/src/app/api/clients/[clientId]/contacts/route.ts`
- Create: `apps/web/src/app/api/clients/[clientId]/contacts/[contactId]/route.ts`

- [ ] **Step 1: Write failing test for contact API**

Create `apps/web/src/app/api/clients/[clientId]/contacts/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    contact: {
      findMany: mockFindMany,
      create: mockCreate,
      updateMany: mockUpdateMany,
    },
    client: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock("@axle/auth/dal", () => ({
  getVerifiedOrgMember: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    member: { orgId: "org-1", role: "MEMBER" },
    org: { id: "org-1" },
  }),
}));

import { GET, POST } from "../route";

describe("GET /api/clients/[clientId]/contacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns contacts for a client", async () => {
    mockFindFirst.mockResolvedValue({ id: "c1", orgId: "org-1" });
    mockFindMany.mockResolvedValue([
      { id: "ct1", name: "홍길동", isPrimary: true },
    ]);

    const req = new Request("http://localhost/api/clients/c1/contacts");
    const res = await GET(req, { params: Promise.resolve({ clientId: "c1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("홍길동");
  });
});

describe("POST /api/clients/[clientId]/contacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a contact", async () => {
    mockFindFirst.mockResolvedValue({ id: "c1", orgId: "org-1" });
    mockCreate.mockResolvedValue({ id: "ct-new", name: "김철수" });

    const req = new Request("http://localhost/api/clients/c1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "김철수", clientId: "c1" }),
    });

    const res = await POST(req, { params: Promise.resolve({ clientId: "c1" }) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("김철수");
  });

  it("sets as primary and unsets others when isPrimary=true", async () => {
    mockFindFirst.mockResolvedValue({ id: "c1", orgId: "org-1" });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockCreate.mockResolvedValue({ id: "ct-new", name: "대표", isPrimary: true });

    const req = new Request("http://localhost/api/clients/c1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "대표", clientId: "c1", isPrimary: true }),
    });

    const res = await POST(req, { params: Promise.resolve({ clientId: "c1" }) });
    expect(res.status).toBe(201);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { clientId: "c1", isPrimary: true },
      data: { isPrimary: false },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/clients/\\[clientId\\]/contacts/__tests__/route.test.ts
```

Expected: FAIL — "Cannot find module '../route'"

- [ ] **Step 3: Implement contact list and create API**

Create `apps/web/src/app/api/clients/[clientId]/contacts/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { contactCreateSchema } from "@/lib/validations/contact";

async function verifyClientAccess(clientId: string, orgId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
  });
  return client;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const client = await verifyClientAccess(clientId, member.orgId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const contacts = await prisma.contact.findMany({
      where: { clientId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("GET contacts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const client = await verifyClientAccess(clientId, member.orgId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = contactCreateSchema.safeParse({ ...body, clientId });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // If setting as primary, unset all others first
    if (parsed.data.isPrimary) {
      await prisma.contact.updateMany({
        where: { clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.contact.create({
      data: parsed.data,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("POST contacts error:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Implement contact update and delete**

Create `apps/web/src/app/api/clients/[clientId]/contacts/[contactId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { contactUpdateSchema } from "@/lib/validations/contact";

type Params = { clientId: string; contactId: string };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { clientId, contactId } = await params;
    const { member } = await getVerifiedOrgMember("");

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: member.orgId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = contactUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // If setting as primary, unset all others first
    if (parsed.data.isPrimary) {
      await prisma.contact.updateMany({
        where: { clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: parsed.data,
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("PATCH contact error:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { clientId, contactId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: member.orgId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await prisma.contact.delete({ where: { id: contactId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE contact error:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/clients/\\[clientId\\]/contacts/__tests__/route.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/clients/
git commit -m "feat: add Contact API routes (list, create, update, delete, primary toggle)"
```

---

## Task 4: packages/ocr — Business Card OCR

**Files:**
- Create: `packages/ocr/package.json`
- Create: `packages/ocr/tsconfig.json`
- Create: `packages/ocr/src/types.ts`
- Create: `packages/ocr/src/business-card.ts`
- Create: `packages/ocr/src/popbill.ts`
- Create: `packages/ocr/src/index.ts`
- Create: `packages/ocr/tests/business-card.test.ts`
- Create: `packages/ocr/tests/popbill.test.ts`

- [ ] **Step 1: Create packages/ocr/package.json**

```json
{
  "name": "@axle/ocr",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./business-card": "./src/business-card.ts",
    "./popbill": "./src/popbill.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.0"
  },
  "devDependencies": {
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/ocr/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create OCR types**

Create `packages/ocr/src/types.ts`:

```typescript
export interface BusinessCardResult {
  name: string;
  position?: string;
  department?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  businessNumber?: string;
  confidence: number;
}

export interface PopbillValidation {
  businessNumber: string;
  isValid: boolean;
  companyName?: string;
  ceoName?: string;
  businessType?: string;
  businessItem?: string;
  taxType?: string;
  errorMessage?: string;
}
```

- [ ] **Step 4: Write failing test for business card OCR**

Create `packages/ocr/tests/business-card.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Google Generative AI
const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

import { parseBusinessCard } from "../src/business-card";

describe("parseBusinessCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts contact info from business card image", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            name: "홍길동",
            position: "대표이사",
            company: "테스트 주식회사",
            phone: "010-1234-5678",
            email: "hong@test.com",
            address: "서울시 강남구 역삼동 123",
            businessNumber: "123-45-67890",
            confidence: 0.95,
          }),
      },
    });

    const result = await parseBusinessCard(
      Buffer.from("fake-image-data"),
      "image/jpeg"
    );

    expect(result.name).toBe("홍길동");
    expect(result.position).toBe("대표이사");
    expect(result.company).toBe("테스트 주식회사");
    expect(result.phone).toBe("010-1234-5678");
    expect(result.email).toBe("hong@test.com");
    expect(result.businessNumber).toBe("123-45-67890");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("handles partial OCR results gracefully", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            name: "김철수",
            confidence: 0.6,
          }),
      },
    });

    const result = await parseBusinessCard(
      Buffer.from("blurry-image"),
      "image/png"
    );

    expect(result.name).toBe("김철수");
    expect(result.phone).toBeUndefined();
    expect(result.confidence).toBe(0.6);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd /Volumes/포터블/AX/axle/packages/ocr
npx vitest run tests/business-card.test.ts
```

Expected: FAIL — "Cannot find module '../src/business-card'"

- [ ] **Step 6: Implement business card OCR**

Create `packages/ocr/src/business-card.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BusinessCardResult } from "./types";

const BUSINESS_CARD_PROMPT = `Analyze this business card image and extract the following information as JSON.
Return ONLY valid JSON with these fields:
- name: person's full name (Korean or English)
- position: job title/position
- department: department name
- company: company name
- phone: phone number (keep original format)
- email: email address
- address: office address
- website: website URL
- businessNumber: Korean business registration number (사업자등록번호, format: XXX-XX-XXXXX)
- confidence: your confidence in the extraction accuracy (0.0 to 1.0)

If a field is not visible or unclear, omit it from the JSON.
Prioritize accuracy over completeness.`;

export async function parseBusinessCard(
  imageBuffer: Buffer,
  mimeType: string
): Promise<BusinessCardResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };

  const result = await model.generateContent([BUSINESS_CARD_PROMPT, imagePart]);
  const responseText = result.response.text();

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse OCR response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as BusinessCardResult;

  return {
    name: parsed.name,
    position: parsed.position,
    department: parsed.department,
    company: parsed.company,
    phone: parsed.phone,
    email: parsed.email,
    address: parsed.address,
    website: parsed.website,
    businessNumber: parsed.businessNumber,
    confidence: parsed.confidence ?? 0.5,
  };
}
```

- [ ] **Step 7: Write failing test for Popbill validation**

Create `packages/ocr/tests/popbill.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { validateBusinessNumber } from "../src/popbill";

describe("validateBusinessNumber", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns valid result for active business", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              b_no: "1234567890",
              b_stt: "계속사업자",
              b_stt_cd: "01",
              tax_type: "일반과세자",
              tax_type_cd: "01",
            },
          ],
        }),
    });

    const result = await validateBusinessNumber("123-45-67890");

    expect(result.isValid).toBe(true);
    expect(result.businessNumber).toBe("1234567890");
  });

  it("returns invalid for closed business", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              b_no: "9876543210",
              b_stt: "폐업자",
              b_stt_cd: "03",
              tax_type: "폐업자",
              tax_type_cd: "03",
            },
          ],
        }),
    });

    const result = await validateBusinessNumber("987-65-43210");
    expect(result.isValid).toBe(false);
  });

  it("strips hyphens from business number", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ b_no: "1234567890", b_stt_cd: "01" }],
        }),
    });

    await validateBusinessNumber("123-45-67890");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("validate"),
      expect.objectContaining({
        body: expect.stringContaining("1234567890"),
      })
    );
  });
});
```

- [ ] **Step 8: Implement Popbill business number validation**

Create `packages/ocr/src/popbill.ts`:

```typescript
import type { PopbillValidation } from "./types";

const OPEN_DATA_API_URL =
  "https://api.odcloud.kr/api/nts-businessman/v1";

/**
 * Validate Korean business registration number using
 * 국세청 사업자등록정보 진위확인 Open API.
 *
 * Alternative: Popbill API (paid, more detailed).
 * Default uses free 공공데이터 Open API.
 */
export async function validateBusinessNumber(
  businessNumber: string
): Promise<PopbillValidation> {
  const apiKey = process.env.OPEN_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_DATA_API_KEY environment variable is required");
  }

  // Strip hyphens
  const cleanNumber = businessNumber.replace(/-/g, "");

  if (cleanNumber.length !== 10) {
    return {
      businessNumber: cleanNumber,
      isValid: false,
      errorMessage: "사업자번호는 10자리여야 합니다",
    };
  }

  const response = await fetch(
    `${OPEN_DATA_API_URL}/validate?serviceKey=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        b_no: [cleanNumber],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Business number validation API error: ${response.status}`);
  }

  const result = await response.json();
  const data = result.data?.[0];

  if (!data) {
    return {
      businessNumber: cleanNumber,
      isValid: false,
      errorMessage: "조회 결과가 없습니다",
    };
  }

  // b_stt_cd: 01=계속사업자, 02=휴업자, 03=폐업자
  const isValid = data.b_stt_cd === "01";

  return {
    businessNumber: cleanNumber,
    isValid,
    companyName: data.b_nm,
    ceoName: data.p_nm,
    businessType: data.b_type,
    businessItem: data.b_sector,
    taxType: data.tax_type,
    errorMessage: isValid ? undefined : `사업자 상태: ${data.b_stt || "확인불가"}`,
  };
}
```

- [ ] **Step 9: Create public API exports**

Create `packages/ocr/src/index.ts`:

```typescript
export { parseBusinessCard } from "./business-card";
export { validateBusinessNumber } from "./popbill";
export type { BusinessCardResult, PopbillValidation } from "./types";
```

- [ ] **Step 10: Create vitest config and run all tests**

Create `packages/ocr/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

```bash
cd /Volumes/포터블/AX/axle/packages/ocr
npx vitest run
```

Expected: All 5 tests PASS (2 business card + 3 popbill).

- [ ] **Step 11: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 12: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ocr/
git commit -m "feat: add packages/ocr with Gemini Vision business card OCR and Popbill validation"
```

---

## Task 5: OCR and Popbill API Routes

**Files:**
- Create: `apps/web/src/app/api/ocr/business-card/route.ts`
- Create: `apps/web/src/app/api/popbill/validate/route.ts`

- [ ] **Step 1: Create business card OCR API route**

Create `apps/web/src/app/api/ocr/business-card/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { parseBusinessCard } from "@axle/ocr/business-card";

export async function POST(req: Request) {
  try {
    await getVerifiedOrgMember("");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일을 업로드해주세요" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다 (JPG, PNG, WebP, HEIC만 가능)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseBusinessCard(buffer, file.type);

    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR business-card error:", error);
    return NextResponse.json(
      { error: "명함 인식에 실패했습니다" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create Popbill validation API route**

Create `apps/web/src/app/api/popbill/validate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { validateBusinessNumber } from "@axle/ocr/popbill";
import { z } from "zod";

const schema = z.object({
  businessNumber: z.string().min(1, "사업자번호를 입력해주세요"),
});

export async function POST(req: Request) {
  try {
    await getVerifiedOrgMember("");

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await validateBusinessNumber(parsed.data.businessNumber);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Popbill validation error:", error);
    return NextResponse.json(
      { error: "사업자번호 검증에 실패했습니다" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/ocr/ apps/web/src/app/api/popbill/
git commit -m "feat: add OCR business card and Popbill validation API routes"
```

---

## Task 6: Server Actions

**Files:**
- Create: `apps/web/src/lib/actions/client-actions.ts`
- Create: `apps/web/src/lib/actions/contact-actions.ts`

- [ ] **Step 1: Create client server actions**

Create `apps/web/src/lib/actions/client-actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { clientCreateSchema, clientUpdateSchema } from "@/lib/validations/client";

export async function createClient(formData: FormData) {
  const { member } = await getVerifiedOrgMember("");

  const raw = Object.fromEntries(formData.entries());

  // Convert checkbox values to boolean
  const data = {
    ...raw,
    isVenture: raw.isVenture === "on",
    isInnoBiz: raw.isInnoBiz === "on",
    isMainBiz: raw.isMainBiz === "on",
    isSocial: raw.isSocial === "on",
  };

  const parsed = clientCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      orgId: member.orgId,
    },
  });

  revalidatePath("/clients");
  return { data: client };
}

export async function updateClient(clientId: string, formData: FormData) {
  const { member } = await getVerifiedOrgMember("");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, orgId: member.orgId },
  });
  if (!existing) {
    return { error: { _form: ["고객사를 찾을 수 없습니다"] } };
  }

  const raw = Object.fromEntries(formData.entries());
  const data = {
    ...raw,
    isVenture: raw.isVenture === "on",
    isInnoBiz: raw.isInnoBiz === "on",
    isMainBiz: raw.isMainBiz === "on",
    isSocial: raw.isSocial === "on",
  };

  const parsed = clientUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const client = await prisma.client.update({
    where: { id: clientId },
    data: parsed.data,
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { data: client };
}

export async function deleteClient(clientId: string) {
  const { member } = await getVerifiedOrgMember("");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, orgId: member.orgId },
  });
  if (!existing) {
    return { error: "고객사를 찾을 수 없습니다" };
  }

  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath("/clients");
  return { success: true };
}
```

- [ ] **Step 2: Create contact server actions**

Create `apps/web/src/lib/actions/contact-actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { contactCreateSchema, contactUpdateSchema } from "@/lib/validations/contact";

export async function createContact(formData: FormData) {
  const { member } = await getVerifiedOrgMember("");
  const raw = Object.fromEntries(formData.entries());

  const data = {
    ...raw,
    isPrimary: raw.isPrimary === "on",
    isResearcher: raw.isResearcher === "on",
  };

  const parsed = contactCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Verify client belongs to org
  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, orgId: member.orgId },
  });
  if (!client) {
    return { error: { _form: ["고객사를 찾을 수 없습니다"] } };
  }

  // If setting as primary, unset existing primary contacts
  if (parsed.data.isPrimary) {
    await prisma.contact.updateMany({
      where: { clientId: parsed.data.clientId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.contact.create({
    data: parsed.data,
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { data: contact };
}

export async function updateContact(contactId: string, formData: FormData) {
  const { member } = await getVerifiedOrgMember("");
  const raw = Object.fromEntries(formData.entries());

  const data = {
    ...raw,
    isPrimary: raw.isPrimary === "on",
    isResearcher: raw.isResearcher === "on",
  };

  const parsed = contactUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { client: true },
  });
  if (!contact || contact.client.orgId !== member.orgId) {
    return { error: { _form: ["연락처를 찾을 수 없습니다"] } };
  }

  if (parsed.data.isPrimary) {
    await prisma.contact.updateMany({
      where: { clientId: contact.clientId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: parsed.data,
  });

  revalidatePath(`/clients/${contact.clientId}`);
  return { data: updated };
}

export async function deleteContact(contactId: string) {
  const { member } = await getVerifiedOrgMember("");

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { client: true },
  });
  if (!contact || contact.client.orgId !== member.orgId) {
    return { error: "연락처를 찾을 수 없습니다" };
  }

  await prisma.contact.delete({ where: { id: contactId } });
  revalidatePath(`/clients/${contact.clientId}`);
  return { success: true };
}

export async function setPrimaryContact(contactId: string, clientId: string) {
  const { member } = await getVerifiedOrgMember("");

  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId: member.orgId },
  });
  if (!client) {
    return { error: "고객사를 찾을 수 없습니다" };
  }

  // Unset all primary, then set the selected one
  await prisma.contact.updateMany({
    where: { clientId, isPrimary: true },
    data: { isPrimary: false },
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: { isPrimary: true },
  });

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/actions/
git commit -m "feat: add server actions for Client and Contact CRUD with primary contact toggle"
```

---

## Task 7: Client List Page (Table + Kanban)

**Files:**
- Create: `apps/web/src/components/clients/client-status-badge.tsx`
- Create: `apps/web/src/components/clients/view-toggle.tsx`
- Create: `apps/web/src/components/clients/client-table.tsx`
- Create: `apps/web/src/components/clients/client-kanban.tsx`
- Create: `apps/web/src/app/(app)/clients/page.tsx`

- [ ] **Step 1: Create client status badge**

Create `apps/web/src/components/clients/client-status-badge.tsx`:

```tsx
import { Badge } from "@axle/ui/badge";
import type { ClientStatus } from "@axle/db";

const statusConfig: Record<ClientStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ACTIVE: { label: "활성", variant: "default" },
  PROSPECT: { label: "잠재", variant: "secondary" },
  INACTIVE: { label: "비활성", variant: "outline" },
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

- [ ] **Step 2: Create view toggle component**

Create `apps/web/src/components/clients/view-toggle.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";

interface ViewToggleProps {
  view: "table" | "kanban";
  onChange: (view: "table" | "kanban") => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex rounded-md border">
      <Button
        variant={view === "table" ? "default" : "ghost"}
        size="sm"
        className="rounded-r-none"
        onClick={() => onChange("table")}
      >
        테이블
      </Button>
      <Button
        variant={view === "kanban" ? "default" : "ghost"}
        size="sm"
        className="rounded-l-none"
        onClick={() => onChange("kanban")}
      >
        파이프라인
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create client table component**

Create `apps/web/src/components/clients/client-table.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Client, Contact } from "@axle/db";
import { ClientStatusBadge } from "./client-status-badge";

type ClientWithRelations = Client & {
  contacts: Contact[];
  _count: { projects: number; documents: number };
};

interface ClientTableProps {
  clients: ClientWithRelations[];
}

export function ClientTable({ clients }: ClientTableProps) {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">고객사명</th>
            <th className="px-4 py-3 text-left font-medium">대표자</th>
            <th className="px-4 py-3 text-left font-medium">사업자번호</th>
            <th className="px-4 py-3 text-left font-medium">주 담당자</th>
            <th className="px-4 py-3 text-left font-medium">상태</th>
            <th className="px-4 py-3 text-right font-medium">프로젝트</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const primaryContact = client.contacts.find((c) => c.isPrimary);
            return (
              <tr key={client.id} className="border-b hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {client.ceoName || "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {client.businessNumber || "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {primaryContact?.name || "-"}
                </td>
                <td className="px-4 py-3">
                  <ClientStatusBadge status={client.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {client._count.projects}
                </td>
              </tr>
            );
          })}
          {clients.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                등록된 고객사가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create client kanban component**

Create `apps/web/src/components/clients/client-kanban.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import type { Client, Contact, ClientStatus } from "@axle/db";

type ClientWithRelations = Client & {
  contacts: Contact[];
  _count: { projects: number; documents: number };
};

interface ClientKanbanProps {
  clients: ClientWithRelations[];
}

const columns: { status: ClientStatus; label: string; color: string }[] = [
  { status: "PROSPECT", label: "잠재 고객", color: "bg-yellow-100" },
  { status: "ACTIVE", label: "활성 고객", color: "bg-green-100" },
  { status: "INACTIVE", label: "비활성", color: "bg-gray-100" },
];

export function ClientKanban({ clients }: ClientKanbanProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {columns.map((col) => {
        const filtered = clients.filter((c) => c.status === col.status);
        return (
          <div key={col.status} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{col.label}</h3>
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
            <div className="space-y-2">
              {filtered.map((client) => (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm">{client.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {client.ceoName && <p>{client.ceoName}</p>}
                        {client.industry && <p>{client.industry}</p>}
                        <p className="font-medium">
                          프로젝트 {client._count.projects}건
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  없음
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create client list page**

Create `apps/web/src/app/(app)/clients/page.tsx`:

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { ClientListView } from "@/components/clients/client-list-view";

interface ClientsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    view?: string;
    page?: string;
  }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const { member } = await getVerifiedOrgMember("");

  const where = {
    orgId: member.orgId,
    ...(params.status ? { status: params.status as any } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { businessNumber: { contains: params.q } },
            { ceoName: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const page = Number(params.page) || 1;
  const limit = 20;

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { projects: true, documents: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">고객사 관리</h1>
        <Link href="/clients/new">
          <Button>고객사 추가</Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <form className="flex-1">
          <Input
            name="q"
            placeholder="고객사명, 사업자번호, 대표자명 검색..."
            defaultValue={params.q}
          />
        </form>
        <div className="flex gap-2">
          <Link href="/clients?status=ACTIVE">
            <Button variant={params.status === "ACTIVE" ? "default" : "outline"} size="sm">
              활성
            </Button>
          </Link>
          <Link href="/clients?status=PROSPECT">
            <Button variant={params.status === "PROSPECT" ? "default" : "outline"} size="sm">
              잠재
            </Button>
          </Link>
          <Link href="/clients">
            <Button variant={!params.status ? "default" : "outline"} size="sm">
              전체
            </Button>
          </Link>
        </div>
      </div>

      <ClientListView
        clients={clients}
        total={total}
        page={page}
        limit={limit}
        defaultView={(params.view as "table" | "kanban") || "table"}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create client list view (toggle wrapper)**

Create `apps/web/src/components/clients/client-list-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ViewToggle } from "./view-toggle";
import { ClientTable } from "./client-table";
import { ClientKanban } from "./client-kanban";

interface ClientListViewProps {
  clients: any[];
  total: number;
  page: number;
  limit: number;
  defaultView: "table" | "kanban";
}

export function ClientListView({
  clients,
  total,
  page,
  limit,
  defaultView,
}: ClientListViewProps) {
  const [view, setView] = useState<"table" | "kanban">(defaultView);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>
      {view === "table" ? (
        <ClientTable clients={clients} />
      ) : (
        <ClientKanban clients={clients} />
      )}
      {view === "table" && total > limit && (
        <div className="flex justify-center gap-2 pt-4">
          <span className="text-sm text-muted-foreground">
            {total}건 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/clients/ apps/web/src/app/\(app\)/clients/page.tsx
git commit -m "feat: add client list page with table/kanban toggle and search/filter"
```

---

## Task 8: Client Create and Edit Pages

**Files:**
- Create: `apps/web/src/components/clients/client-form.tsx`
- Create: `apps/web/src/app/(app)/clients/new/page.tsx`
- Create: `apps/web/src/app/(app)/clients/[clientId]/edit/page.tsx`

- [ ] **Step 1: Create client form component**

Create `apps/web/src/components/clients/client-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import type { Client } from "@axle/db";

interface ClientFormProps {
  client?: Client;
  action: (formData: FormData) => Promise<{ data?: any; error?: any }>;
}

export function ClientForm({ client, action }: ClientFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [popbillResult, setPopbillResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  async function handleSubmit(formData: FormData) {
    setErrors({});
    const result = await action(formData);
    if (result.error) {
      setErrors(result.error);
    } else {
      router.push(`/clients/${result.data.id}`);
    }
  }

  async function validateBusinessNumber(businessNumber: string) {
    if (!businessNumber) return;
    setValidating(true);
    try {
      const res = await fetch("/api/popbill/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessNumber }),
      });
      const result = await res.json();
      setPopbillResult(result);
    } finally {
      setValidating(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">고객사명 *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={client?.name}
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessNumber">사업자번호</Label>
              <div className="flex gap-2">
                <Input
                  id="businessNumber"
                  name="businessNumber"
                  placeholder="000-00-00000"
                  defaultValue={client?.businessNumber ?? ""}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={validating}
                  onClick={() => {
                    const input = document.getElementById("businessNumber") as HTMLInputElement;
                    validateBusinessNumber(input.value);
                  }}
                >
                  {validating ? "확인중..." : "검증"}
                </Button>
              </div>
              {popbillResult && (
                <p className={`text-sm ${popbillResult.isValid ? "text-green-600" : "text-destructive"}`}>
                  {popbillResult.isValid
                    ? `유효 — ${popbillResult.companyName || ""} ${popbillResult.taxType || ""}`
                    : popbillResult.errorMessage || "유효하지 않은 사업자번호"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ceoName">대표자명</Label>
              <Input id="ceoName" name="ceoName" defaultValue={client?.ceoName ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">업종</Label>
              <Input id="industry" name="industry" defaultValue={client?.industry ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">상태</Label>
              <select
                id="status"
                name="status"
                defaultValue={client?.status ?? "ACTIVE"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ACTIVE">활성</option>
                <option value="PROSPECT">잠재</option>
                <option value="INACTIVE">비활성</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">연락처 / 기타</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">웹사이트</Label>
              <Input id="website" name="website" defaultValue={client?.website ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input id="address" name="address" defaultValue={client?.address ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">지역</Label>
              <Input id="region" name="region" defaultValue={client?.region ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memo">메모</Label>
              <textarea
                id="memo"
                name="memo"
                rows={3}
                defaultValue={client?.memo ?? ""}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isVenture" defaultChecked={client?.isVenture} />
                벤처기업
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isInnoBiz" defaultChecked={client?.isInnoBiz} />
                이노비즈
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isMainBiz" defaultChecked={client?.isMainBiz} />
                메인비즈
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isSocial" defaultChecked={client?.isSocial} />
                사회적기업
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit">
          {client ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create client create page**

Create `apps/web/src/app/(app)/clients/new/page.tsx`:

```tsx
import { ClientForm } from "@/components/clients/client-form";
import { createClient } from "@/lib/actions/client-actions";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">새 고객사 등록</h1>
      <ClientForm action={createClient} />
    </div>
  );
}
```

- [ ] **Step 3: Create client edit page**

Create `apps/web/src/app/(app)/clients/[clientId]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { ClientForm } from "@/components/clients/client-form";
import { updateClient } from "@/lib/actions/client-actions";

interface EditClientPageProps {
  params: Promise<{ clientId: string }>;
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { clientId } = await params;
  const { member } = await getVerifiedOrgMember("");

  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId: member.orgId },
  });

  if (!client) notFound();

  const boundAction = updateClient.bind(null, clientId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">고객사 수정 — {client.name}</h1>
      <ClientForm client={client} action={boundAction} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/clients/client-form.tsx apps/web/src/app/\(app\)/clients/new/ apps/web/src/app/\(app\)/clients/\[clientId\]/edit/
git commit -m "feat: add client create and edit pages with Popbill validation"
```

---

## Task 9: Client Detail Page with Tabs

**Files:**
- Create: `apps/web/src/components/clients/client-detail-tabs.tsx`
- Create: `apps/web/src/components/clients/client-info-tab.tsx`
- Create: `apps/web/src/components/clients/client-contacts-tab.tsx`
- Create: `apps/web/src/components/clients/client-projects-tab.tsx`
- Create: `apps/web/src/components/clients/client-documents-tab.tsx`
- Create: `apps/web/src/app/(app)/clients/[clientId]/page.tsx`

- [ ] **Step 1: Create client detail tabs**

Create `apps/web/src/components/clients/client-detail-tabs.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@axle/ui/button";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface ClientDetailTabsProps {
  tabs: Tab[];
  children: Record<string, React.ReactNode>;
}

export function ClientDetailTabs({ tabs, children }: ClientDetailTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? "info");

  return (
    <div className="space-y-4">
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              active === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div>{children[active]}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create client info tab**

Create `apps/web/src/components/clients/client-info-tab.tsx`:

```tsx
import { Card, CardContent } from "@axle/ui/card";
import { ClientStatusBadge } from "./client-status-badge";
import type { Client } from "@axle/db";

export function ClientInfoTab({ client }: { client: Client }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">기본 정보</h3>
          <InfoRow label="상태" value={<ClientStatusBadge status={client.status} />} />
          <InfoRow label="사업자번호" value={client.businessNumber} />
          <InfoRow label="대표자" value={client.ceoName} />
          <InfoRow label="업종" value={client.industry} />
          <InfoRow label="설립일" value={client.foundedDate?.toLocaleDateString("ko-KR")} />
          <InfoRow label="직원수" value={client.employeeCount?.toString()} />
          <InfoRow label="지역" value={client.region} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">연락처</h3>
          <InfoRow label="전화" value={client.phone} />
          <InfoRow label="이메일" value={client.email} />
          <InfoRow label="웹사이트" value={client.website} />
          <InfoRow label="주소" value={client.address} />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">인증 현황</h3>
          <div className="flex gap-3">
            {client.isVenture && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs">벤처기업</span>}
            {client.isInnoBiz && <span className="rounded-full bg-green-100 px-3 py-1 text-xs">이노비즈</span>}
            {client.isMainBiz && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs">메인비즈</span>}
            {client.isSocial && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs">사회적기업</span>}
            {!client.isVenture && !client.isInnoBiz && !client.isMainBiz && !client.isSocial && (
              <span className="text-sm text-muted-foreground">등록된 인증 없음</span>
            )}
          </div>
        </CardContent>
      </Card>
      {client.memo && (
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">메모</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.memo}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | React.ReactNode | null }) {
  return (
    <div className="flex">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create client contacts tab**

Create `apps/web/src/components/clients/client-contacts-tab.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Button } from "@axle/ui/button";
import { Card, CardContent } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import type { Contact } from "@axle/db";
import { deleteContact, setPrimaryContact } from "@/lib/actions/contact-actions";

interface ClientContactsTabProps {
  contacts: Contact[];
  clientId: string;
}

export function ClientContactsTab({ contacts, clientId }: ClientContactsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`/clients/${clientId}/contacts/new`}>
          <Button size="sm">연락처 추가</Button>
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{contact.name}</span>
                <div className="flex items-center gap-1">
                  {contact.isPrimary && <Badge variant="default">주 담당자</Badge>}
                  {contact.isResearcher && <Badge variant="secondary">연구원</Badge>}
                </div>
              </div>
              {contact.position && (
                <p className="text-sm text-muted-foreground">
                  {contact.department ? `${contact.department} / ` : ""}{contact.position}
                </p>
              )}
              {contact.phone && <p className="text-sm">{contact.phone}</p>}
              {contact.email && <p className="text-sm">{contact.email}</p>}
              <div className="flex gap-2 pt-2">
                {!contact.isPrimary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPrimaryContact(contact.id, clientId)}
                  >
                    주 담당자 지정
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("이 연락처를 삭제하시겠습니까?")) {
                      deleteContact(contact.id);
                    }
                  }}
                >
                  삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {contacts.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">
            등록된 연락처가 없습니다
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder tabs for projects and documents**

Create `apps/web/src/components/clients/client-projects-tab.tsx`:

```tsx
export function ClientProjectsTab({
  projects,
}: {
  projects: Array<{ id: string; title: string; type: string; status: string; createdAt: Date }>;
}) {
  return (
    <div>
      {projects.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          등록된 프로젝트가 없습니다 (Phase 3에서 구현)
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">프로젝트명</th>
                <th className="px-4 py-3 text-left font-medium">유형</th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="px-4 py-3 text-left font-medium">등록일</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.type}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

Create `apps/web/src/components/clients/client-documents-tab.tsx`:

```tsx
export function ClientDocumentsTab({
  documents,
}: {
  documents: Array<{ id: string; name: string; fileType: string; category: string; createdAt: Date }>;
}) {
  return (
    <div>
      {documents.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          등록된 서류가 없습니다 (Phase 2에서 구현)
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">파일명</th>
                <th className="px-4 py-3 text-left font-medium">유형</th>
                <th className="px-4 py-3 text-left font-medium">분류</th>
                <th className="px-4 py-3 text-left font-medium">등록일</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.fileType}</td>
                  <td className="px-4 py-3">{d.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create client detail page**

Create `apps/web/src/app/(app)/clients/[clientId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { Button } from "@axle/ui/button";
import { ClientDetailTabs } from "@/components/clients/client-detail-tabs";
import { ClientInfoTab } from "@/components/clients/client-info-tab";
import { ClientContactsTab } from "@/components/clients/client-contacts-tab";
import { ClientProjectsTab } from "@/components/clients/client-projects-tab";
import { ClientDocumentsTab } from "@/components/clients/client-documents-tab";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { deleteClient } from "@/lib/actions/client-actions";

interface ClientDetailPageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { clientId } = await params;
  const { member } = await getVerifiedOrgMember("");

  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId: member.orgId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      projects: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true, type: true, status: true, createdAt: true },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, fileType: true, category: true, createdAt: true },
      },
      _count: { select: { projects: true, documents: true, contacts: true } },
    },
  });

  if (!client) notFound();

  const tabs = [
    { id: "info", label: "기본 정보" },
    { id: "contacts", label: "연락처", count: client._count.contacts },
    { id: "projects", label: "프로젝트", count: client._count.projects },
    { id: "documents", label: "서류", count: client._count.documents },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <ClientStatusBadge status={client.status} />
        </div>
        <div className="flex gap-2">
          <Link href={`/clients/${clientId}/edit`}>
            <Button variant="outline">수정</Button>
          </Link>
          <form
            action={async () => {
              "use server";
              await deleteClient(clientId);
            }}
          >
            <Button variant="destructive" type="submit">
              삭제
            </Button>
          </form>
        </div>
      </div>

      <ClientDetailTabs tabs={tabs}>
        {{
          info: <ClientInfoTab client={client} />,
          contacts: <ClientContactsTab contacts={client.contacts} clientId={clientId} />,
          projects: <ClientProjectsTab projects={client.projects} />,
          documents: <ClientDocumentsTab documents={client.documents} />,
        }}
      </ClientDetailTabs>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/clients/ apps/web/src/app/\(app\)/clients/\[clientId\]/page.tsx
git commit -m "feat: add client detail page with info/contacts/projects/documents tabs"
```

---

## Task 10: Contact Add Page (Manual + OCR)

**Files:**
- Create: `apps/web/src/components/contacts/business-card-upload.tsx`
- Create: `apps/web/src/components/contacts/contact-form.tsx`
- Create: `apps/web/src/app/(app)/clients/[clientId]/contacts/new/page.tsx`

- [ ] **Step 1: Create business card upload component**

Create `apps/web/src/components/contacts/business-card-upload.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@axle/ui/button";
import { Card, CardContent } from "@axle/ui/card";
import type { BusinessCardResult } from "@axle/ocr";

interface BusinessCardUploadProps {
  onResult: (result: BusinessCardResult) => void;
}

export function BusinessCardUpload({ onResult }: BusinessCardUploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr/business-card", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "OCR 실패");
      }

      const result = await res.json();
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "명함 인식에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold">명함 OCR</h3>
        <p className="text-sm text-muted-foreground">
          명함 이미지를 업로드하면 자동으로 정보를 인식합니다
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />

        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleUpload(file);
          }}
        >
          {preview ? (
            <img src={preview} alt="명함 미리보기" className="max-h-48 mx-auto rounded" />
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground">명함 이미지를 드래그하거나 클릭하여 업로드</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP, HEIC 지원</p>
            </div>
          )}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground text-center">인식 중...</p>
        )}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create contact form component**

Create `apps/web/src/components/contacts/contact-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import type { Contact } from "@axle/db";

interface ContactFormProps {
  clientId: string;
  contact?: Contact;
  action: (formData: FormData) => Promise<{ data?: any; error?: any }>;
  defaultValues?: Partial<{
    name: string;
    position: string;
    department: string;
    phone: string;
    email: string;
  }>;
}

export function ContactForm({ clientId, contact, action, defaultValues }: ContactFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(formData: FormData) {
    setErrors({});
    const result = await action(formData);
    if (result.error) {
      setErrors(result.error);
    } else {
      router.push(`/clients/${clientId}`);
    }
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="clientId" value={clientId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">연락처 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={defaultValues?.name ?? contact?.name ?? ""}
                required
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">직함</Label>
              <Input
                id="position"
                name="position"
                defaultValue={defaultValues?.position ?? contact?.position ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">부서</Label>
              <Input
                id="department"
                name="department"
                defaultValue={defaultValues?.department ?? contact?.department ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={defaultValues?.phone ?? contact?.phone ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={defaultValues?.email ?? contact?.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">등록 경로</Label>
              <select
                id="source"
                name="source"
                defaultValue={contact?.source ?? "MANUAL"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="MANUAL">수동 입력</option>
                <option value="BUSINESS_CARD">명함 OCR</option>
                <option value="IMPORT">가져오기</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo">메모</Label>
            <textarea
              id="memo"
              name="memo"
              rows={2}
              defaultValue={contact?.memo ?? ""}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPrimary" defaultChecked={contact?.isPrimary} />
              주 담당자
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isResearcher" defaultChecked={contact?.isResearcher} />
              연구원
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit">
          {contact ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create contact add page with OCR integration**

Create `apps/web/src/app/(app)/clients/[clientId]/contacts/new/page.tsx`:

```tsx
"use client";

import { useState, use } from "react";
import { BusinessCardUpload } from "@/components/contacts/business-card-upload";
import { ContactForm } from "@/components/contacts/contact-form";
import { createContact } from "@/lib/actions/contact-actions";
import type { BusinessCardResult } from "@axle/ocr";

interface NewContactPageProps {
  params: Promise<{ clientId: string }>;
}

export default function NewContactPage({ params }: NewContactPageProps) {
  const { clientId } = use(params);
  const [ocrResult, setOcrResult] = useState<BusinessCardResult | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">연락처 추가</h1>

      <BusinessCardUpload
        onResult={(result) => setOcrResult(result)}
      />

      {ocrResult && (
        <div className="rounded-md bg-blue-50 p-3 text-sm">
          인식 결과가 아래 폼에 반영되었습니다 (신뢰도: {Math.round(ocrResult.confidence * 100)}%)
        </div>
      )}

      <ContactForm
        clientId={clientId}
        action={createContact}
        defaultValues={
          ocrResult
            ? {
                name: ocrResult.name,
                position: ocrResult.position,
                department: ocrResult.department,
                phone: ocrResult.phone,
                email: ocrResult.email,
              }
            : undefined
        }
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/contacts/ apps/web/src/app/\(app\)/clients/\[clientId\]/contacts/
git commit -m "feat: add contact creation page with business card OCR auto-fill"
```

---

## Task 11: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test
```

Expected: All tests pass — packages/db (6), packages/ocr (5), apps/web API tests (7).

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Verify dev server**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected: Dev server starts. Navigate to `/clients` — page renders with empty state. Navigate to `/clients/new` — form renders with Popbill validation button.

- [ ] **Step 4: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 1 complete — CRM Core with Client/Contact CRUD, OCR, Popbill, kanban"
```

---

## Summary

Phase 1 delivers:
- **packages/ocr**: Gemini Vision business card OCR + Popbill business number validation (tested)
- **Client CRUD**: Create, read, update, delete with Zod validation and server actions
- **Contact CRUD**: Create, edit, delete, set primary contact with OCR auto-fill
- **Client list**: Table view + kanban pipeline view with search/filter/sort
- **Client detail**: Tabbed view (info, contacts, projects, documents)
- **Business card OCR**: Upload image, Gemini Vision extracts contact info, pre-fills form
- **Popbill validation**: Real-time business number verification on client create/edit

**Next:** Phase 2 (Documents & Checklist) adds document management, token-based upload, and checklist templates.
