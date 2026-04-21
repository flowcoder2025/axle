import { prisma } from "@axle/db";
import { verifyBusinessNumber } from "@axle/ocr";

/**
 * Fire-and-forget verification of a client's business registration status via
 * NTS(국세청) API. Failures are swallowed after logging so they cannot block
 * the originating request. This is intentionally decoupled from
 * generateMasterProfile — it writes the canonical status to Client columns so
 * the detail page can show it without re-hitting the API.
 */
export async function verifyAndStoreBusinessStatus(
  clientId: string,
  businessNumber: string
): Promise<void> {
  try {
    const result = await verifyBusinessNumber(businessNumber);
    await prisma.client.update({
      where: { id: clientId },
      data: {
        businessStatus: result.status,
        businessVerifiedAt: new Date(),
      },
    });
  } catch (err) {
    // Swallow all failures — this is a fire-and-forget hook.
    // Invalid formats, NTS downtime, or transient DB errors must never
    // propagate to the API caller.
    console.error(
      `[verifyAndStoreBusinessStatus] failed for client ${clientId}:`,
      err
    );
  }
}
