import { describe, it, expect } from "vitest";
import { AUTH_PACKAGE } from "../src/index.js";

describe("@axle/auth", () => {
  it("exports package identifier", () => {
    expect(AUTH_PACKAGE).toBe("@axle/auth");
  });

  it("resolves @axle/db workspace dependency", async () => {
    const db = await import("@axle/db");
    expect(db.DB_PACKAGE).toBe("@axle/db");
  });
});
