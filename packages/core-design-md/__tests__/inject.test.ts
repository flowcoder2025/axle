/**
 * WI-613 — `tokensToCssVariables` / `tokensToTailwindConfig` tests.
 *
 * The renderers are pure projections of `DesignTokens`; the tests
 * pin the output shape, the namespacing rules (sidebar prefix), and
 * the determinism contract (alphabetical key order).
 */

import { describe, expect, it } from "vitest";
import {
  tokensToCssVariables,
  tokensToTailwindConfig,
  type DesignTokens,
} from "../src/index.js";

function fixtureTokens(): DesignTokens {
  return {
    colors: {
      light: {
        "text-primary": "#18181B",
        "background-base": "#FFFFFF",
        "border-default": "#E4E4E7",
      },
      dark: {
        "text-primary": "#FAFAFA",
        "background-base": "#0C0E12",
      },
    },
    sidebar: {
      light: { "sidebar-bg": "#FAFAFA", "sidebar-border": "#E4E4E7" },
      dark: { "sidebar-bg": "#0F1115" },
    },
    meta: { name: "FlowCoder Default", category: "Meta-Platform Baseline" },
  };
}

describe("WI-613 — tokensToCssVariables", () => {
  it("emits a `:root` block for light + a `.dark` block for dark", () => {
    const { light, dark } = tokensToCssVariables(fixtureTokens());
    expect(light).toContain(":root {");
    expect(light).toContain("--text-primary: #18181B;");
    expect(light).toContain("--background-base: #FFFFFF;");
    expect(dark).toContain(".dark {");
    expect(dark).toContain("--text-primary: #FAFAFA;");
    expect(dark).toContain("--background-base: #0C0E12;");
  });

  it("prefixes sidebar tokens with `--sidebar-` so they don't collide with neutral palette", () => {
    const { light, dark } = tokensToCssVariables(fixtureTokens());
    expect(light).toContain("--sidebar-sidebar-bg: #FAFAFA;");
    expect(light).toContain("--sidebar-sidebar-border: #E4E4E7;");
    expect(dark).toContain("--sidebar-sidebar-bg: #0F1115;");
  });

  it("emits tokens in deterministic (alphabetical) order within each block", () => {
    const { light } = tokensToCssVariables(fixtureTokens());
    // The light output is `<colors :root>\n\n<sidebar :root>`. Verify
    // each block is sorted internally — global sort isn't a contract
    // because the two blocks share the `:root` selector but use
    // different namespaces (`--<name>` vs `--sidebar-<name>`).
    const [colorsBlock, sidebarBlock] = light.split("\n\n");
    const colorsOrder = (colorsBlock ?? "").match(/--[a-z0-9-]+:/g) ?? [];
    const sidebarOrder = (sidebarBlock ?? "").match(/--[a-z0-9-]+:/g) ?? [];
    expect(colorsOrder).toEqual([...colorsOrder].sort());
    expect(sidebarOrder).toEqual([...sidebarOrder].sort());
  });

  it("produces byte-identical output on repeat calls (determinism)", () => {
    const a = tokensToCssVariables(fixtureTokens());
    const b = tokensToCssVariables(fixtureTokens());
    expect(a.light).toBe(b.light);
    expect(a.dark).toBe(b.dark);
  });

  it("returns an empty block (no token lines) when the record is empty", () => {
    const empty = tokensToCssVariables({
      colors: { light: {}, dark: {} },
      sidebar: { light: {}, dark: {} },
      meta: { name: "" },
    });
    expect(empty.light).toContain(":root {");
    expect(empty.light).not.toMatch(/--[a-z]/);
    expect(empty.dark).toContain(".dark {");
  });
});

describe("WI-613 — tokensToTailwindConfig", () => {
  it("returns a plain object with `colors` and `sidebar` records", () => {
    const cfg = tokensToTailwindConfig(fixtureTokens());
    expect(cfg).toEqual(
      expect.objectContaining({
        colors: expect.any(Object),
        sidebar: expect.any(Object),
        meta: expect.objectContaining({ name: "FlowCoder Default" }),
      }),
    );
  });

  it("merges light + dark into per-token `{ DEFAULT, dark }` shape", () => {
    const cfg = tokensToTailwindConfig(fixtureTokens()) as {
      colors: Record<string, { DEFAULT?: string; dark?: string }>;
    };
    expect(cfg.colors["text-primary"]).toEqual({
      DEFAULT: "#18181B",
      dark: "#FAFAFA",
    });
    expect(cfg.colors["border-default"]).toEqual({ DEFAULT: "#E4E4E7" }); // no dark
  });

  it("is JSON-serialisable (no functions, classes, or symbols)", () => {
    const cfg = tokensToTailwindConfig(fixtureTokens());
    expect(() => JSON.stringify(cfg)).not.toThrow();
    const round = JSON.parse(JSON.stringify(cfg));
    expect(round).toEqual(cfg);
  });

  it("omits meta.category when absent", () => {
    const cfg = tokensToTailwindConfig({
      colors: { light: {}, dark: {} },
      sidebar: { light: {}, dark: {} },
      meta: { name: "Bare" },
    }) as { meta: Record<string, unknown> };
    expect(cfg.meta).toEqual({ name: "Bare" });
    expect(cfg.meta.category).toBeUndefined();
  });
});
