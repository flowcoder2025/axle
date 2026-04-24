import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";
import { runCertificateRenewalScan } from "@/lib/services/certificate-renewal";

// POST /api/cron/certificate-renewal (WI-326)
// Scheduled: 0 8 * * * (daily at 08:00 UTC)
// Scan Certificates whose validTo lies within the next 90 days and, for any
// that are not already being renewed, create an INTAKE renewal project +
// notify the assignee. Idempotent: a Project tagged with
// `metadata.renewalOfCertificateId` prevents duplicate creation.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runCertificateRenewalScan();
    return NextResponse.json({ success: true, ...report });
  } catch (err) {
    return handleInternalError(err);
  }
}
