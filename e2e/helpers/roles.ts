// e2e/helpers/roles.ts
export type E2ERole = "platform" | "org1-owner" | "org1-member" | "org2-owner";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env ${name}. For local runs, copy .env.e2e.example → .env.e2e and source it.`,
    );
  }
  return v;
}

export function getAccount(role: E2ERole): { email: string; password: string } {
  switch (role) {
    case "platform":
      return { email: requireEnv("E2E_PLATFORM_EMAIL"), password: requireEnv("E2E_PLATFORM_PASSWORD") };
    case "org1-owner":
      return { email: requireEnv("E2E_ORG1_OWNER_EMAIL"), password: requireEnv("E2E_ORG1_OWNER_PASSWORD") };
    case "org1-member":
      return { email: requireEnv("E2E_ORG1_MEMBER_EMAIL"), password: requireEnv("E2E_ORG1_MEMBER_PASSWORD") };
    case "org2-owner":
      return { email: requireEnv("E2E_ORG2_OWNER_EMAIL"), password: requireEnv("E2E_ORG2_OWNER_PASSWORD") };
  }
}

export const E2E_ROLES: readonly E2ERole[] = ["platform", "org1-owner", "org1-member", "org2-owner"] as const;

export const E2E_IDS = {
  orgs: { org1: "org-e2e-1", org2: "org-e2e-2" },
  clients: { org1: "client-e2e-1", org2: "client-e2e-2" },
  projects: {
    memberShared: "project-e2e-1", // org1-member has access
    ownerOnly: "project-e2e-2",    // org1-member has NO access
    org2: "project-e2e-3",
  },
  users: {
    platform: "e2e-platform",
    org1Owner: "e2e-org1-owner",
    org1Member: "e2e-org1-member",
    org2Owner: "e2e-org2-owner",
  },
} as const;

export function storageStatePath(role: E2ERole): string {
  return `.playwright-auth/${role}.json`;
}
