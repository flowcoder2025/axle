/**
 * WI-324: BUNDLE 자동 완료 전이 테스트.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockProjectFindUnique,
  mockProjectUpdate,
  mockAutoCreateCert,
  mockEventEmit,
} = vi.hoisted(() => ({
  mockProjectFindUnique: vi.fn(),
  mockProjectUpdate: vi.fn(),
  mockAutoCreateCert: vi.fn(),
  mockEventEmit: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    project: {
      findUnique: mockProjectFindUnique,
      update: mockProjectUpdate,
    },
  },
}));

vi.mock("@/lib/services/project-certificate-auto", () => ({
  autoCreateCertificateFromProject: mockAutoCreateCert,
}));

vi.mock("@/lib/events/event-bus", () => ({
  eventBus: { emit: mockEventEmit },
}));

import { maybeCompleteBundleParent } from "@/lib/services/bundle-auto-complete";

beforeEach(() => {
  mockProjectFindUnique.mockReset();
  mockProjectUpdate.mockReset();
  mockAutoCreateCert.mockReset();
  mockEventEmit.mockReset();

  // Default stubs so optional paths don't throw.
  mockAutoCreateCert.mockResolvedValue({
    created: false,
    certificateId: null,
    reason: "BUNDLE_SKIPPED",
  });
  mockEventEmit.mockResolvedValue(undefined);
});

function stubChildLookup(parentId: string | null) {
  mockProjectFindUnique.mockResolvedValueOnce({ parentId });
}

function stubParentLookup(parent: {
  id: string;
  type: string;
  status: string;
  childStatuses: string[];
  clientId?: string;
  title?: string;
} | null) {
  if (parent === null) {
    mockProjectFindUnique.mockResolvedValueOnce(null);
    return;
  }
  mockProjectFindUnique.mockResolvedValueOnce({
    id: parent.id,
    type: parent.type,
    status: parent.status,
    clientId: parent.clientId ?? "client-1",
    title: parent.title ?? "Bundle Project",
    children: parent.childStatuses.map((status) => ({ status })),
  });
}

describe("maybeCompleteBundleParent", () => {
  it("returns NO_PARENT when the child has no parentId", async () => {
    stubChildLookup(null);
    const result = await maybeCompleteBundleParent("child-1");
    expect(result).toEqual({ completed: false, reason: "NO_PARENT" });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("returns NO_PARENT when the child record is missing entirely", async () => {
    // child findUnique returns null outright
    mockProjectFindUnique.mockResolvedValueOnce(null);
    const result = await maybeCompleteBundleParent("missing");
    expect(result).toEqual({ completed: false, reason: "NO_PARENT" });
  });

  it("returns NO_PARENT when the parent record cannot be loaded", async () => {
    stubChildLookup("parent-1");
    stubParentLookup(null);
    const result = await maybeCompleteBundleParent("child-1");
    expect(result).toEqual({ completed: false, reason: "NO_PARENT" });
  });

  it("returns PARENT_NOT_BUNDLE when parent type is something else", async () => {
    stubChildLookup("parent-1");
    stubParentLookup({
      id: "parent-1",
      type: "VENTURE_CERT",
      status: "IN_PROGRESS",
      childStatuses: ["COMPLETED"],
    });
    const result = await maybeCompleteBundleParent("child-1");
    expect(result).toEqual({ completed: false, reason: "PARENT_NOT_BUNDLE" });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });

  it("returns ALREADY_COMPLETED when the parent is already COMPLETED (idempotent)", async () => {
    stubChildLookup("parent-1");
    stubParentLookup({
      id: "parent-1",
      type: "BUNDLE",
      status: "COMPLETED",
      childStatuses: ["COMPLETED", "COMPLETED"],
    });
    const result = await maybeCompleteBundleParent("child-1");
    expect(result).toEqual({ completed: false, reason: "ALREADY_COMPLETED" });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("returns NO_CHILDREN when a BUNDLE has zero children (avoids every([]) === true trap)", async () => {
    stubChildLookup("parent-1");
    stubParentLookup({
      id: "parent-1",
      type: "BUNDLE",
      status: "IN_PROGRESS",
      childStatuses: [],
    });
    const result = await maybeCompleteBundleParent("child-1");
    expect(result).toEqual({ completed: false, reason: "NO_CHILDREN" });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });

  it("returns CHILDREN_PENDING when at least one sibling is not COMPLETED", async () => {
    stubChildLookup("parent-1");
    stubParentLookup({
      id: "parent-1",
      type: "BUNDLE",
      status: "IN_PROGRESS",
      childStatuses: ["COMPLETED", "COMPLETED", "APPROVED"],
    });
    const result = await maybeCompleteBundleParent("child-1");
    expect(result).toEqual({ completed: false, reason: "CHILDREN_PENDING" });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("transitions the parent to COMPLETED and emits PROJECT_COMPLETED when every child is COMPLETED", async () => {
    stubChildLookup("parent-1");
    stubParentLookup({
      id: "parent-1",
      type: "BUNDLE",
      status: "IN_PROGRESS",
      childStatuses: ["COMPLETED", "COMPLETED", "COMPLETED"],
      clientId: "client-42",
      title: "JET Bundle",
    });
    mockProjectUpdate.mockResolvedValueOnce({
      id: "parent-1",
      status: "COMPLETED",
    });
    mockAutoCreateCert.mockResolvedValueOnce({
      created: false,
      certificateId: null,
      reason: "BUNDLE_SKIPPED",
    });

    const result = await maybeCompleteBundleParent("child-1");
    expect(result.completed).toBe(true);
    if (!result.completed) throw new Error("expected completed=true");
    expect(result.parentId).toBe("parent-1");
    expect(result.completedAt).toBeInstanceOf(Date);

    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: "parent-1" },
      data: { status: "COMPLETED" },
    });
    expect(mockEventEmit).toHaveBeenCalledTimes(1);
    const [eventName, payload] = mockEventEmit.mock.calls[0];
    expect(eventName).toBe("PROJECT_COMPLETED");
    expect(payload).toMatchObject({
      projectId: "parent-1",
      projectType: "BUNDLE",
      clientId: "client-42",
      certificateCreated: false,
      certificateId: null,
    });
  });

  it("still emits when certificate service throws (transient failure must not block completion)", async () => {
    stubChildLookup("parent-1");
    stubParentLookup({
      id: "parent-1",
      type: "BUNDLE",
      status: "IN_PROGRESS",
      childStatuses: ["COMPLETED"],
    });
    mockProjectUpdate.mockResolvedValueOnce({ id: "parent-1", status: "COMPLETED" });
    mockAutoCreateCert.mockRejectedValueOnce(new Error("transient db blip"));

    const result = await maybeCompleteBundleParent("child-1");
    expect(result.completed).toBe(true);
    expect(mockEventEmit).toHaveBeenCalledTimes(1);
    const [, payload] = mockEventEmit.mock.calls[0];
    // Fell back to created=false / certId=null
    expect(payload.certificateCreated).toBe(false);
    expect(payload.certificateId).toBeNull();
  });
});
