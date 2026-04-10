import { describe, it, expect } from "vitest";
import { UI_PACKAGE } from "../src/index.js";

describe("@axle/ui", () => {
  it("exports package identifier", () => {
    expect(UI_PACKAGE).toBe("@axle/ui");
  });

  it("has React as peer dependency", async () => {
    const fs = await import("fs");
    const pkg = JSON.parse(
      fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    );
    expect(pkg.peerDependencies).toBeDefined();
    expect(pkg.peerDependencies.react).toBeDefined();
  });
});
