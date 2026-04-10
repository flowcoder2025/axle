# AXLE Phase 2: Documents & Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the document management system — file upload/download via Supabase Storage, document CRUD with version tracking, token-based external upload, checklist templates per project type, document OCR via Gemini, and document expiry tracking.

**Architecture:** New package: packages/storage (Supabase Storage wrapper). Documents link to Client and optionally to Project. ChecklistTemplates define per-ProjectType required documents. Token-based upload generates a public URL that external clients can use to upload files without authentication.

**Tech Stack:** Next.js 16, React 19, Server Actions, Zod, @axle/db (Prisma 7), @axle/auth (Auth.js v5 DAL), @axle/ui (shadcn/ui), @axle/ocr (Gemini Vision), Supabase Storage (S3-compatible), Vitest, crypto.randomUUID

**Depends on:** Phase 0 (packages/db, packages/auth, packages/ui) + Phase 1 (Client CRUD, packages/ocr)

---

## File Structure

```
axle/
├── packages/
│   └── storage/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                  # Public API exports
│       │   ├── client.ts                 # Supabase Storage client singleton
│       │   ├── upload.ts                 # Upload helpers (buffer, stream, formData)
│       │   ├── download.ts              # Download + signed URL helpers
│       │   └── types.ts                  # Shared storage types
│       └── tests/
│           └── upload.test.ts
│
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── (app)/
│           │   │   └── documents/
│           │   │       ├── page.tsx                   # Document list
│           │   │       └── [documentId]/
│           │   │           └── page.tsx               # Document detail/preview
│           │   ├── (app)/
│           │   │   └── settings/
│           │   │       └── checklists/
│           │   │           ├── page.tsx               # Checklist template list
│           │   │           └── [templateId]/
│           │   │               └── page.tsx           # Template edit
│           │   ├── (portal)/
│           │   │   └── upload/
│           │   │       └── [token]/
│           │   │           └── page.tsx               # Token-based upload page
│           │   └── api/
│           │       ├── documents/
│           │       │   ├── route.ts                   # GET list, POST upload
│           │       │   └── [documentId]/
│           │       │       ├── route.ts               # GET detail, PATCH, DELETE
│           │       │       ├── download/
│           │       │       │   └── route.ts           # GET signed URL
│           │       │       └── ocr/
│           │       │           └── route.ts           # POST trigger OCR
│           │       ├── upload-tokens/
│           │       │   └── route.ts                   # POST generate token
│           │       ├── portal/
│           │       │   └── upload/
│           │       │       └── route.ts               # POST token-based upload (no auth)
│           │       └── checklist-templates/
│           │           ├── route.ts                   # GET list, POST create
│           │           └── [templateId]/
│           │               └── route.ts               # PATCH, DELETE
│           ├── lib/
│           │   └── validations/
│           │       ├── document.ts                    # Document Zod schemas
│           │       └── checklist.ts                   # Checklist Zod schemas
│           └── components/
│               ├── documents/
│               │   ├── document-table.tsx             # Document list table
│               │   ├── document-upload.tsx            # Upload component
│               │   ├── document-preview.tsx           # PDF/image preview
│               │   ├── document-status-badge.tsx      # OCR status badge
│               │   └── expiry-indicator.tsx           # Expiry date indicator
│               ├── checklists/
│               │   ├── checklist-template-form.tsx    # Template CRUD form
│               │   └── checklist-template-list.tsx    # Template list
│               └── portal/
│                   └── token-upload-form.tsx          # External upload form
```

---

## Task 1: packages/storage — Supabase Storage Client

**Files:**
- Create: `packages/storage/package.json`
- Create: `packages/storage/tsconfig.json`
- Create: `packages/storage/src/types.ts`
- Create: `packages/storage/src/client.ts`
- Create: `packages/storage/src/upload.ts`
- Create: `packages/storage/src/download.ts`
- Create: `packages/storage/src/index.ts`
- Create: `packages/storage/tests/upload.test.ts`

- [ ] **Step 1: Create packages/storage/package.json**

```json
{
  "name": "@axle/storage",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./upload": "./src/upload.ts",
    "./download": "./src/download.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0"
  },
  "devDependencies": {
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/storage/tsconfig.json**

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

- [ ] **Step 3: Create storage types**

Create `packages/storage/src/types.ts`:

```typescript
export interface UploadResult {
  path: string;
  publicUrl: string;
  size: number;
  contentType: string;
}

export interface SignedUrlResult {
  signedUrl: string;
  expiresAt: Date;
}

export interface StorageConfig {
  bucket: string;
  maxFileSizeMb?: number;
  allowedMimeTypes?: string[];
}

export const BUCKETS = {
  DOCUMENTS: "documents",
  BUSINESS_CARDS: "business-cards",
  ATTACHMENTS: "attachments",
} as const;

export const DEFAULT_MAX_SIZE_MB = 50;

export const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.hancom.hwp",
  "application/vnd.hancom.hwpx+zip",
];
```

- [ ] **Step 4: Create Supabase Storage client singleton**

Create `packages/storage/src/client.ts`:

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabaseStorage: SupabaseClient | undefined;
};

function createSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for storage"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export function getStorageClient(): SupabaseClient {
  const client = globalForSupabase.supabaseStorage ?? createSupabaseClient();

  if (process.env.NODE_ENV !== "production") {
    globalForSupabase.supabaseStorage = client;
  }

  return client;
}
```

- [ ] **Step 5: Write failing test for upload**

Create `packages/storage/tests/upload.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("../src/client", () => ({
  getStorageClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}));

import { uploadFile, generateStoragePath } from "../src/upload";

describe("uploadFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a file and returns path + public URL", async () => {
    mockUpload.mockResolvedValue({ data: { path: "org-1/docs/test.pdf" }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/documents/org-1/docs/test.pdf" },
    });

    const result = await uploadFile({
      bucket: "documents",
      buffer: Buffer.from("pdf-content"),
      fileName: "test.pdf",
      contentType: "application/pdf",
      orgId: "org-1",
      subfolder: "docs",
    });

    expect(result.path).toContain("org-1/docs/");
    expect(result.path).toContain(".pdf");
    expect(result.publicUrl).toContain("storage.example.com");
    expect(mockUpload).toHaveBeenCalled();
  });

  it("throws on upload error", async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: "Quota exceeded" } });

    await expect(
      uploadFile({
        bucket: "documents",
        buffer: Buffer.from("data"),
        fileName: "big.pdf",
        contentType: "application/pdf",
        orgId: "org-1",
      })
    ).rejects.toThrow("Quota exceeded");
  });
});

describe("generateStoragePath", () => {
  it("generates path with org prefix and unique filename", () => {
    const path = generateStoragePath("org-1", "test.pdf", "docs");
    expect(path).toMatch(/^org-1\/docs\/\d+-[a-z0-9]+\.pdf$/);
  });

  it("generates path without subfolder", () => {
    const path = generateStoragePath("org-1", "image.png");
    expect(path).toMatch(/^org-1\/\d+-[a-z0-9]+\.png$/);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
cd /Volumes/포터블/AX/axle/packages/storage
npx vitest run tests/upload.test.ts
```

Expected: FAIL — "Cannot find module '../src/upload'"

- [ ] **Step 7: Implement upload module**

Create `packages/storage/src/upload.ts`:

```typescript
import { getStorageClient } from "./client";
import type { UploadResult } from "./types";
import { DEFAULT_MAX_SIZE_MB } from "./types";
import { randomUUID } from "crypto";
import { extname } from "path";

interface UploadFileOptions {
  bucket: string;
  buffer: Buffer;
  fileName: string;
  contentType: string;
  orgId: string;
  subfolder?: string;
  maxSizeMb?: number;
}

/**
 * Generate a unique storage path:
 * {orgId}/{subfolder?}/{timestamp}-{uuid}.{ext}
 */
export function generateStoragePath(
  orgId: string,
  fileName: string,
  subfolder?: string
): string {
  const ext = extname(fileName).toLowerCase();
  const uniqueName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  return subfolder
    ? `${orgId}/${subfolder}/${uniqueName}`
    : `${orgId}/${uniqueName}`;
}

/**
 * Upload a file to Supabase Storage.
 */
export async function uploadFile(options: UploadFileOptions): Promise<UploadResult> {
  const {
    bucket,
    buffer,
    fileName,
    contentType,
    orgId,
    subfolder,
    maxSizeMb = DEFAULT_MAX_SIZE_MB,
  } = options;

  // Size check
  const sizeMb = buffer.length / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    throw new Error(`File size ${sizeMb.toFixed(1)}MB exceeds limit of ${maxSizeMb}MB`);
  }

  const path = generateStoragePath(orgId, fileName, subfolder);
  const client = getStorageClient();

  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data: urlData } = client.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
    size: buffer.length,
    contentType,
  };
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const client = getStorageClient();

  const { error } = await client.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 8: Implement download module**

Create `packages/storage/src/download.ts`:

```typescript
import { getStorageClient } from "./client";
import type { SignedUrlResult } from "./types";

/**
 * Generate a signed (temporary) URL for private file access.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<SignedUrlResult> {
  const client = getStorageClient();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create signed URL");
  }

  return {
    signedUrl: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}

/**
 * Download a file as a Buffer.
 */
export async function downloadFile(
  bucket: string,
  path: string
): Promise<Buffer> {
  const client = getStorageClient();

  const { data, error } = await client.storage
    .from(bucket)
    .download(path);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to download file");
  }

  return Buffer.from(await data.arrayBuffer());
}
```

- [ ] **Step 9: Create public API exports**

Create `packages/storage/src/index.ts`:

```typescript
export { getStorageClient } from "./client";
export { uploadFile, deleteFile, generateStoragePath } from "./upload";
export { getSignedUrl, downloadFile } from "./download";
export { BUCKETS, ALLOWED_DOC_TYPES, DEFAULT_MAX_SIZE_MB } from "./types";
export type { UploadResult, SignedUrlResult, StorageConfig } from "./types";
```

- [ ] **Step 10: Create vitest config and run tests**

Create `packages/storage/vitest.config.ts`:

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
cd /Volumes/포터블/AX/axle/packages/storage
npx vitest run
```

Expected: All 4 tests PASS (2 upload + 2 path generation).

- [ ] **Step 11: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 12: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/storage/
git commit -m "feat: add packages/storage with Supabase Storage client, upload, download, signed URLs"
```

---

## Task 2: Validation Schemas for Documents and Checklists

**Files:**
- Create: `apps/web/src/lib/validations/document.ts`
- Create: `apps/web/src/lib/validations/checklist.ts`

- [ ] **Step 1: Create document validation schema**

Create `apps/web/src/lib/validations/document.ts`:

```typescript
import { z } from "zod";

export const documentCreateSchema = z.object({
  clientId: z.string().min(1, "고객사를 선택해주세요"),
  projectId: z.string().optional(),
  name: z.string().min(1, "파일명을 입력해주세요"),
  fileUrl: z.string().url("올바른 URL이 필요합니다"),
  fileType: z.string().min(1),
  category: z.enum(["INPUT", "OUTPUT", "TEMPLATE", "ISSUED"]),
  expiresAt: z.coerce.date().optional(),
  autoRenew: z.boolean().default(false),
  parentDocId: z.string().optional(),
});

export const documentUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["INPUT", "OUTPUT", "TEMPLATE", "ISSUED"]).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  autoRenew: z.boolean().optional(),
  projectId: z.string().optional().nullable(),
});

export const documentSearchSchema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  category: z.enum(["INPUT", "OUTPUT", "TEMPLATE", "ISSUED"]).optional(),
  ocrStatus: z.enum(["NONE", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const uploadTokenSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  category: z.enum(["INPUT", "OUTPUT", "TEMPLATE", "ISSUED"]).default("INPUT"),
  expiresInHours: z.coerce.number().int().positive().default(72),
  maxFiles: z.coerce.number().int().positive().default(10),
  label: z.string().optional(),
});

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentSearchInput = z.infer<typeof documentSearchSchema>;
export type UploadTokenInput = z.infer<typeof uploadTokenSchema>;
```

- [ ] **Step 2: Create checklist validation schema**

Create `apps/web/src/lib/validations/checklist.ts`:

```typescript
import { z } from "zod";

export const checklistTemplateCreateSchema = z.object({
  projectType: z.enum([
    "BUSINESS_PLAN",
    "VENTURE_CERT",
    "SOBOOJANG_CERT",
    "RESEARCH_INSTITUTE",
    "PATENT",
    "FINANCIAL_ANALYSIS",
    "RESEARCH_TASK",
    "BUNDLE",
  ]),
  name: z.string().min(1, "항목명을 입력해주세요"),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const checklistTemplateUpdateSchema = checklistTemplateCreateSchema.partial();

export const checklistItemUpdateSchema = z.object({
  status: z.enum(["PENDING", "REQUESTED", "UPLOADED", "VERIFIED"]).optional(),
  requestedAt: z.coerce.date().optional(),
  uploadedAt: z.coerce.date().optional(),
  documentId: z.string().optional().nullable(),
});

export type ChecklistTemplateCreateInput = z.infer<typeof checklistTemplateCreateSchema>;
export type ChecklistTemplateUpdateInput = z.infer<typeof checklistTemplateUpdateSchema>;
export type ChecklistItemUpdateInput = z.infer<typeof checklistItemUpdateSchema>;
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validations/document.ts apps/web/src/lib/validations/checklist.ts
git commit -m "feat: add Zod validation schemas for Document, UploadToken, and ChecklistTemplate"
```

---

## Task 3: Document API Routes

**Files:**
- Create: `apps/web/src/app/api/documents/route.ts`
- Create: `apps/web/src/app/api/documents/[documentId]/route.ts`
- Create: `apps/web/src/app/api/documents/[documentId]/download/route.ts`
- Create: `apps/web/src/app/api/documents/[documentId]/ocr/route.ts`

- [ ] **Step 1: Write failing test for document list API**

Create `apps/web/src/app/api/documents/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    document: { findMany: mockFindMany, count: mockCount, create: mockCreate },
    client: { findFirst: vi.fn().mockResolvedValue({ id: "c1", orgId: "org-1" }) },
  },
}));

vi.mock("@axle/auth/dal", () => ({
  getVerifiedOrgMember: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    member: { orgId: "org-1", role: "MEMBER" },
    org: { id: "org-1" },
  }),
}));

vi.mock("@axle/storage", () => ({
  uploadFile: vi.fn().mockResolvedValue({
    path: "org-1/docs/test.pdf",
    publicUrl: "https://storage.example.com/test.pdf",
    size: 1024,
    contentType: "application/pdf",
  }),
}));

import { GET } from "../route";

describe("GET /api/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated document list", async () => {
    const docs = [
      { id: "d1", name: "사업자등록증.pdf", category: "INPUT", createdAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(docs);
    mockCount.mockResolvedValue(1);

    const req = new Request("http://localhost/api/documents?clientId=c1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/documents/__tests__/route.test.ts
```

Expected: FAIL — "Cannot find module '../route'"

- [ ] **Step 3: Implement document list and upload API**

Create `apps/web/src/app/api/documents/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { uploadFile, BUCKETS } from "@axle/storage";
import { documentSearchSchema } from "@/lib/validations/document";

export async function GET(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");
    const { searchParams } = new URL(req.url);
    const parsed = documentSearchSchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientId, projectId, category, ocrStatus, q, page, limit } = parsed.data;

    const where = {
      client: { orgId: member.orgId },
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(category ? { category } : {}),
      ...(ocrStatus ? { ocrStatus } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
        },
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string;
    const projectId = (formData.get("projectId") as string) || undefined;
    const category = (formData.get("category") as string) || "INPUT";

    if (!file) {
      return NextResponse.json({ error: "파일을 업로드해주세요" }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: "고객사를 선택해주세요" }, { status: 400 });
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: member.orgId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage
    const uploadResult = await uploadFile({
      bucket: BUCKETS.DOCUMENTS,
      buffer,
      fileName: file.name,
      contentType: file.type,
      orgId: member.orgId,
      subfolder: clientId,
    });

    // Check for existing version
    const existingDoc = await prisma.document.findFirst({
      where: { clientId, name: file.name },
      orderBy: { version: "desc" },
    });

    const document = await prisma.document.create({
      data: {
        clientId,
        projectId,
        name: file.name,
        fileUrl: uploadResult.publicUrl,
        fileType: file.type,
        category: category as any,
        version: existingDoc ? existingDoc.version + 1 : 1,
        parentDocId: existingDoc?.id,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement document detail, update, delete**

Create `apps/web/src/app/api/documents/[documentId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { deleteFile, BUCKETS } from "@axle/storage";
import { documentUpdateSchema } from "@/lib/validations/document";

type Params = { documentId: string };

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { documentId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const document = await prisma.document.findFirst({
      where: { id: documentId, client: { orgId: member.orgId } },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("GET document error:", error);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { documentId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const existing = await prisma.document.findFirst({
      where: { id: documentId, client: { orgId: member.orgId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = documentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data: parsed.data,
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("PATCH document error:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { documentId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const existing = await prisma.document.findFirst({
      where: { id: documentId, client: { orgId: member.orgId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Extract path from URL for storage deletion
    try {
      const url = new URL(existing.fileUrl);
      const pathSegments = url.pathname.split("/storage/v1/object/public/documents/");
      if (pathSegments[1]) {
        await deleteFile(BUCKETS.DOCUMENTS, pathSegments[1]);
      }
    } catch {
      // Continue even if storage deletion fails — orphaned file is acceptable
    }

    await prisma.document.delete({ where: { id: documentId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE document error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Implement document download (signed URL)**

Create `apps/web/src/app/api/documents/[documentId]/download/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { getSignedUrl, BUCKETS } from "@axle/storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const document = await prisma.document.findFirst({
      where: { id: documentId, client: { orgId: member.orgId } },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Extract storage path from public URL
    const url = new URL(document.fileUrl);
    const pathSegments = url.pathname.split("/storage/v1/object/public/documents/");
    const storagePath = pathSegments[1];

    if (!storagePath) {
      // If not a Supabase URL, redirect to the URL directly
      return NextResponse.redirect(document.fileUrl);
    }

    const { signedUrl, expiresAt } = await getSignedUrl(
      BUCKETS.DOCUMENTS,
      storagePath,
      3600 // 1 hour
    );

    return NextResponse.json({ signedUrl, expiresAt });
  } catch (error) {
    console.error("GET document download error:", error);
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Implement document OCR trigger**

Create `apps/web/src/app/api/documents/[documentId]/ocr/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { downloadFile, BUCKETS } from "@axle/storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const document = await prisma.document.findFirst({
      where: { id: documentId, client: { orgId: member.orgId } },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Mark as processing
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: "PROCESSING" },
    });

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY required");

      // Download file from storage
      const url = new URL(document.fileUrl);
      const pathSegments = url.pathname.split("/storage/v1/object/public/documents/");
      const storagePath = pathSegments[1];

      let buffer: Buffer;
      if (storagePath) {
        buffer = await downloadFile(BUCKETS.DOCUMENTS, storagePath);
      } else {
        const response = await fetch(document.fileUrl);
        buffer = Buffer.from(await response.arrayBuffer());
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Analyze this document and extract all text content.
Return a JSON object with these fields:
- title: document title (if identifiable)
- content: full text content
- documentType: type of document (e.g., "사업자등록증", "재무제표", "계약서", etc.)
- keyFields: object with key-value pairs of important fields found
- language: detected language
- pageCount: estimated number of pages`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: document.fileType,
          },
        },
      ]);

      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const ocrResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: responseText };

      await prisma.document.update({
        where: { id: documentId },
        data: {
          ocrStatus: "COMPLETED",
          ocrResult,
        },
      });

      return NextResponse.json({ status: "COMPLETED", ocrResult });
    } catch (ocrError) {
      await prisma.document.update({
        where: { id: documentId },
        data: { ocrStatus: "FAILED" },
      });
      throw ocrError;
    }
  } catch (error) {
    console.error("POST document OCR error:", error);
    return NextResponse.json({ error: "OCR processing failed" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/documents/__tests__/route.test.ts
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/documents/
git commit -m "feat: add Document API routes (CRUD, download, OCR trigger, version tracking)"
```

---

## Task 4: Token-Based Upload

**Files:**
- Create: `apps/web/src/app/api/upload-tokens/route.ts`
- Create: `apps/web/src/app/api/portal/upload/route.ts`
- Create: `apps/web/src/app/(portal)/upload/[token]/page.tsx`

- [ ] **Step 1: Create upload token generation API**

Create `apps/web/src/app/api/upload-tokens/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { uploadTokenSchema } from "@/lib/validations/document";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");

    const body = await req.json();
    const parsed = uploadTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientId, projectId, category, expiresInHours, label } = parsed.data;

    // Verify client
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: member.orgId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const token = randomUUID();
    const tokenExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Create a placeholder document with the upload token
    const document = await prisma.document.create({
      data: {
        clientId,
        projectId,
        name: label || "업로드 대기",
        fileUrl: "", // Will be set when file is uploaded
        fileType: "",
        category: category as any,
        uploadToken: token,
        tokenExpiresAt,
      },
    });

    const uploadUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/upload/${token}`;

    return NextResponse.json({
      token,
      uploadUrl,
      expiresAt: tokenExpiresAt,
      documentId: document.id,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/upload-tokens error:", error);
    return NextResponse.json({ error: "Failed to create upload token" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create portal upload API (no auth required)**

Create `apps/web/src/app/api/portal/upload/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { uploadFile, BUCKETS } from "@axle/storage";

/**
 * Token-based upload endpoint — no authentication required.
 * External clients use this to upload documents via a shared link.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token") as string;

    if (!token) {
      return NextResponse.json({ error: "Upload token is required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "파일을 업로드해주세요" }, { status: 400 });
    }

    // Find and validate token
    const document = await prisma.document.findUnique({
      where: { uploadToken: token },
      include: { client: { include: { org: true } } },
    });

    if (!document) {
      return NextResponse.json({ error: "유효하지 않은 업로드 링크입니다" }, { status: 404 });
    }

    if (document.tokenExpiresAt && document.tokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "업로드 링크가 만료되었습니다" }, { status: 410 });
    }

    if (document.fileUrl) {
      return NextResponse.json({ error: "이미 파일이 업로드되었습니다" }, { status: 409 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await uploadFile({
      bucket: BUCKETS.DOCUMENTS,
      buffer,
      fileName: file.name,
      contentType: file.type,
      orgId: document.client.orgId,
      subfolder: document.clientId,
    });

    // Update document with actual file info
    await prisma.document.update({
      where: { id: document.id },
      data: {
        name: file.name,
        fileUrl: uploadResult.publicUrl,
        fileType: file.type,
        uploadToken: null, // Consume the token
        tokenExpiresAt: null,
      },
    });

    return NextResponse.json({ success: true, fileName: file.name });
  } catch (error) {
    console.error("Portal upload error:", error);
    return NextResponse.json({ error: "업로드에 실패했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create portal upload page (no auth layout)**

Create `apps/web/src/app/(portal)/layout.tsx`:

```tsx
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
      {children}
    </div>
  );
}
```

Create `apps/web/src/app/(portal)/upload/[token]/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@axle/ui/card";
import { TokenUploadForm } from "@/components/portal/token-upload-form";

interface UploadPageProps {
  params: Promise<{ token: string }>;
}

export default async function TokenUploadPage({ params }: UploadPageProps) {
  const { token } = await params;

  const document = await prisma.document.findUnique({
    where: { uploadToken: token },
    include: {
      client: { select: { name: true } },
      project: { select: { title: true } },
    },
  });

  if (!document) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <h2 className="text-xl font-bold text-destructive">잘못된 링크</h2>
          <p className="mt-2 text-muted-foreground">유효하지 않은 업로드 링크입니다.</p>
        </CardContent>
      </Card>
    );
  }

  if (document.tokenExpiresAt && document.tokenExpiresAt < new Date()) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <h2 className="text-xl font-bold text-destructive">만료된 링크</h2>
          <p className="mt-2 text-muted-foreground">업로드 기한이 만료되었습니다. 담당자에게 문의해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  if (document.fileUrl) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <h2 className="text-xl font-bold text-green-600">업로드 완료</h2>
          <p className="mt-2 text-muted-foreground">이미 파일이 업로드되었습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle>서류 업로드</CardTitle>
        <CardDescription>
          {document.client.name}
          {document.project && ` — ${document.project.title}`}
        </CardDescription>
        {document.name !== "업로드 대기" && (
          <p className="text-sm font-medium mt-2">요청 서류: {document.name}</p>
        )}
      </CardHeader>
      <CardContent>
        <TokenUploadForm token={token} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create token upload form component**

Create `apps/web/src/components/portal/token-upload-form.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@axle/ui/button";

interface TokenUploadFormProps {
  token: string;
}

export function TokenUploadForm({ token }: TokenUploadFormProps) {
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);

      const res = await fetch("/api/portal/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "업로드 실패");
      }

      const result = await res.json();
      setSuccess(true);
      setFileName(result.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다");
    } finally {
      setUploading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h3 className="font-semibold text-green-600">업로드 완료</h3>
        <p className="text-sm text-muted-foreground">{fileName} 파일이 성공적으로 업로드되었습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={() => {
          const file = fileRef.current?.files?.[0];
          if (file) setFileName(file.name);
        }}
      />

      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0] && fileRef.current) {
            const dt = new DataTransfer();
            dt.items.add(e.dataTransfer.files[0]);
            fileRef.current.files = dt.files;
            setFileName(e.dataTransfer.files[0].name);
          }
        }}
      >
        {fileName ? (
          <p className="font-medium">{fileName}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-xs text-muted-foreground">PDF, HWP, DOCX, XLSX, 이미지 파일 지원 (최대 50MB)</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button
        onClick={handleUpload}
        disabled={!fileName || uploading}
        className="w-full"
      >
        {uploading ? "업로드 중..." : "업로드"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/upload-tokens/ apps/web/src/app/api/portal/ apps/web/src/app/\(portal\)/ apps/web/src/components/portal/
git commit -m "feat: add token-based document upload (generate token, external upload page, portal API)"
```

---

## Task 5: ChecklistTemplate CRUD

**Files:**
- Create: `apps/web/src/app/api/checklist-templates/route.ts`
- Create: `apps/web/src/app/api/checklist-templates/[templateId]/route.ts`
- Create: `apps/web/src/components/checklists/checklist-template-form.tsx`
- Create: `apps/web/src/components/checklists/checklist-template-list.tsx`
- Create: `apps/web/src/app/(app)/settings/checklists/page.tsx`

- [ ] **Step 1: Implement checklist template API routes**

Create `apps/web/src/app/api/checklist-templates/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { checklistTemplateCreateSchema } from "@/lib/validations/checklist";

export async function GET(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");
    const { searchParams } = new URL(req.url);
    const projectType = searchParams.get("projectType");

    const templates = await prisma.checklistTemplate.findMany({
      where: {
        orgId: member.orgId,
        ...(projectType ? { projectType: projectType as any } : {}),
      },
      orderBy: [{ projectType: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET checklist-templates error:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");

    const body = await req.json();
    const parsed = checklistTemplateCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        ...parsed.data,
        orgId: member.orgId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST checklist-templates error:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
```

Create `apps/web/src/app/api/checklist-templates/[templateId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { checklistTemplateUpdateSchema } from "@/lib/validations/checklist";

type Params = { templateId: string };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { templateId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const existing = await prisma.checklistTemplate.findFirst({
      where: { id: templateId, orgId: member.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = checklistTemplateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const template = await prisma.checklistTemplate.update({
      where: { id: templateId },
      data: parsed.data,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("PATCH checklist-template error:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { templateId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const existing = await prisma.checklistTemplate.findFirst({
      where: { id: templateId, orgId: member.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.checklistTemplate.delete({ where: { id: templateId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE checklist-template error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create checklist template list component**

Create `apps/web/src/components/checklists/checklist-template-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@axle/ui/button";
import { Card, CardContent } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import type { ChecklistTemplate, ProjectType } from "@axle/db";

const projectTypeLabels: Record<ProjectType, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처인증",
  SOBOOJANG_CERT: "소부장인증",
  RESEARCH_INSTITUTE: "기업부설연구소",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무분석",
  RESEARCH_TASK: "연구과제",
  BUNDLE: "번들",
};

interface ChecklistTemplateListProps {
  templates: ChecklistTemplate[];
  onEdit: (template: ChecklistTemplate) => void;
  onDelete: (templateId: string) => void;
}

export function ChecklistTemplateList({ templates, onEdit, onDelete }: ChecklistTemplateListProps) {
  const grouped = templates.reduce((acc, t) => {
    const key = t.projectType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, ChecklistTemplate[]>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-3">
          <h3 className="font-semibold text-lg">
            {projectTypeLabels[type as ProjectType] || type}
            <Badge variant="secondary" className="ml-2">{items.length}</Badge>
          </h3>
          <div className="space-y-2">
            {items
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((template) => (
                <Card key={template.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <span className="font-medium">{template.name}</span>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {template.isRequired && <Badge variant="destructive">필수</Badge>}
                      <Button variant="ghost" size="sm" onClick={() => onEdit(template)}>
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("이 템플릿을 삭제하시겠습니까?")) {
                            onDelete(template.id);
                          }
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
      {templates.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          등록된 체크리스트 템플릿이 없습니다
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create checklist template form**

Create `apps/web/src/components/checklists/checklist-template-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import type { ChecklistTemplate } from "@axle/db";

interface ChecklistTemplateFormProps {
  template?: ChecklistTemplate;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export function ChecklistTemplateForm({ template, onSubmit, onCancel }: ChecklistTemplateFormProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      projectType: formData.get("projectType"),
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      isRequired: formData.get("isRequired") === "on",
      sortOrder: Number(formData.get("sortOrder")) || 0,
    };

    try {
      await onSubmit(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {template ? "체크리스트 항목 수정" : "체크리스트 항목 추가"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectType">프로젝트 유형</Label>
            <select
              id="projectType"
              name="projectType"
              defaultValue={template?.projectType ?? "BUSINESS_PLAN"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="BUSINESS_PLAN">사업계획서</option>
              <option value="VENTURE_CERT">벤처인증</option>
              <option value="SOBOOJANG_CERT">소부장인증</option>
              <option value="RESEARCH_INSTITUTE">기업부설연구소</option>
              <option value="PATENT">특허</option>
              <option value="FINANCIAL_ANALYSIS">재무분석</option>
              <option value="RESEARCH_TASK">연구과제</option>
              <option value="BUNDLE">번들</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">항목명 *</Label>
            <Input id="name" name="name" defaultValue={template?.name ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <Input id="description" name="description" defaultValue={template?.description ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">정렬 순서</Label>
            <Input id="sortOrder" name="sortOrder" type="number" defaultValue={template?.sortOrder ?? 0} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isRequired" defaultChecked={template?.isRequired ?? true} />
            필수 항목
          </label>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {template ? "수정" : "추가"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create checklist settings page**

Create `apps/web/src/app/(app)/settings/checklists/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { ChecklistSettingsView } from "@/components/checklists/checklist-settings-view";

export default async function ChecklistSettingsPage() {
  const { member } = await getVerifiedOrgMember("");

  const templates = await prisma.checklistTemplate.findMany({
    where: { orgId: member.orgId },
    orderBy: [{ projectType: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">체크리스트 템플릿 관리</h1>
      <p className="text-muted-foreground">
        프로젝트 유형별 필요 서류 템플릿을 관리합니다. 프로젝트 생성 시 자동으로 체크리스트가 생성됩니다.
      </p>
      <ChecklistSettingsView templates={templates} />
    </div>
  );
}
```

Create `apps/web/src/components/checklists/checklist-settings-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui/button";
import { ChecklistTemplateList } from "./checklist-template-list";
import { ChecklistTemplateForm } from "./checklist-template-form";
import type { ChecklistTemplate } from "@axle/db";

export function ChecklistSettingsView({
  templates: initialTemplates,
}: {
  templates: ChecklistTemplate[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChecklistTemplate | undefined>();

  async function handleSubmit(data: any) {
    const url = editing
      ? `/api/checklist-templates/${editing.id}`
      : "/api/checklist-templates";
    const method = editing ? "PATCH" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setShowForm(false);
    setEditing(undefined);
    router.refresh();
  }

  async function handleDelete(templateId: string) {
    await fetch(`/api/checklist-templates/${templateId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(undefined); setShowForm(true); }}>
          템플릿 추가
        </Button>
      </div>

      {showForm && (
        <ChecklistTemplateForm
          template={editing}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}

      <ChecklistTemplateList
        templates={initialTemplates}
        onEdit={(t) => { setEditing(t); setShowForm(true); }}
        onDelete={handleDelete}
      />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/checklist-templates/ apps/web/src/components/checklists/ apps/web/src/app/\(app\)/settings/
git commit -m "feat: add ChecklistTemplate CRUD with settings page and project type grouping"
```

---

## Task 6: Document UI Components and Pages

**Files:**
- Create: `apps/web/src/components/documents/document-upload.tsx`
- Create: `apps/web/src/components/documents/document-table.tsx`
- Create: `apps/web/src/components/documents/document-status-badge.tsx`
- Create: `apps/web/src/components/documents/expiry-indicator.tsx`
- Create: `apps/web/src/app/(app)/documents/page.tsx`

- [ ] **Step 1: Create document status badge and expiry indicator**

Create `apps/web/src/components/documents/document-status-badge.tsx`:

```tsx
import { Badge } from "@axle/ui/badge";
import type { OcrStatus } from "@axle/db";

const ocrStatusConfig: Record<OcrStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  NONE: { label: "-", variant: "outline" },
  PROCESSING: { label: "처리중", variant: "secondary" },
  COMPLETED: { label: "완료", variant: "default" },
  FAILED: { label: "실패", variant: "destructive" },
};

export function DocumentStatusBadge({ status }: { status: OcrStatus }) {
  const config = ocrStatusConfig[status];
  if (status === "NONE") return null;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

Create `apps/web/src/components/documents/expiry-indicator.tsx`:

```tsx
interface ExpiryIndicatorProps {
  expiresAt: Date | null;
  autoRenew: boolean;
}

export function ExpiryIndicator({ expiresAt, autoRenew }: ExpiryIndicatorProps) {
  if (!expiresAt) return null;

  const now = new Date();
  const diffDays = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let colorClass = "text-muted-foreground";
  if (diffDays <= 0) colorClass = "text-destructive font-semibold";
  else if (diffDays <= 7) colorClass = "text-orange-500";
  else if (diffDays <= 30) colorClass = "text-yellow-600";

  return (
    <span className={`text-xs ${colorClass}`}>
      {diffDays <= 0 ? "만료됨" : `D-${diffDays}`}
      {autoRenew && " (자동갱신)"}
    </span>
  );
}
```

- [ ] **Step 2: Create document upload component**

Create `apps/web/src/components/documents/document-upload.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui/button";
import { Label } from "@axle/ui/label";

interface DocumentUploadProps {
  clientId: string;
  projectId?: string;
}

export function DocumentUpload({ clientId, projectId }: DocumentUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", clientId);
        if (projectId) formData.append("projectId", projectId);
        formData.append("category", "INPUT");

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `${file.name} 업로드 실패`);
        }
      }

      router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        id="doc-upload"
      />
      <Label htmlFor="doc-upload" className="cursor-pointer">
        <Button variant="outline" size="sm" asChild>
          <span>파일 선택</span>
        </Button>
      </Label>
      <Button size="sm" onClick={handleUpload} disabled={uploading}>
        {uploading ? "업로드 중..." : "업로드"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create document table**

Create `apps/web/src/components/documents/document-table.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Document } from "@axle/db";
import { DocumentStatusBadge } from "./document-status-badge";
import { ExpiryIndicator } from "./expiry-indicator";
import { Badge } from "@axle/ui/badge";
import { Button } from "@axle/ui/button";

type DocumentWithRelations = Document & {
  client: { id: string; name: string };
  project?: { id: string; title: string } | null;
};

const categoryLabels: Record<string, string> = {
  INPUT: "입력",
  OUTPUT: "출력",
  TEMPLATE: "양식",
  ISSUED: "발급",
};

interface DocumentTableProps {
  documents: DocumentWithRelations[];
}

export function DocumentTable({ documents }: DocumentTableProps) {
  async function triggerOcr(documentId: string) {
    await fetch(`/api/documents/${documentId}/ocr`, { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">파일명</th>
            <th className="px-4 py-3 text-left font-medium">고객사</th>
            <th className="px-4 py-3 text-left font-medium">분류</th>
            <th className="px-4 py-3 text-left font-medium">버전</th>
            <th className="px-4 py-3 text-left font-medium">OCR</th>
            <th className="px-4 py-3 text-left font-medium">만료</th>
            <th className="px-4 py-3 text-left font-medium">등록일</th>
            <th className="px-4 py-3 text-right font-medium">작업</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link
                  href={`/documents/${doc.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {doc.name}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">{doc.fileType}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{doc.client.name}</td>
              <td className="px-4 py-3">
                <Badge variant="outline">{categoryLabels[doc.category] || doc.category}</Badge>
              </td>
              <td className="px-4 py-3">v{doc.version}</td>
              <td className="px-4 py-3">
                <DocumentStatusBadge status={doc.ocrStatus} />
              </td>
              <td className="px-4 py-3">
                <ExpiryIndicator expiresAt={doc.expiresAt} autoRenew={doc.autoRenew} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(doc.createdAt).toLocaleDateString("ko-KR")}
              </td>
              <td className="px-4 py-3 text-right">
                {doc.ocrStatus === "NONE" && (
                  <Button variant="ghost" size="sm" onClick={() => triggerOcr(doc.id)}>
                    OCR
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {documents.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                등록된 서류가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create document list page**

Create `apps/web/src/app/(app)/documents/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { Input } from "@axle/ui/input";
import { Button } from "@axle/ui/button";
import Link from "next/link";
import { DocumentTable } from "@/components/documents/document-table";

interface DocumentsPageProps {
  searchParams: Promise<{
    clientId?: string;
    category?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const { member } = await getVerifiedOrgMember("");

  const page = Number(params.page) || 1;
  const limit = 20;

  const where = {
    client: { orgId: member.orgId },
    ...(params.clientId ? { clientId: params.clientId } : {}),
    ...(params.category ? { category: params.category as any } : {}),
    ...(params.q ? { name: { contains: params.q, mode: "insensitive" as const } } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">서류 관리</h1>
      </div>

      <div className="flex items-center gap-4">
        <form className="flex-1">
          <Input name="q" placeholder="파일명 검색..." defaultValue={params.q} />
        </form>
        <div className="flex gap-2">
          {["INPUT", "OUTPUT", "TEMPLATE", "ISSUED"].map((cat) => (
            <Link key={cat} href={`/documents?category=${cat}`}>
              <Button
                variant={params.category === cat ? "default" : "outline"}
                size="sm"
              >
                {{ INPUT: "입력", OUTPUT: "출력", TEMPLATE: "양식", ISSUED: "발급" }[cat]}
              </Button>
            </Link>
          ))}
          <Link href="/documents">
            <Button variant={!params.category ? "default" : "outline"} size="sm">
              전체
            </Button>
          </Link>
        </div>
      </div>

      <DocumentTable documents={documents} />

      {total > limit && (
        <div className="flex justify-center text-sm text-muted-foreground">
          {total}건 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/documents/ apps/web/src/app/\(app\)/documents/
git commit -m "feat: add document list page with table, OCR trigger, category filter, and expiry tracking"
```

---

## Task 7: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test
```

Expected: All tests pass — packages/db (6), packages/ocr (5), packages/storage (4), apps/web API tests.

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

Expected: Dev server starts. Navigate to `/documents` — page renders. `/settings/checklists` renders template management. `/upload/{invalid-token}` shows error page.

- [ ] **Step 4: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 2 complete — Documents, Storage, Token upload, Checklists, OCR"
```

---

## Summary

Phase 2 delivers:
- **packages/storage**: Supabase Storage client with upload, download, signed URLs, delete (tested)
- **Document CRUD**: Upload, list, view, delete with version tracking and category filtering
- **Token-based upload**: Generate upload tokens, external upload page (no auth), token expiry
- **ChecklistTemplate CRUD**: Per-project-type template management in settings
- **Document OCR**: Gemini Vision document analysis with ocrStatus tracking
- **Document preview**: Status badges, expiry indicators, OCR trigger buttons
- **Portal layout**: Separate layout for external client-facing pages

**Next:** Phase 3 (Project Workflow) builds on this to add project lifecycle management with state machine, bundles, and checklist integration.
