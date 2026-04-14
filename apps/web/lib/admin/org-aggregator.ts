import { prisma } from "@axle/db";

/**
 * Aggregate stats for an organization detail page.
 * Organization has no direct Project relation; path is Org -> Client -> Project.
 * Note: Client uses `orgId` (not `organizationId`) as the FK to Organization.
 */
export type OrgStats = {
  memberCount: number;
  projectCount: number;
  clientCount: number;
  last7dEvents: number;
};

export async function getOrgStats(orgId: string): Promise<OrgStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [memberCount, projectCount, clientCount, last7dEvents] = await Promise.all([
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.project.count({ where: { client: { orgId } } }),
    prisma.client.count({ where: { orgId } }),
    prisma.analyticsEvent.count({
      where: { orgId, createdAt: { gte: since } },
    }),
  ]);

  return { memberCount, projectCount, clientCount, last7dEvents };
}
