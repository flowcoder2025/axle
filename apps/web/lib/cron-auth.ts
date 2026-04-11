/**
 * cron-auth — Vercel Cron job bearer-token authentication helper.
 *
 * Each cron route must call verifyCronAuth(request) before processing.
 * The CRON_SECRET environment variable must be set in Vercel project settings.
 */
export function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}
