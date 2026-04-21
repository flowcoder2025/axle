/**
 * Manual Screenshot Automation
 *
 * 사용자 매뉴얼(`docs/manual/user/`)에 삽입할 스크린샷을 자동으로 생성합니다.
 *
 * 실행 방법:
 *   npx playwright test e2e/manual-screenshots.spec.ts --project=chromium
 *
 * 결과물 경로:
 *   docs/manual/user/images/{chapter}/{name}.png
 *
 * 설계 요점:
 * - 챕터별로 독립된 test를 만들어 브라우저 크래시가 다른 챕터에 전파되지 않게 함
 * - 로그인은 beforeAll에서 storageState로 캐시 → 각 test는 새 page로 시작
 * - 이미 캡처된 PNG가 있으면 스킵(증분 실행)
 * - 각 shot은 실패해도 다음 shot을 막지 않음
 */

import path from "node:path";
import fs from "node:fs";
import { test as base, expect, type Page } from "@playwright/test";
import { signInAs } from "./helpers/auth";

type ShotSpec = {
  name: string;
  path: string;
  prepare?: (page: Page) => Promise<void>;
  fullPage?: boolean;
  waitFor?: string;
};

const ROOT = path.resolve(__dirname, "..", "docs", "manual", "user", "images");
const STATE_FILE = path.resolve(__dirname, ".manual-screenshots-state.json");

// 공통 goto — Next.js dev 모드의 networkidle 도달 불가 문제 회피
async function softGoto(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

// 탭 클릭 헬퍼 — role="tab"/button 둘 다 시도
async function clickTab(page: Page, label: string | RegExp) {
  const selectors = [
    page.getByRole("tab", { name: label }),
    page.getByRole("button", { name: label }),
    page.getByText(label, { exact: false }).first(),
  ];
  for (const loc of selectors) {
    try {
      await loc.click({ timeout: 3000 });
      await page.waitForTimeout(500);
      return true;
    } catch {
      // try next selector
    }
  }
  return false;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function capture(page: Page, chapter: string, shot: ShotSpec) {
  const dir = path.join(ROOT, chapter);
  ensureDir(dir);
  const file = path.join(dir, `${shot.name}.png`);
  if (fs.existsSync(file)) {
    console.log(`• skip ${chapter}/${shot.name} (already exists)`);
    return;
  }
  try {
    await softGoto(page, shot.path);
    if (shot.waitFor) {
      await page.waitForSelector(shot.waitFor, { state: "visible", timeout: 8_000 }).catch(() => {});
    }
    if (shot.prepare) {
      await shot.prepare(page);
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: file, fullPage: shot.fullPage ?? false, animations: "disabled" });
    console.log(`✓ ${chapter}/${shot.name}`);
  } catch (err) {
    console.warn(`✗ ${chapter}/${shot.name}: ${(err as Error).message.split("\n")[0]}`);
  }
}

// storageState를 파일로 공유하여 각 test가 별도 context로 재로그인하지 않게 함
const test = base.extend<object, { authState: string }>({
  authState: [
    async ({ browser }, use) => {
      if (!fs.existsSync(STATE_FILE)) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          await signInAs(page, "org1-owner");
          await ctx.storageState({ path: STATE_FILE });
        } finally {
          await ctx.close();
        }
      }
      await use(STATE_FILE);
    },
    { scope: "worker" },
  ],
});

test.use({ viewport: { width: 1440, height: 900 } });

// ── Chapter 00 ──────────────────────────────────────────────────────────
test("ch00 — 시작하기", async ({ browser }) => {
  test.setTimeout(180_000);

  // login은 인증 없이 찍어야 함
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await capture(page, "00", { name: "login", path: "/login" });
    await ctx.close();
  }

  // 인증 상태 확보
  if (!fs.existsSync(STATE_FILE)) {
    const tmp = await browser.newContext();
    const p = await tmp.newPage();
    await signInAs(p, "org1-owner");
    await tmp.storageState({ path: STATE_FILE });
    await tmp.close();
  }

  // 인증된 캡처
  const authCtx = await browser.newContext({ storageState: STATE_FILE });
  const pageAuth = await authCtx.newPage();
  await capture(pageAuth, "00", { name: "dashboard", path: "/dashboard" });
  await capture(pageAuth, "00", {
    name: "org-switch",
    path: "/dashboard",
    prepare: async (p) => {
      await p.getByRole("button", { name: /프로필|계정|사용자|Owner/i }).first().click().catch(() => {});
    },
  });
  await authCtx.close();
});

// ── 인증 필요 챕터 헬퍼 ────────────────────────────────────────────────
async function runAuthed(
  browser: import("@playwright/test").Browser,
  shots: Array<ShotSpec & { chapter: string }>,
) {
  if (!fs.existsSync(STATE_FILE)) {
    const tmp = await browser.newContext();
    const p = await tmp.newPage();
    await signInAs(p, "org1-owner");
    await tmp.storageState({ path: STATE_FILE });
    await tmp.close();
  }
  const ctx = await browser.newContext({ storageState: STATE_FILE });
  const page = await ctx.newPage();
  try {
    for (const shot of shots) {
      await capture(page, shot.chapter, shot);
    }
  } finally {
    await ctx.close();
  }
}

// ── Chapter 01 ──────────────────────────────────────────────────────────
test("ch01 — 고객사", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "01", name: "client-list",   path: "/clients" },
    { chapter: "01", name: "client-new",    path: "/clients/new" },
    { chapter: "01", name: "client-kanban", path: "/clients?view=kanban" },
    { chapter: "01", name: "client-detail", path: "/clients/manual-client-1" },
    { chapter: "01", name: "certificate-list", path: "/clients/manual-client-1",
      prepare: async (p) => { await clickTab(p, /인증서/); } },
    { chapter: "01", name: "master-profile", path: "/clients/manual-client-1",
      prepare: async (p) => { await clickTab(p, /성과/); } },
    { chapter: "01", name: "business-card-ocr", path: "/clients/manual-client-1",
      prepare: async (p) => { await clickTab(p, /인물/); } },
  ]);
});

// ── Chapter 02 ──────────────────────────────────────────────────────────
test("ch02 — 프로젝트", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "02", name: "project-list",   path: "/projects" },
    { chapter: "02", name: "project-new",    path: "/projects/new" },
    { chapter: "02", name: "project-kanban", path: "/projects?view=kanban" },
    { chapter: "02", name: "project-bundle", path: "/projects/new?type=BUNDLE" },
    { chapter: "02", name: "project-detail", path: "/projects/manual-project-1" },
    { chapter: "02", name: "project-status", path: "/projects/manual-project-1",
      prepare: async (p) => { await p.locator('[data-testid="project-status-badge"], button:has-text("상태")').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400); } },
    { chapter: "02", name: "project-team",   path: "/projects/manual-project-1",
      prepare: async (p) => { await clickTab(p, /팀원/); } },
  ]);
});

// ── Chapter 03 ──────────────────────────────────────────────────────────
test("ch03 — 서류", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "03", name: "document-list",   path: "/documents" },
    { chapter: "03", name: "document-upload", path: "/documents",
      prepare: async (p) => { await p.getByRole("button", { name: /업로드|추가|Upload/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "03", name: "checklist", path: "/projects/manual-project-1",
      prepare: async (p) => { await clickTab(p, /체크리스트/); } },
    { chapter: "03", name: "document-versions", path: "/projects/manual-project-1",
      prepare: async (p) => { await clickTab(p, /^서류$/); } },
    { chapter: "03", name: "token-upload", path: "/clients/manual-client-1",
      prepare: async (p) => { await p.getByRole("button", { name: /업로드 링크|포털|Token/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
  ]);
});

// ── Chapter 04 ──────────────────────────────────────────────────────────
test("ch04 — 미팅", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "04", name: "meeting-list",   path: "/meetings" },
    { chapter: "04", name: "meeting-new",    path: "/meetings/new" },
    { chapter: "04", name: "meeting-detail", path: "/meetings/manual-meeting-1" },
    { chapter: "04", name: "meeting-upload", path: "/meetings/manual-meeting-1",
      prepare: async (p) => { await clickTab(p, /녹음/); } },
    { chapter: "04", name: "meeting-transcript", path: "/meetings/manual-meeting-1",
      prepare: async (p) => { await clickTab(p, /전사|요약/); } },
    { chapter: "04", name: "action-to-project", path: "/meetings/manual-meeting-1",
      prepare: async (p) => { await clickTab(p, /액션/); } },
    { chapter: "04", name: "summary-email", path: "/meetings/manual-meeting-1",
      prepare: async (p) => {
        await clickTab(p, /전사|요약/);
        await p.getByRole("button", { name: /요약 메일|발송/i }).first().click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(500);
      } },
  ]);
});

// ── Chapter 05 ──────────────────────────────────────────────────────────
test("ch05 — 사업계획서", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "05", name: "draft-generate", path: "/projects/manual-project-1",
      prepare: async (p) => { await clickTab(p, /AI 작업|사업계획서|개요/); } },
    { chapter: "05", name: "precision-edit", path: "/projects/manual-project-1",
      prepare: async (p) => {
        await clickTab(p, /AI 작업|사업계획서/);
        await p.getByRole("button", { name: /정밀|양식/i }).first().click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(500);
      } },
    { chapter: "05", name: "self-evaluation", path: "/projects/manual-project-1",
      prepare: async (p) => {
        await clickTab(p, /AI 작업|사업계획서/);
        await p.getByRole("button", { name: /평가|검증/i }).first().click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(500);
      } },
  ]);
});

// ── Chapter 06 ──────────────────────────────────────────────────────────
test("ch06 — 견적계약", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "06", name: "estimate-list",    path: "/estimates" },
    { chapter: "06", name: "estimate-new",     path: "/estimates/new" },
    { chapter: "06", name: "estimate-detail",  path: "/estimates/manual-est-1" },
    { chapter: "06", name: "estimate-email",   path: "/estimates/manual-est-1",
      prepare: async (p) => { await p.getByRole("button", { name: /이메일|발송|Email/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "06", name: "estimate-to-contract", path: "/estimates/manual-est-1",
      prepare: async (p) => { await p.getByRole("button", { name: /계약서 생성|전환/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "06", name: "contract-signing", path: "/contracts/manual-contract-1" },
  ]);
});

// ── Chapter 07 ──────────────────────────────────────────────────────────
test("ch07 — 지원사업", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "07", name: "program-list",        path: "/programs" },
    { chapter: "07", name: "program-detail",      path: "/programs/manual-program-1" },
    { chapter: "07", name: "matching-dashboard",  path: "/matching" },
    { chapter: "07", name: "matching-result",     path: "/programs/manual-program-1",
      prepare: async (p) => { await clickTab(p, /매칭|고객사/); } },
  ]);
});

// ── Chapter 08 ──────────────────────────────────────────────────────────
test("ch08 — 캘린더", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "08", name: "calendar-month",       path: "/calendar" },
    { chapter: "08", name: "calendar-team",        path: "/calendar",
      prepare: async (p) => { await p.getByRole("button", { name: /팀|Team|주|월/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "08", name: "schedule-new",         path: "/calendar",
      prepare: async (p) => { await p.getByRole("button", { name: /일정 추가|\+ 일정|추가/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "08", name: "google-calendar-auth", path: "/settings/integrations" },
  ]);
});

// ── Chapter 09 ──────────────────────────────────────────────────────────
test("ch09 — 재무·성과", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "09", name: "finance-list",        path: "/finance" },
    { chapter: "09", name: "financial-input",     path: "/finance/manual-client-1" },
    { chapter: "09", name: "financial-analysis",  path: "/finance/manual-client-1",
      prepare: async (p) => { await clickTab(p, /분석|AI/); } },
    { chapter: "09", name: "finance-chart",       path: "/finance/manual-client-1",
      prepare: async (p) => { await clickTab(p, /차트|지표/); } },
    { chapter: "09", name: "achievement-new",     path: "/clients/manual-client-1",
      prepare: async (p) => { await clickTab(p, /성과/); } },
    { chapter: "09", name: "analytics-dashboard", path: "/analytics" },
  ]);
});

// ── Chapter 10 ──────────────────────────────────────────────────────────
test("ch10 — 연구일지", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "10", name: "journal-list",      path: "/journals" },
    { chapter: "10", name: "journal-new",       path: "/journals/new" },
    { chapter: "10", name: "journal-approval",  path: "/journals",
      prepare: async (p) => { await p.getByRole("button", { name: /제출됨|검토 대기|SUBMITTED/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "10", name: "monthly-report",    path: "/journals",
      prepare: async (p) => { await p.getByRole("button", { name: /월간 리포트|Report/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "10", name: "researcher-list",   path: "/journals",
      prepare: async (p) => { await clickTab(p, /연구원/); } },
    { chapter: "10", name: "researcher-portal", path: "/journals" },
  ]);
});

// ── Chapter 11 ──────────────────────────────────────────────────────────
test("ch11 — 알림", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "11", name: "notification-bell",     path: "/dashboard",
      prepare: async (p) => { await p.getByRole("button", { name: /알림|notification|bell/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "11", name: "notification-settings", path: "/settings/notifications" },
    { chapter: "11", name: "telegram-connect",      path: "/settings/notifications",
      prepare: async (p) => { await p.getByRole("button", { name: /Telegram|텔레그램|연결/i }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
    { chapter: "11", name: "trigger-map",           path: "/settings/organization" },
  ]);
});

// ── Chapter 12 ──────────────────────────────────────────────────────────
test("ch12 — 포털", async ({ browser }) => {
  test.setTimeout(180_000);
  await runAuthed(browser, [
    { chapter: "12", name: "portal-link-list", path: "/clients/manual-client-1",
      prepare: async (p) => { await clickTab(p, /포털|Portal|링크/); } },
    { chapter: "12", name: "portal-link-new",  path: "/clients/manual-client-1",
      prepare: async (p) => {
        await clickTab(p, /포털|Portal|링크/);
        await p.getByRole("button", { name: /링크 생성|\+ 링크/i }).first().click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(500);
      } },
    { chapter: "12", name: "portal-status",    path: "/portal" },
    { chapter: "12", name: "portal-checklist", path: "/portal" },
  ]);
});
