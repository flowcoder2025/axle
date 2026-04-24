/**
 * WI-331-fix: checklist-template-apply helper tests.
 *
 * Verifies the two BLOCKER fixes that motivated the helper:
 *   1. Platform-wide (orgId=null) seeds are matched (WI-304/309/315 enabling).
 *   2. ChecklistTemplateItem rows are flattened into ChecklistItem rows
 *      (not just the parent template row).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockTemplateFindMany, mockItemCreateMany } = vi.hoisted(() => ({
  mockTemplateFindMany: vi.fn(),
  mockItemCreateMany: vi.fn(),
}));

import { applyChecklistTemplates } from "@/lib/services/checklist-template-apply";

const mockTx = {
  checklistTemplate: { findMany: mockTemplateFindMany },
  checklistItem: { createMany: mockItemCreateMany },
} as never;

beforeEach(() => {
  mockTemplateFindMany.mockReset();
  mockItemCreateMany.mockReset();
  mockItemCreateMany.mockResolvedValue({ count: 0 });
});

describe("applyChecklistTemplates — query (BLOCKER #1)", () => {
  it("queries with OR=[org-specific, platform-wide] so seed templates match", async () => {
    mockTemplateFindMany.mockResolvedValueOnce([]);

    await applyChecklistTemplates(mockTx, {
      projectId: "p1",
      orgId: "org-1",
      projectType: "VENTURE_CERT",
    });

    const args = mockTemplateFindMany.mock.calls[0][0];
    expect(args.where).toEqual({
      OR: [{ orgId: "org-1" }, { orgId: null }],
      projectType: "VENTURE_CERT",
    });
  });

  it("orders templates and items by sortOrder asc", async () => {
    mockTemplateFindMany.mockResolvedValueOnce([]);

    await applyChecklistTemplates(mockTx, {
      projectId: "p1",
      orgId: "org-1",
      projectType: "PATENT",
    });

    const args = mockTemplateFindMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ sortOrder: "asc" });
    expect(args.include.items.orderBy).toEqual({ sortOrder: "asc" });
  });

  it("returns 0 templates / 0 items when nothing matches", async () => {
    mockTemplateFindMany.mockResolvedValueOnce([]);
    const result = await applyChecklistTemplates(mockTx, {
      projectId: "p1",
      orgId: "org-1",
      projectType: "PATENT",
    });
    expect(result).toEqual({ templatesMatched: 0, itemsCreated: 0 });
    expect(mockItemCreateMany).not.toHaveBeenCalled();
  });
});

describe("applyChecklistTemplates — flatten (BLOCKER #2)", () => {
  it("flattens ChecklistTemplateItem rows into ChecklistItem with phase prefix", async () => {
    mockTemplateFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "① 발명 신고",
        description: "phase 1",
        isRequired: true,
        items: [
          {
            id: "i1",
            name: "발명신고서",
            description: "신고서 설명",
            isRequired: true,
            itemType: "DOCUMENT",
            certificateType: null,
          },
          {
            id: "i2",
            name: "선행기술 조사",
            description: null,
            isRequired: false,
            itemType: "DOCUMENT",
            certificateType: null,
          },
        ],
      },
    ]);

    const result = await applyChecklistTemplates(mockTx, {
      projectId: "p1",
      orgId: "org-1",
      projectType: "PATENT",
    });

    expect(result).toEqual({ templatesMatched: 1, itemsCreated: 2 });

    const data = mockItemCreateMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({
      projectId: "p1",
      name: "① 발명 신고 - 발명신고서",
      description: "신고서 설명",
      isRequired: true,
      itemType: "DOCUMENT",
      certificateType: null,
    });
    expect(data[1].name).toBe("① 발명 신고 - 선행기술 조사");
    expect(data[1].isRequired).toBe(false);
    expect(data[1].description).toBeNull();
  });

  it("propagates CERTIFICATE itemType + certificateType so WI-325 auto-issue can match", async () => {
    mockTemplateFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "③ 신청 서류 + 확인서",
        description: null,
        isRequired: true,
        items: [
          {
            id: "i1",
            name: "벤처기업확인서",
            description: "최종 확인서",
            isRequired: true,
            itemType: "CERTIFICATE",
            certificateType: "벤처기업확인서",
          },
        ],
      },
    ]);

    await applyChecklistTemplates(mockTx, {
      projectId: "p1",
      orgId: "org-1",
      projectType: "VENTURE_CERT",
    });

    const data = mockItemCreateMany.mock.calls[0][0].data;
    expect(data[0].itemType).toBe("CERTIFICATE");
    expect(data[0].certificateType).toBe("벤처기업확인서");
  });

  it("falls back to a single header row when a template has no items (back-compat)", async () => {
    mockTemplateFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "Custom org-specific template",
        description: "no items",
        isRequired: true,
        items: [],
      },
    ]);

    const result = await applyChecklistTemplates(mockTx, {
      projectId: "p1",
      orgId: "org-1",
      projectType: "BUSINESS_PLAN",
    });

    expect(result).toEqual({ templatesMatched: 1, itemsCreated: 1 });
    const data = mockItemCreateMany.mock.calls[0][0].data;
    expect(data[0]).toEqual({
      projectId: "p1",
      name: "Custom org-specific template",
      description: "no items",
      isRequired: true,
    });
    expect(data[0].itemType).toBeUndefined();
    expect(data[0].certificateType).toBeUndefined();
  });

  it("interleaves multiple templates in sortOrder, each with its own items", async () => {
    mockTemplateFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "Phase A",
        description: null,
        isRequired: true,
        items: [
          { id: "i1", name: "doc1", description: null, isRequired: true, itemType: "DOCUMENT", certificateType: null },
          { id: "i2", name: "doc2", description: null, isRequired: true, itemType: "DOCUMENT", certificateType: null },
        ],
      },
      {
        id: "t2",
        name: "Phase B",
        description: null,
        isRequired: true,
        items: [
          { id: "i3", name: "doc3", description: null, isRequired: true, itemType: "DOCUMENT", certificateType: null },
        ],
      },
    ]);

    const result = await applyChecklistTemplates(mockTx, {
      projectId: "p1",
      orgId: "org-1",
      projectType: "VENTURE_CERT",
    });

    expect(result).toEqual({ templatesMatched: 2, itemsCreated: 3 });
    const data = mockItemCreateMany.mock.calls[0][0].data;
    expect(data.map((d: { name: string }) => d.name)).toEqual([
      "Phase A - doc1",
      "Phase A - doc2",
      "Phase B - doc3",
    ]);
  });
});
