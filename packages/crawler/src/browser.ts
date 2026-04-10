/**
 * Playwright browser singleton.
 *
 * Actual playwright is NOT installed as a dependency — it is expected to be
 * available at runtime on the OCI VM where playwright-core is present.
 * For tests, inject a mock via setBrowser().
 */
import type { BrowserLike } from "./types.js";

let browserInstance: BrowserLike | null = null;

/**
 * Returns the shared browser singleton.
 * On first call, launches a new browser using playwright-core (expected at runtime).
 * In test environments, use setBrowser() to inject a mock before calling getBrowser().
 */
export async function getBrowser(): Promise<BrowserLike> {
  if (browserInstance) return browserInstance;

  // Dynamic import so that missing playwright-core at build/test time is not fatal.
  // We use Function constructor to bypass TypeScript's static module resolution check.
  // playwright-core is intentionally absent from devDependencies; it is installed
  // only on the OCI VM at runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const importFn = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pw: any = await importFn("playwright-core").catch(() => {
    throw new Error(
      "playwright-core is not installed. Install it on the OCI VM or inject a mock via setBrowser()."
    );
  });

  const chromium = pw.chromium ?? pw.default?.chromium;
  if (!chromium) {
    throw new Error("playwright-core does not export chromium.");
  }

  browserInstance = await chromium.launch({ headless: true });
  return browserInstance as BrowserLike;
}

/** Close the shared browser and clear the singleton. */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Inject a browser mock (for tests).
 * Call closeBrowser() in afterEach/afterAll to reset.
 */
export function setBrowser(mock: BrowserLike): void {
  browserInstance = mock;
}
