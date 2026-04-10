import { describe, it, expect } from "vitest";
import { DB_PACKAGE } from "../src/index.js";

describe("@axle/db", () => {
  it("exports package identifier", () => {
    expect(DB_PACKAGE).toBe("@axle/db");
  });
});
