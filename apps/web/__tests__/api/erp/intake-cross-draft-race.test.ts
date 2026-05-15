/**
 * Cross-draft Product collision race — INTEGRATION test (WI-715).
 *
 * Acknowledges spec §9 Risk N2: the current confirm endpoint dedups
 * Products **within** a single draft transaction, but two parallel
 * confirms on different drafts that both want to register the same
 * name-only product can race and create duplicate Product rows (the
 * `findFirst → create` path has no DB-level unique constraint when
 * `sku IS NULL`).
 *
 * This test:
 *   1. Skips silently when no DATABASE_URL is present (CI default).
 *      Run locally with `DATABASE_URL=... npx vitest run \
 *        __tests__/api/erp/intake-cross-draft-race.test.ts`.
 *   2. Drives the race via `Promise.all` over two `prisma.$transaction`
 *      blocks that mirror the confirm route's name-only resolution path.
 *   3. Asserts the Product count is 1 OR 2 — explicitly documenting that
 *      2 is the current MVP limitation. Phase 21+ may add a partial unique
 *      index on `(orgId, lower(name)) WHERE sku IS NULL` or pre-image
 *      advisory locks; when it does, this test should tighten to `=== 1`.
 *
 * Why a custom transaction body instead of calling POST /confirm?
 *   - POST /confirm requires a fully seeded auth/tenant chain that the
 *     unit suite already mocks. This test isolates the race window in the
 *     product-resolution step (the actual lock that's missing).
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "vitest";

const HAS_DB =
  !!process.env.DATABASE_URL && !process.env.SKIP_INTEGRATION;
const dbDescribe = HAS_DB ? describe : describe.skip;

dbDescribe("ERP intake — cross-draft Product collision race", () => {
  // Lazily resolved so vitest collection doesn't pull @axle/db when skipped.
  let prisma: typeof import("@axle/db").prisma;

  const orgId = `org_race_${Date.now()}`;
  const userId = `user_race_${Date.now()}`;
  const productName = `RACE_${Date.now()}`;

  beforeAll(async () => {
    const mod = await import("@axle/db");
    prisma = mod.prisma;

    await prisma.organization.create({
      data: {
        id: orgId,
        name: "race-org",
        slug: orgId,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        name: "race user",
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    // Cleanup in FK-respecting order. Use deleteMany so reruns don't fail.
    await prisma.inventoryMovement.deleteMany({ where: { orgId } });
    await prisma.orderItem.deleteMany({
      where: { order: { orgId } },
    });
    await prisma.order.deleteMany({ where: { orgId } });
    await prisma.intakeDraft.deleteMany({ where: { orgId } });
    await prisma.product.deleteMany({ where: { orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("two parallel confirms on different drafts may produce 1 OR 2 Products (MVP limitation, spec §9 N2)", async () => {
    const drafts = await Promise.all(
      [1, 2].map((n) =>
        prisma.intakeDraft.create({
          data: {
            orgId,
            userId,
            blobUrl: `https://example.com/race-${n}.jpg`,
            ocrJson: {},
            parsedJson: {},
            matchSuggestions: [],
            status: "PENDING",
          },
        }),
      ),
    );

    // The actual race: two transactions try to resolve the same name-only
    // Product without a DB-level uniqueness guard.
    const resolveProduct = (draftId: string) =>
      prisma.$transaction(async (tx) => {
        const lock = await tx.intakeDraft.updateMany({
          where: { id: draftId, status: "PENDING", orgId },
          data: { status: "CONFIRMED" },
        });
        if (lock.count === 0) {
          throw new Error("lock failed");
        }
        const existing = await tx.product.findFirst({
          where: { orgId, name: productName, archived: false },
        });
        const product =
          existing ??
          (await tx.product.create({
            data: {
              orgId,
              name: productName,
              unit: "개",
              unitPrice: 0,
            },
          }));
        return product.id;
      });

    const ids = await Promise.all(drafts.map((d) => resolveProduct(d.id)));
    expect(ids).toHaveLength(2);

    const products = await prisma.product.findMany({
      where: { orgId, name: productName },
    });

    // MVP: 1 (won the race) or 2 (lost the race). Document the gap.
    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products.length).toBeLessThanOrEqual(2);

    if (products.length === 2) {
      // Surface the limitation in the test output so Phase 21+ work is
      // visible. This is NOT a failure — it's the documented MVP behavior.
      // eslint-disable-next-line no-console
      console.warn(
        `[spec §9 N2] cross-draft race produced 2 Products for orgId=${orgId}, name=${productName}. ` +
          "Tighten to ===1 once partial unique index lands (Phase 21+).",
      );
    }
  });
});
