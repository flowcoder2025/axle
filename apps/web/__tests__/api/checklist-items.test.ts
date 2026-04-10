/**
 * Tests for ChecklistItem API routes
 * GET  /api/projects/[projectId]/checklist
 * POST /api/projects/[projectId]/checklist
 * PATCH  /api/projects/[projectId]/checklist/[itemId]
 * DELETE /api/projects/[projectId]/checklist/[itemId]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProject = {
  findFirst: vi.fn(),
};

const mockChecklistItem = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: {
    project: mockProject,
    checklistItem: mockChecklistItem,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };

const PROJECT = { id: "proj-1", clientId: "client-1" };

const ITEM = {
  id: "item-1",
  projectId: "proj-1",
  name: "사업자등록증",
  description: null,
  isRequired: true,
  status: "PENDING",
  requestedAt: null,
  uploadedAt: null,
  documentId: null,
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
  mockProject.findFirst.mockResolvedValue(PROJECT);
});

// ---------------------------------------------------------------------------
// Validation schema tests
// ---------------------------------------------------------------------------

describe("checklistItemCreateSchema", () => {
  it("rejects missing name", async () => {
    const { checklistItemCreateSchema } = await import(
      "../../lib/validations/checklist-item"
    );
    expect(checklistItemCreateSchema.safeParse({}).success).toBe(false);
    expect(checklistItemCreateSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts name only", async () => {
    const { checklistItemCreateSchema } = await import(
      "../../lib/validations/checklist-item"
    );
    const result = checklistItemCreateSchema.safeParse({ name: "사업자등록증" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRequired).toBe(true);
    }
  });

  it("accepts isRequired false", async () => {
    const { checklistItemCreateSchema } = await import(
      "../../lib/validations/checklist-item"
    );
    const result = checklistItemCreateSchema.safeParse({
      name: "선택항목",
      isRequired: false,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isRequired).toBe(false);
  });
});

describe("checklistItemUpdateSchema", () => {
  it("accepts empty object", async () => {
    const { checklistItemUpdateSchema } = await import(
      "../../lib/validations/checklist-item"
    );
    expect(checklistItemUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid status value", async () => {
    const { checklistItemUpdateSchema } = await import(
      "../../lib/validations/checklist-item"
    );
    expect(
      checklistItemUpdateSchema.safeParse({ status: "INVALID" }).success,
    ).toBe(false);
  });

  it("accepts all valid status values", async () => {
    const { checklistItemUpdateSchema } = await import(
      "../../lib/validations/checklist-item"
    );
    for (const status of ["PENDING", "REQUESTED", "UPLOADED", "VERIFIED"]) {
      expect(checklistItemUpdateSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("accepts documentId null to unlink", async () => {
    const { checklistItemUpdateSchema } = await import(
      "../../lib/validations/checklist-item"
    );
    const result = checklistItemUpdateSchema.safeParse({ documentId: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/checklist
// ---------------------------------------------------------------------------

describe("GET /api/projects/[projectId]/checklist", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/proj-1/checklist");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/ghost/checklist");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns checklist items for the project", async () => {
    mockChecklistItem.findMany.mockResolvedValue([ITEM]);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/proj-1/checklist");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("item-1");
  });

  it("scopes findMany to the projectId", async () => {
    mockChecklistItem.findMany.mockResolvedValue([]);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/proj-1/checklist");
    await GET(req as never, { params: Promise.resolve({ projectId: "proj-1" }) });
    expect(mockChecklistItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "proj-1" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/checklist
// ---------------------------------------------------------------------------

describe("POST /api/projects/[projectId]/checklist", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/checklist", {
      name: "사업자등록증",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/ghost/checklist", {
      name: "사업자등록증",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing name", async () => {
    const { POST } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/checklist", {
      description: "설명만 있는 경우",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = new Request("http://localhost/api/projects/proj-1/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("creates item and returns 201", async () => {
    mockChecklistItem.create.mockResolvedValue(ITEM);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/checklist", {
      name: "사업자등록증",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("item-1");
  });

  it("injects projectId from URL, not from body", async () => {
    mockChecklistItem.create.mockResolvedValue(ITEM);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/checklist/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/checklist", {
      name: "사업자등록증",
    });
    await POST(req as never, { params: Promise.resolve({ projectId: "proj-1" }) });
    expect(mockChecklistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: "proj-1" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/checklist/[itemId]
// ---------------------------------------------------------------------------

describe("PATCH /api/projects/[projectId]/checklist/[itemId]", () => {
  beforeEach(() => {
    mockChecklistItem.findFirst.mockResolvedValue(ITEM);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/checklist/item-1",
      { status: "VERIFIED" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/ghost/checklist/item-1",
      { status: "VERIFIED" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "ghost", itemId: "item-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when item not found", async () => {
    mockChecklistItem.findFirst.mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/checklist/ghost",
      { status: "VERIFIED" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status", async () => {
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/checklist/item-1",
      { status: "INVALID_STATUS" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("updates status to VERIFIED and returns 200 (from UPLOADED)", async () => {
    // UPLOADED → VERIFIED is the only valid path to VERIFIED
    mockChecklistItem.findFirst.mockResolvedValue({
      ...ITEM,
      status: "UPLOADED",
      uploadedAt: new Date().toISOString(),
    });
    const updated = { ...ITEM, status: "VERIFIED" };
    mockChecklistItem.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/checklist/item-1",
      { status: "VERIFIED" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("VERIFIED");
  });

  it("returns 400 for invalid status transition (PENDING → VERIFIED)", async () => {
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/checklist/item-1",
      { status: "VERIFIED" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  it("sets requestedAt when transitioning PENDING→REQUESTED", async () => {
    const updated = { ...ITEM, status: "REQUESTED", requestedAt: new Date().toISOString() };
    mockChecklistItem.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/checklist/item-1",
      { status: "REQUESTED" },
    );
    await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(mockChecklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedAt: expect.any(Date) }),
      }),
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = new Request(
      "http://localhost/api/projects/proj-1/checklist/item-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/checklist/[itemId]
// ---------------------------------------------------------------------------

describe("DELETE /api/projects/[projectId]/checklist/[itemId]", () => {
  beforeEach(() => {
    mockChecklistItem.findFirst.mockResolvedValue(ITEM);
    mockChecklistItem.delete.mockResolvedValue(ITEM);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/proj-1/checklist/item-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/ghost/checklist/item-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "ghost", itemId: "item-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when item not found", async () => {
    mockChecklistItem.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/proj-1/checklist/ghost",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes item and returns 204", async () => {
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/proj-1/checklist/item-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "proj-1", itemId: "item-1" }),
    });
    expect(res.status).toBe(204);
    expect(mockChecklistItem.delete).toHaveBeenCalledWith({
      where: { id: "item-1" },
    });
  });

  it("enforces org boundary: does not delete items from other org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/checklist/[itemId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/other-proj/checklist/item-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "other-proj", itemId: "item-1" }),
    });
    expect(res.status).toBe(404);
    expect(mockChecklistItem.delete).not.toHaveBeenCalled();
  });
});
