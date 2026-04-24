/**
 * Tests for /api/clients/[clientId]/org-chart/export POST route (WI-329).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaClient = {
  findFirst: vi.fn(),
};

const mockGenerateOrgChartDocx = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: { client: mockPrismaClient },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@axle/docgen", () => ({
  generateOrgChartDocx: mockGenerateOrgChartDocx,
}));

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };

const storedChart = {
  companyName: "주식회사 제이이티",
  ceo: { name: "김희수", position: "대표이사" },
  departments: [
    { name: "연구개발전담부서", members: [{ name: "심재경", position: "연구팀장" }] },
  ],
};

function makeRequest(formData: FormData | null): Request {
  if (!formData) {
    return new Request("http://localhost/api/clients/c1/org-chart/export", {
      method: "POST",
      // Intentionally break multipart parsing by sending plain JSON.
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  }
  return new Request("http://localhost/api/clients/c1/org-chart/export", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
  mockGenerateOrgChartDocx.mockResolvedValue({
    docxBuffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
    fileName: "주식회사 제이이티-조직도.docx",
  });
});

describe("POST /api/clients/[clientId]/org-chart/export", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/org-chart/export/route"
    );
    const res = await POST(makeRequest(new FormData()) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the client belongs to a different org", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/org-chart/export/route"
    );
    const res = await POST(makeRequest(new FormData()) as never, {
      params: Promise.resolve({ clientId: "c-foreign" }),
    });
    expect(res.status).toBe(404);
  });

  it("falls back to the stored chart and returns a DOCX download", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: { organizationChart: storedChart },
    });

    const { POST } = await import(
      "../../app/api/clients/[clientId]/org-chart/export/route"
    );
    const res = await POST(makeRequest(new FormData()) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "officedocument.wordprocessingml.document",
    );
    expect(res.headers.get("Content-Disposition")).toContain(".docx");
    // The generator must be called with the stored chart.
    expect(mockGenerateOrgChartDocx).toHaveBeenCalledWith(
      storedChart,
      expect.objectContaining({ pngWidthPx: 500, pngHeightPx: 400 }),
    );
  });

  it("returns 400 when no chart is stored and no override is supplied", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: null,
    });
    const { POST } = await import(
      "../../app/api/clients/[clientId]/org-chart/export/route"
    );
    const res = await POST(makeRequest(new FormData()) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    expect(res.status).toBe(400);
    expect(mockGenerateOrgChartDocx).not.toHaveBeenCalled();
  });

  it("forwards the uploaded PNG into the generator", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: { organizationChart: storedChart },
    });

    const form = new FormData();
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    form.append(
      "png",
      new File([pngBytes], "chart.png", { type: "image/png" }),
    );
    form.append("widthPx", "640");
    form.append("heightPx", "480");

    const { POST } = await import(
      "../../app/api/clients/[clientId]/org-chart/export/route"
    );
    const res = await POST(makeRequest(form) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    expect(res.status).toBe(200);

    const [, opts] = mockGenerateOrgChartDocx.mock.calls[0];
    expect(opts.png).toBeInstanceOf(Buffer);
    expect(opts.pngWidthPx).toBe(640);
    expect(opts.pngHeightPx).toBe(480);
  });

  it("uses the chart override when provided", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: { organizationChart: { bogus: true } },
    });
    const override = {
      companyName: "override co",
      ceo: { name: "override ceo" },
      departments: [{ name: "팀A", members: [{ name: "a" }] }],
    };
    const form = new FormData();
    form.append("chart", JSON.stringify(override));

    const { POST } = await import(
      "../../app/api/clients/[clientId]/org-chart/export/route"
    );
    const res = await POST(makeRequest(form) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    expect(res.status).toBe(200);
    expect(mockGenerateOrgChartDocx).toHaveBeenCalledWith(
      override,
      expect.any(Object),
    );
  });

  it("returns 400 on invalid chart override JSON", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: null,
    });
    const form = new FormData();
    form.append("chart", "{not json");

    const { POST } = await import(
      "../../app/api/clients/[clientId]/org-chart/export/route"
    );
    const res = await POST(makeRequest(form) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    expect(res.status).toBe(400);
    expect(mockGenerateOrgChartDocx).not.toHaveBeenCalled();
  });
});
