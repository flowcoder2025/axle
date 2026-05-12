/**
 * WI-608 — apps/flowteams thin-shell wiring tests.
 *
 * The app delegates every domain decision to `@axle/pbc-hr-payroll`
 * (calculatePayroll / AttendanceService / LeaveService /
 * NomuConsultationService); the only code that lives here is the
 * factory that wires the PBC services to a Prisma client + the org
 * context. These tests pin the wiring so a future PBC rename can't
 * silently break the app.
 */

import { describe, expect, it, vi } from "vitest";

// @axle/db pulls in next-auth via the auth package transitively in
// some imports; mock the surface we use to stay hermetic.
vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    attendance: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    leave: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    nomuConsultation: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    payroll: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("apps/flowteams thin-shell wiring", () => {
  it("exposes statement renderers re-exported from @axle/pbc-hr-payroll", async () => {
    const flowteams = await import("../lib/services.js");
    expect(typeof flowteams.renderStatementMarkdown).toBe("function");
    expect(typeof flowteams.renderStatementHtml).toBe("function");
  });

  it("createFlowTeamsServices wires Prisma stores + Korean leave policy + payroll", async () => {
    const flowteams = await import("../lib/services.js");
    const services = flowteams.createFlowTeamsServices({
      organizationId: "org_test",
      tenureYearsResolver: () => 3,
    });
    expect(typeof services.attendance.recordCheckIn).toBe("function");
    expect(typeof services.attendance.recordCheckOut).toBe("function");
    expect(typeof services.attendance.summarize).toBe("function");
    expect(typeof services.leave.request).toBe("function");
    expect(typeof services.leave.balance).toBe("function");
    expect(typeof services.nomu.ask).toBe("function");
    expect(typeof services.nomu.validate).toBe("function");
    expect(typeof services.payroll.calculate).toBe("function");
    expect(typeof services.payroll.generateStatement).toBe("function");
  });

  it("payroll.calculate routes through createPayrollService and persists via prisma.payroll.create", async () => {
    const flowteams = await import("../lib/services.js");
    const db = await import("@axle/db");
    const payrollMock = (db.prisma as unknown as { payroll: { create: ReturnType<typeof vi.fn> } }).payroll;
    payrollMock.create.mockResolvedValueOnce({ id: "pay_x" });

    const services = flowteams.createFlowTeamsServices({
      organizationId: "org_test",
    });
    const result = await services.payroll.calculate({
      userId: "u1",
      orgId: "org_test",
      period: { year: 2026, month: 5 },
      baseSalary: 3_000_000,
    });
    expect(result.gross).toBe(3_000_000);
    expect(payrollMock.create).toHaveBeenCalledTimes(1);
    const createArgs = payrollMock.create.mock.calls[0]![0];
    expect(createArgs.data.organizationId).toBe("org_test");
    expect(createArgs.data.userId).toBe("u1");
    expect(createArgs.data.items.create).toHaveLength(7);
  });

  it("nomu service uses the stub AI client (deterministic placeholder until v1)", async () => {
    const flowteams = await import("../lib/services.js");
    const stub = flowteams.createPlaceholderNomuAiClient();
    const out = await stub.generateAnswer({
      question: "수습 기간에도 연차가 발생하나요?",
      redactedQuestion: "수습 기간에도 연차가 발생하나요?",
      orgId: "org_test",
      topic: { category: "LEAVE", confidence: 0.6 },
    });
    expect(out.answer).toMatch(/근로기준법/);
    expect(out.answer.length).toBeGreaterThanOrEqual(50);
  });

  it("FlowTeams enum mapping is verified at boot (default args wrapper)", async () => {
    const flowteams = await import("../lib/services.js");
    const r = flowteams.verifyDefaultFlowTeamsAttendanceEnumMapping();
    expect(r.ok).toBe(true);
  });

  it("workspace dependency resolves @axle/pbc-hr-payroll", async () => {
    const pbc = await import("@axle/pbc-hr-payroll");
    expect(typeof pbc.calculatePayroll).toBe("function");
    expect(typeof pbc.createAttendanceService).toBe("function");
    expect(typeof pbc.createLeaveService).toBe("function");
    expect(typeof pbc.createNomuConsultationService).toBe("function");
    expect(typeof pbc.createPayrollService).toBe("function");
    expect(typeof pbc.createPrismaPayrollStore).toBe("function");
    expect(typeof pbc.renderStatementMarkdown).toBe("function");
    expect(typeof pbc.renderStatementHtml).toBe("function");
  });
});
