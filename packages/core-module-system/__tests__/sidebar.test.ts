import { beforeEach, describe, expect, it } from "vitest";
import { buildSidebar } from "../src/index.js";
import { seedRegistry } from "./fixtures.js";

describe("WI-616 — buildSidebar", () => {
  beforeEach(() => {
    seedRegistry();
  });

  it("returns empty sections when nothing is installed", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: [],
      userPermissions: ["customers:*"],
    });
    expect(sections).toEqual([]);
  });

  it("renders one Pack A section with permitted modules only", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["customers", "projects", "finance"],
      userPermissions: ["customers:read", "projects:*"],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("A");
    const ids = sections[0].items.map((it) => it.moduleId);
    // finance hidden — user lacks finance:* scope
    expect(ids).toEqual(["customers", "projects"]);
  });

  it("places recommended pack before non-recommended", () => {
    // Pack A is recommended; install one module from A and one from D
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["customers", "employees"],
      userPermissions: ["customers:*", "hr:admin"],
    });
    expect(sections.map((s) => s.id)).toEqual(["A", "D"]);
  });

  it("sorts non-recommended packs alphabetically", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["programs", "employees", "create"],
      userPermissions: ["programs:*", "hr:admin", "content:write"],
    });
    expect(sections.map((s) => s.id)).toEqual(["B", "D", "E"]);
  });

  it("marks multiOrg modules as tenant-scoped when activeTenant is set", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      activeTenant: "managed-org-7",
      installedModules: ["employees", "customers"],
      userPermissions: ["hr:admin", "customers:*"],
    });
    const employees = sections
      .flatMap((s) => s.items)
      .find((it) => it.moduleId === "employees");
    const customers = sections
      .flatMap((s) => s.items)
      .find((it) => it.moduleId === "customers");
    expect(employees?.tenantScoped).toBe(true);
    expect(customers?.tenantScoped).toBe(false);
  });

  it("does not mark tenant scope when no activeTenant is set", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["employees"],
      userPermissions: ["hr:admin"],
    });
    const employees = sections[0].items[0];
    expect(employees.tenantScoped).toBe(false);
  });

  it("hides modules the user has no permission for", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["customers", "projects"],
      userPermissions: ["customers:read"],
    });
    const ids = sections.flatMap((s) => s.items).map((it) => it.moduleId);
    expect(ids).toEqual(["customers"]);
  });

  it("groups admin modules into a trailing Admin section", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["programs", "hwpx-admin"],
      userPermissions: ["programs:*", "platform:admin"],
    });
    expect(sections.map((s) => s.id)).toEqual(["B", "admin"]);
    expect(sections[1].items.map((it) => it.moduleId)).toEqual(["hwpx-admin"]);
  });

  it("marks Desktop Companion modules with requiresDesktop hint", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["automation"],
      userPermissions: ["automation:*"],
    });
    expect(sections[0].items[0].requiresDesktop).toBe(true);
  });

  it("wildcard permission grants access to specific verb requirements", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      installedModules: ["employees", "payroll"],
      userPermissions: ["hr:*"],
    });
    const ids = sections.flatMap((s) => s.items).map((it) => it.moduleId);
    expect(ids).toEqual(["employees", "payroll"]);
  });

  it("supports a complex multi-pack scenario with admin + multi-org", () => {
    const sections = buildSidebar({
      orgId: "org1",
      userId: "u1",
      activeTenant: "managed-org-3",
      installedModules: [
        "customers",
        "finance",
        "programs",
        "matching",
        "hwpx-admin",
        "employees",
        "payroll",
      ],
      userPermissions: [
        "customers:*",
        "finance:*",
        "programs:*",
        "matching:*",
        "hr:admin",
        "hr:write",
        "platform:admin",
      ],
    });
    expect(sections.map((s) => s.id)).toEqual(["A", "B", "D", "admin"]);

    // multi-org modules tenant-scoped, non-multi-org modules not scoped
    const flat = sections.flatMap((s) => s.items);
    expect(flat.find((it) => it.moduleId === "finance")?.tenantScoped).toBe(true);
    expect(flat.find((it) => it.moduleId === "matching")?.tenantScoped).toBe(true);
    expect(flat.find((it) => it.moduleId === "payroll")?.tenantScoped).toBe(true);
    expect(flat.find((it) => it.moduleId === "customers")?.tenantScoped).toBe(false);
    expect(flat.find((it) => it.moduleId === "programs")?.tenantScoped).toBe(false);

    // admin items are sorted by label
    const adminLabels = sections[3].items.map((it) => it.label);
    expect(adminLabels).toEqual([...adminLabels].sort());
  });
});
