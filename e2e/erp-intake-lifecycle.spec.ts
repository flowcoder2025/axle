import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

/**
 * Phase 20 ERP — Intake lifecycle coverage (A1~A9 in project_next_session_e2e).
 *
 * Covered here:
 *   A3 — PENDING draft → 폐기 버튼 → DISCARDED 상태로 전환 + 목록 반영
 *   A5 — OCR 실패 (errorMsg) 배너 노출 + 수동 입력 가능 상태
 *   A6 — matchSuggestions 가 review form 의 autocomplete 시드로 노출
 *   A7 — autoRegister 체크박스 토글 가능 (기본 ON → OFF 동작)
 *
 * Intentionally not covered at E2E layer (with reasons):
 *   A1 — 업로드 + OCR 라운드트립.
 *        Vercel Blob + Claude Vision 모두 CI 환경에 없음. 33개 단위
 *        테스트(WI-709a/b/c + WI-711)가 라우트 레벨에서 lock down.
 *   A2 — review → confirm → order happy path.
 *        e2e/erp-intake.spec.ts (WI-716)이 이미 커버.
 *   A4 — 더블 confirm 409.
 *        Form 이 submit 성공 시 스스로 disable + 페이지가 CONFIRMED 로
 *        리렌더되어 UI 에서 두 번째 클릭 자체가 불가능.
 *        API-level race 는 `apps/web/__tests__/api/erp/intake-confirm.test.ts`
 *        가 직접 검증.
 *   A8 — shouldRegister=false ad-hoc item 시 InventoryMovement 미생성.
 *        UI 토글은 본 스펙 A7 에서 다루지만, "InventoryMovement 미생성"
 *        은 DB 검증 외에는 확인 불가 → 단위 테스트
 *        (apps/web/__tests__/api/erp/intake-confirm.test.ts) 가 담당.
 *   A9 — confidence < 0.6 경고 배너.
 *        현재 review form 은 신뢰도 퍼센트 값만 표시하고 경고 배너 UI 가
 *        구현되지 않음. UI 가 들어오면 본 스펙에 A9 추가.
 *
 * Fixtures (packages/db/seed-e2e.ts §13):
 *   intake-e2e-discard          — PENDING, vendor "폐기 대상 거래처"
 *   intake-e2e-errored          — PENDING + errorMsg set (OCR fail surface)
 *   intake-e2e-with-suggestions — PENDING + matchSuggestions populated
 *                                  (existing product-e2e-edit + client-e2e-1)
 *   intake-e2e-low-confidence   — PENDING, parsedJson.confidence = 0.42
 */

const FIXTURE = {
  discardId: "intake-e2e-discard",
  erroredId: "intake-e2e-errored",
  withSuggestionsId: "intake-e2e-with-suggestions",
  lowConfidenceId: "intake-e2e-low-confidence",
} as const;

test.describe("ERP intake lifecycle @smoke", () => {
  test("A3: PENDING draft 폐기 → /erp/intake 로 redirect + 폐기 탭에 노출", async ({
    page,
  }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/intake/${FIXTURE.discardId}`);
    await expect(
      page.getByRole("heading", { name: "영수증 검토" }),
    ).toBeVisible();

    // The discard handler hits POST /api/erp/intake/[id]/discard then
    // router.push("/erp/intake"). No window.confirm in this flow.
    await page.getByRole("button", { name: "폐기" }).click();
    await page.waitForURL(/\/erp\/intake$/, { timeout: 15_000 });

    // Switch to the 폐기 tab — the discarded fixture must surface there now.
    // Other DISCARDED rows under org-e2e-1 may exist from prior runs; we
    // assert via the vendor name which is unique to this fixture.
    await page.getByRole("link", { name: "폐기" }).click();
    await page.waitForURL(/status=DISCARDED/);
    await expect(page.getByText("폐기 대상 거래처")).toBeVisible();
  });

  test("A5: errorMsg 가 있는 draft → OCR 경고 배너 + 수동 입력 활성", async ({
    page,
  }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/intake/${FIXTURE.erroredId}`);
    await expect(
      page.getByRole("heading", { name: "영수증 검토" }),
    ).toBeVisible();

    // The errored draft has parsedJson = {} so the form starts empty (no
    // vendor, no items). The OCR 경고 배너 is rendered as role=alert with
    // the seeded errorMsg embedded.
    const banner = page.getByRole("alert").filter({ hasText: /OCR 경고/ });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(
      "E2E seed — OCR provider returned 500.",
    );

    // Form fields are interactive (status === PENDING → not disabled). The
    // vendor input must accept text — proves the "수동 입력 가능" claim.
    const vendor = page.getByLabel("거래처");
    await vendor.fill("수기 입력 거래처");
    await expect(vendor).toHaveValue("수기 입력 거래처");
  });

  test("A6: matchSuggestions 가 autocomplete 시드로 노출", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/intake/${FIXTURE.withSuggestionsId}`);
    await expect(
      page.getByRole("heading", { name: "영수증 검토" }),
    ).toBeVisible();

    // Counterparty input is pre-filled from parsedJson.vendor (= CLIENTS.client1.name).
    // The matchSuggestions.counterparty.candidates seed is loaded into the
    // autocomplete's `initialSuggestions` prop. Surfacing the dropdown
    // requires focus; opening the dropdown then asserting an existing
    // client appears proves matchSuggestions wired up correctly.
    const counterparty = page.getByLabel("거래처");
    await expect(counterparty).toHaveValue("E2E Client A"); // seed vendor
    await counterparty.focus();
    // The dropdown renders candidates as buttons (or list items, depending on
    // the component's internal markup). We assert the seeded existing client
    // appears as a selectable option. If the implementation changes, this
    // assertion will still target the visible candidate label.
    await expect(
      page.getByRole("option", { name: /E2E Client A/ }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Item row 1's productName is pre-filled from parsedJson.items[0].name
    // (= "E2E 편집용 상품"). The matchSuggestions.items[0] seeded the
    // existing Product candidate.
    const item1 = page.getByLabel("품목 1 상품명");
    await expect(item1).toHaveValue("E2E 편집용 상품");
  });

  test("A7: autoRegister 체크박스 기본 ON → OFF 토글 동작", async ({ page }) => {
    await signInAsTestUser(page);

    // Reuse the with-suggestions fixture — we don't submit, only toggle, so
    // this is non-mutating and safe to repeat without seed reset.
    await page.goto(`/erp/intake/${FIXTURE.withSuggestionsId}`);
    const toggle = page.getByLabel("매칭 안 된 상품을 자동으로 신규 등록");
    await expect(toggle).toBeChecked();

    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();

    // Toggle back so the fixture leaves the form in the seeded default state
    // (defense in depth — other tests touching this draft expect default ON).
    await toggle.check();
    await expect(toggle).toBeChecked();
  });

  // A9 placeholder: re-enable when the confidence-warning banner ships.
  test.skip("A9: confidence < 0.6 경고 배너 (UI 미구현)", async () => {});
});
