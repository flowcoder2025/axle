import { describe, it, expect } from "vitest";
import { OrgPatchSchema, PlanQuotaSchema } from "@/lib/admin/org-schemas";

describe("OrgPatchSchema", () => {
  it("accepts a single valid field", () => {
    const result = OrgPatchSchema.safeParse({ plan: "pro" });
    expect(result.success).toBe(true);
  });

  it("accepts all fields together", () => {
    const result = OrgPatchSchema.safeParse({
      plan: "enterprise",
      quotaAiJobs: 500,
      quotaMembers: 50,
      isSuspended: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = OrgPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid plan value", () => {
    const result = OrgPatchSchema.safeParse({ plan: "platinum" });
    expect(result.success).toBe(false);
  });

  it("rejects negative quotaAiJobs", () => {
    const result = OrgPatchSchema.safeParse({ quotaAiJobs: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects quotaMembers below 1", () => {
    const result = OrgPatchSchema.safeParse({ quotaMembers: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer quotaAiJobs", () => {
    const result = OrgPatchSchema.safeParse({ quotaAiJobs: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("PlanQuotaSchema", () => {
  it("accepts plan/quota fields", () => {
    const result = PlanQuotaSchema.safeParse({
      plan: "free",
      quotaAiJobs: 100,
      quotaMembers: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects isSuspended (not in subset)", () => {
    const result = PlanQuotaSchema.safeParse({ isSuspended: true });
    // isSuspended is not defined, so object becomes {} after strip → empty refinement fails
    expect(result.success).toBe(false);
  });

  it("rejects empty object", () => {
    const result = PlanQuotaSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
