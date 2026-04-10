import type { PrismaClient } from "@prisma/client";

/**
 * Generate a unique estimate number in the format EST-YYYY-NNNN
 * Uses a count-based approach with the current year prefix.
 */
export async function generateEstimateNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.estimate.count({
    where: { estimateNumber: { startsWith: `EST-${year}` } },
  });
  return `EST-${year}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Generate a unique contract number in the format CON-YYYY-NNNN
 * Uses a count-based approach with the current year prefix.
 */
export async function generateContractNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.contract.count({
    where: { contractNumber: { startsWith: `CON-${year}` } },
  });
  return `CON-${year}-${String(count + 1).padStart(4, "0")}`;
}
