import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

// Regression E2E for PR #25 (WI-chore "미팅 요약 실패 상태를 UI에 노출").
// Before PR #25 the transcript panel showed "요약 생성 중입니다" even when the
// AiJob had actually FAILED — users could not tell the difference between
// queued work and a dead job. This test navigates to a seeded meeting whose
// transcript references a FAILED AiJob, opens the 전사/요약 tab, and asserts
// that the failure state (error box, errorMessage, 다시 시도 button) renders.
//
// Fixture seeded by packages/db/seed-e2e.ts:
//   meeting id         = meeting-e2e-failed-summary
//   transcript id      = transcript-e2e-failed-summary
//   aiJob id / status  = aijob-e2e-failed-summary / FAILED
//   errorMessage       = "E2E seeded failure — AI provider returned 500."
const FIXTURE_MEETING_ID = "meeting-e2e-failed-summary";
const FIXTURE_ERROR_MESSAGE = "E2E seeded failure — AI provider returned 500.";

test.describe("meeting AI summary failure UI @smoke", () => {
  test("FAILED AiJob surfaces error box + 다시 시도 button in 전사/요약 tab", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(`/meetings/${FIXTURE_MEETING_ID}`);
    await expect(
      page.getByRole("heading", { name: /E2E — AI Summary Failure Fixture/ }),
    ).toBeVisible();

    // Open the 전사/요약 tab (default tab is 정보).
    await page.getByRole("tab", { name: "전사/요약" }).click();

    // Failure box + error message from AiJob.errorMessage must be visible.
    await expect(page.getByText("요약 생성에 실패했습니다.")).toBeVisible();
    await expect(page.getByText(FIXTURE_ERROR_MESSAGE)).toBeVisible();

    // Retry CTA replaces the default "요약 생성" label when the job is FAILED.
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^요약 생성$/ })).toHaveCount(0);
  });
});
