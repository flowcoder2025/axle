/**
 * Tests for ChecklistTemplate CRUD API
 * /api/checklist-templates (GET, POST)
 * /api/checklist-templates/[templateId] (GET, PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaChecklistTemplate = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    checklistTemplate: mockPrismaChecklistTemplate,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };
const TEMPLATE = {
  id: "tmpl-1",
  orgId: "org-1",
  projectType: "VENTURE_CERT",
  name: "사업자등록증",
  description: "사업자등록증 제출 항목",
  isRequired: true,
  sortOrder: 0,
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
});

// ==========================================
// Validation schema tests
// ==========================================

describe("checklistTemplateCreateSchema", () => {
  it("rejects missing projectType", async () => {
    const { checklistTemplateCreateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateCreateSchema.safeParse({ name: "Item" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", async () => {
    const { checklistTemplateCreateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateCreateSchema.safeParse({
      projectType: "VENTURE_CERT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid projectType enum value", async () => {
    const { checklistTemplateCreateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateCreateSchema.safeParse({
      projectType: "INVALID_TYPE",
      name: "Item",
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input (projectType + name only)", async () => {
    const { checklistTemplateCreateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateCreateSchema.safeParse({
      projectType: "VENTURE_CERT",
      name: "사업자등록증",
    });
    expect(result.success).toBe(true);
  });

  it("defaults isRequired to true", async () => {
    const { checklistTemplateCreateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateCreateSchema.safeParse({
      projectType: "PATENT",
      name: "출원서",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isRequired).toBe(true);
  });

  it("defaults sortOrder to 0", async () => {
    const { checklistTemplateCreateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateCreateSchema.safeParse({
      projectType: "BUSINESS_PLAN",
      name: "사업계획서",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sortOrder).toBe(0);
  });

  it("accepts all ProjectType enum values", async () => {
    const { checklistTemplateCreateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const types = [
      "BUSINESS_PLAN",
      "VENTURE_CERT",
      "SOBOOJANG_CERT",
      "RESEARCH_INSTITUTE",
      "PATENT",
      "FINANCIAL_ANALYSIS",
      "RESEARCH_TASK",
      "BUNDLE",
    ];
    for (const projectType of types) {
      const result = checklistTemplateCreateSchema.safeParse({
        projectType,
        name: "Test Item",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("checklistTemplateUpdateSchema", () => {
  it("allows all fields to be optional (empty object)", async () => {
    const { checklistTemplateUpdateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isRequired false on update", async () => {
    const { checklistTemplateUpdateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateUpdateSchema.safeParse({ isRequired: false });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only sortOrder", async () => {
    const { checklistTemplateUpdateSchema } = await import(
      "../../lib/validations/checklist"
    );
    const result = checklistTemplateUpdateSchema.safeParse({ sortOrder: 5 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sortOrder).toBe(5);
  });
});

// ==========================================
// Collection routes: GET + POST
// ==========================================

describe("GET /api/checklist-templates", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("GET", "http://localhost/api/checklist-templates");
    const res = await GET(req as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns all templates for the user's org", async () => {
    mockPrismaChecklistTemplate.findMany.mockResolvedValue([TEMPLATE]);
    const { GET } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("GET", "http://localhost/api/checklist-templates");
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("tmpl-1");
  });

  it("filters by projectType query param", async () => {
    mockPrismaChecklistTemplate.findMany.mockResolvedValue([TEMPLATE]);
    const { GET } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/checklist-templates?projectType=VENTURE_CERT",
    );
    await GET(req as never);
    expect(mockPrismaChecklistTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          projectType: "VENTURE_CERT",
        }),
      }),
    );
  });

  it("scopes query to the user's orgId", async () => {
    mockPrismaChecklistTemplate.findMany.mockResolvedValue([]);
    const { GET } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("GET", "http://localhost/api/checklist-templates");
    await GET(req as never);
    expect(mockPrismaChecklistTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-1" }),
      }),
    );
  });
});

describe("POST /api/checklist-templates", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("POST", "http://localhost/api/checklist-templates", {
      projectType: "VENTURE_CERT",
      name: "사업자등록증",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required projectType", async () => {
    const { POST } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("POST", "http://localhost/api/checklist-templates", {
      name: "사업자등록증",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for missing required name", async () => {
    const { POST } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("POST", "http://localhost/api/checklist-templates", {
      projectType: "VENTURE_CERT",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid projectType enum", async () => {
    const { POST } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("POST", "http://localhost/api/checklist-templates", {
      projectType: "INVALID",
      name: "Item",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("creates template and returns 201", async () => {
    mockPrismaChecklistTemplate.create.mockResolvedValue(TEMPLATE);
    const { POST } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("POST", "http://localhost/api/checklist-templates", {
      projectType: "VENTURE_CERT",
      name: "사업자등록증",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("tmpl-1");
  });

  it("injects orgId from session, not from body", async () => {
    mockPrismaChecklistTemplate.create.mockResolvedValue(TEMPLATE);
    const { POST } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = makeRequest("POST", "http://localhost/api/checklist-templates", {
      projectType: "PATENT",
      name: "출원서",
    });
    await POST(req as never);
    expect(mockPrismaChecklistTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1" }),
      }),
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import(
      "../../app/api/checklist-templates/route"
    );
    const req = new Request("http://localhost/api/checklist-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

// ==========================================
// Item routes: GET, PATCH, DELETE
// ==========================================

describe("GET /api/checklist-templates/[templateId]", () => {
  it("returns single template", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(TEMPLATE);
    const { GET } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/checklist-templates/tmpl-1",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("tmpl-1");
  });

  it("returns 404 when template not found", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/checklist-templates/ghost",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ templateId: "ghost" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/checklist-templates/tmpl-1",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("enforces org boundary (template from different org returns 404)", async () => {
    // findFirst with orgId filter returns null for cross-org access
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/checklist-templates/other-org-tmpl",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ templateId: "other-org-tmpl" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/checklist-templates/[templateId]", () => {
  it("updates and returns the template", async () => {
    const updated = { ...TEMPLATE, name: "수정된 항목", sortOrder: 3 };
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(TEMPLATE);
    mockPrismaChecklistTemplate.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/checklist-templates/tmpl-1",
      { name: "수정된 항목", sortOrder: 3 },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("수정된 항목");
    expect(body.data.sortOrder).toBe(3);
  });

  it("returns 404 when template does not exist", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/checklist-templates/ghost",
      { name: "New Name" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ templateId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/checklist-templates/tmpl-1",
      { name: "New Name" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid projectType on update", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(TEMPLATE);
    const { PATCH } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/checklist-templates/tmpl-1",
      { projectType: "INVALID_TYPE" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(TEMPLATE);
    const { PATCH } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = new Request("http://localhost/api/checklist-templates/tmpl-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("accepts partial update with only isRequired", async () => {
    const updated = { ...TEMPLATE, isRequired: false };
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(TEMPLATE);
    mockPrismaChecklistTemplate.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/checklist-templates/tmpl-1",
      { isRequired: false },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.isRequired).toBe(false);
  });
});

describe("DELETE /api/checklist-templates/[templateId]", () => {
  it("deletes template and returns 204", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(TEMPLATE);
    mockPrismaChecklistTemplate.delete.mockResolvedValue(TEMPLATE);
    const { DELETE } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/checklist-templates/tmpl-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(204);
    expect(mockPrismaChecklistTemplate.delete).toHaveBeenCalledWith({
      where: { id: "tmpl-1" },
    });
  });

  it("returns 404 when template does not exist", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/checklist-templates/ghost",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ templateId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/checklist-templates/tmpl-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ templateId: "tmpl-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("enforces org boundary on delete", async () => {
    mockPrismaChecklistTemplate.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/checklist-templates/[templateId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/checklist-templates/other-org-tmpl",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ templateId: "other-org-tmpl" }),
    });
    expect(res.status).toBe(404);
    expect(mockPrismaChecklistTemplate.delete).not.toHaveBeenCalled();
  });
});
