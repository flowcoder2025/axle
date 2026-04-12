import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockTxProject = {
  create: vi.fn(),
};

const mockTxChecklistTemplate = {
  findMany: vi.fn(),
};

const mockTxChecklistItem = {
  createMany: vi.fn(),
};

const mockTx = {
  project: mockTxProject,
  checklistTemplate: mockTxChecklistTemplate,
  checklistItem: mockTxChecklistItem,
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  },
}));

import {
  createBundleChildren,
  createBundleChildrenStandalone,
  DEFAULT_BUNDLE_CHILD_TYPES,
  PROJECT_TYPE_LABELS,
} from "../../lib/services/project-bundle";

const BUNDLE_ID = "bundle-1";
const PARENT_TITLE = "ACME 통합 프로젝트";
const CLIENT_ID = "client-1";
const ORG_ID = "org-1";

beforeEach(() => {
  vi.resetAllMocks();
  // Default: no templates for any type
  mockTxChecklistTemplate.findMany.mockResolvedValue([]);
  // Each child project gets a distinct id
  let callCount = 0;
  mockTxProject.create.mockImplementation(async ({ data }: { data: { type: string; title: string } }) => ({
    id: `child-${++callCount}`,
    type: data.type,
    title: data.title,
    parentId: BUNDLE_ID,
    clientId: CLIENT_ID,
  }));
});

describe("DEFAULT_BUNDLE_CHILD_TYPES", () => {
  it("contains VENTURE_CERT, RESEARCH_INSTITUTE, PATENT", () => {
    expect(DEFAULT_BUNDLE_CHILD_TYPES).toEqual(
      expect.arrayContaining(["VENTURE_CERT", "RESEARCH_INSTITUTE", "PATENT"])
    );
    expect(DEFAULT_BUNDLE_CHILD_TYPES).toHaveLength(3);
  });
});

describe("PROJECT_TYPE_LABELS", () => {
  it("has a label for every project type", () => {
    const expectedTypes = [
      "BUSINESS_PLAN",
      "VENTURE_CERT",
      "SOBOOJANG_CERT",
      "RESEARCH_INSTITUTE",
      "PATENT",
      "FINANCIAL_ANALYSIS",
      "RESEARCH_TASK",
      "BUNDLE",
    ];
    for (const type of expectedTypes) {
      expect(PROJECT_TYPE_LABELS[type as keyof typeof PROJECT_TYPE_LABELS]).toBeTruthy();
    }
  });
});

describe("createBundleChildren", () => {
  it("creates the 3 default child projects when childTypes is omitted", async () => {
    await createBundleChildren(mockTx as never, BUNDLE_ID, PARENT_TITLE, CLIENT_ID, ORG_ID);

    expect(mockTxProject.create).toHaveBeenCalledTimes(3);
    const calls = mockTxProject.create.mock.calls.map((c: unknown[]) => (c[0] as { data: unknown }).data);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "VENTURE_CERT", parentId: BUNDLE_ID, clientId: CLIENT_ID }),
        expect.objectContaining({ type: "RESEARCH_INSTITUTE", parentId: BUNDLE_ID, clientId: CLIENT_ID }),
        expect.objectContaining({ type: "PATENT", parentId: BUNDLE_ID, clientId: CLIENT_ID }),
      ])
    );
  });

  it("composes child titles as '{parentTitle} - {typeLabel}'", async () => {
    await createBundleChildren(mockTx as never, BUNDLE_ID, PARENT_TITLE, CLIENT_ID, ORG_ID);

    const calls = mockTxProject.create.mock.calls.map((c: unknown[]) => (c[0] as { data: { title: string } }).data.title);
    expect(calls).toContain(`${PARENT_TITLE} - ${PROJECT_TYPE_LABELS["VENTURE_CERT"]}`);
    expect(calls).toContain(`${PARENT_TITLE} - ${PROJECT_TYPE_LABELS["RESEARCH_INSTITUTE"]}`);
    expect(calls).toContain(`${PARENT_TITLE} - ${PROJECT_TYPE_LABELS["PATENT"]}`);
  });

  it("uses custom childTypes when provided", async () => {
    await createBundleChildren(
      mockTx as never,
      BUNDLE_ID,
      PARENT_TITLE,
      CLIENT_ID,
      ORG_ID,
      ["SOBOOJANG_CERT", "PATENT"]
    );

    expect(mockTxProject.create).toHaveBeenCalledTimes(2);
    const types = mockTxProject.create.mock.calls.map((c: unknown[]) => (c[0] as { data: { type: string } }).data.type);
    expect(types).toEqual(["SOBOOJANG_CERT", "PATENT"]);
  });

  it("auto-applies checklist templates for each child type", async () => {
    const templates = [
      { id: "tpl-1", name: "벤처확인신청서", description: null, isRequired: true, sortOrder: 0 },
    ];
    // Return templates only for VENTURE_CERT, empty for others
    mockTxChecklistTemplate.findMany.mockImplementation(
      async ({ where }: { where: { projectType: string } }) =>
        where.projectType === "VENTURE_CERT" ? templates : []
    );

    await createBundleChildren(mockTx as never, BUNDLE_ID, PARENT_TITLE, CLIENT_ID, ORG_ID);

    // createMany should be called once (for VENTURE_CERT only)
    expect(mockTxChecklistItem.createMany).toHaveBeenCalledTimes(1);
    expect(mockTxChecklistItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ projectId: "child-1", name: "벤처확인신청서" }),
      ],
    });
  });

  it("skips createMany when no templates exist for a child type", async () => {
    mockTxChecklistTemplate.findMany.mockResolvedValue([]);
    await createBundleChildren(mockTx as never, BUNDLE_ID, PARENT_TITLE, CLIENT_ID, ORG_ID);

    expect(mockTxChecklistItem.createMany).not.toHaveBeenCalled();
  });

  it("queries checklist templates scoped to the provided orgId", async () => {
    await createBundleChildren(mockTx as never, BUNDLE_ID, PARENT_TITLE, CLIENT_ID, ORG_ID);

    for (const call of mockTxChecklistTemplate.findMany.mock.calls) {
      expect((call as [{ where: { orgId: string } }])[0].where.orgId).toBe(ORG_ID);
    }
  });
});

describe("createBundleChildrenStandalone", () => {
  it("wraps createBundleChildren in a prisma transaction", async () => {
    const { prisma } = await import("@axle/db");
    await createBundleChildrenStandalone(BUNDLE_ID, PARENT_TITLE, CLIENT_ID, ORG_ID);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Default 3 children created inside the transaction
    expect(mockTxProject.create).toHaveBeenCalledTimes(3);
  });

  it("passes custom childTypes through to the transaction", async () => {
    await createBundleChildrenStandalone(BUNDLE_ID, PARENT_TITLE, CLIENT_ID, ORG_ID, ["PATENT"]);

    expect(mockTxProject.create).toHaveBeenCalledTimes(1);
    expect(mockTxProject.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "PATENT" }) })
    );
  });
});
