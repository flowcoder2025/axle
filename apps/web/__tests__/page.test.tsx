import { describe, it, expect } from "vitest";

describe("apps/web", () => {
  it("workspace dependencies resolve", async () => {
    const db = await import("@axle/db");
    const auth = await import("@axle/auth");
    const ui = await import("@axle/ui");

    expect(db.DB_PACKAGE).toBe("@axle/db");
    expect(auth.AUTH_PACKAGE).toBe("@axle/auth");
    expect(ui.UI_PACKAGE).toBe("@axle/ui");
  });
});
