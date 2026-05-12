import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInstalledModules,
  installModule,
  installPack,
  isModuleInstalled,
  registerModule,
  uninstallModule,
} from "../src/index.js";
import {
  MOD_PAYROLL,
  createMockPrisma,
  seedRegistry,
} from "./fixtures.js";

describe("WI-616 — installer", () => {
  beforeEach(() => {
    seedRegistry();
  });

  it("installs a module with no deps", async () => {
    const prisma = createMockPrisma();
    await installModule("org1", "customers", { prisma });
    expect(await isModuleInstalled("org1", "customers", { prisma })).toBe(true);
  });

  it("is idempotent — re-installing a module is a no-op", async () => {
    const prisma = createMockPrisma();
    await installModule("org1", "customers", { prisma });
    await installModule("org1", "customers", { prisma });
    expect(prisma._rowCount()).toBe(1);
  });

  it("blocks install when a hard dep is missing", async () => {
    const prisma = createMockPrisma();
    await expect(
      installModule("org1", "payroll", { prisma }),
    ).rejects.toThrow(/missing hard deps \[employees\]/);
  });

  it("allows install after the hard dep is satisfied", async () => {
    const prisma = createMockPrisma();
    await installModule("org1", "employees", { prisma });
    await installModule("org1", "payroll", { prisma });
    expect(await getInstalledModules("org1", { prisma })).toEqual([
      "employees",
      "payroll",
    ]);
  });

  it("invokes onInstall hook with org and prisma context", async () => {
    const prisma = createMockPrisma();
    const onInstall = vi.fn().mockResolvedValue(undefined);
    registerModule({ ...MOD_PAYROLL, deps: {}, onInstall });
    await installModule("org1", "payroll", { prisma });
    expect(onInstall).toHaveBeenCalledOnce();
    expect(onInstall).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org1", prisma }),
    );
  });

  it("installs a pack in dependency order", async () => {
    const prisma = createMockPrisma();
    await installPack("org1", "D", { prisma });
    expect(await getInstalledModules("org1", { prisma })).toEqual([
      "employees",
      "payroll",
    ]);
  });

  it("installs Pack B with chained admin module", async () => {
    const prisma = createMockPrisma();
    await installPack("org1", "B", { prisma });
    const installed = await getInstalledModules("org1", { prisma });
    expect(installed).toContain("programs");
    expect(installed).toContain("matching");
    expect(installed).toContain("hwpx-admin");
  });

  it("scopes installs per org", async () => {
    const prisma = createMockPrisma();
    await installModule("org1", "customers", { prisma });
    expect(await getInstalledModules("org2", { prisma })).toEqual([]);
  });

  it("uninstalls a module with no dependents", async () => {
    const prisma = createMockPrisma();
    await installModule("org1", "customers", { prisma });
    await uninstallModule("org1", "customers", { prisma });
    expect(await isModuleInstalled("org1", "customers", { prisma })).toBe(false);
  });

  it("blocks uninstall when an installed dependent exists", async () => {
    const prisma = createMockPrisma();
    await installPack("org1", "D", { prisma });
    await expect(
      uninstallModule("org1", "employees", { prisma }),
    ).rejects.toThrow(/installed dependents \[payroll\]/);
  });

  it("allows uninstall in reverse dependency order", async () => {
    const prisma = createMockPrisma();
    await installPack("org1", "D", { prisma });
    await uninstallModule("org1", "payroll", { prisma });
    await uninstallModule("org1", "employees", { prisma });
    expect(await getInstalledModules("org1", { prisma })).toEqual([]);
  });

  it("throws on installing an unknown module", async () => {
    const prisma = createMockPrisma();
    await expect(
      installModule("org1", "ghost", { prisma }),
    ).rejects.toThrow(/Unknown module/);
  });

  it("throws on installing an unknown pack", async () => {
    const prisma = createMockPrisma();
    await expect(
      installPack("org1", "ZZ", { prisma }),
    ).rejects.toThrow(/Unknown pack/);
  });
});
