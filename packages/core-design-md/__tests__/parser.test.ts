/**
 * WI-613 — `parseDesignMd` extraction tests.
 *
 * The parser is exercised against the real flowcoder-default.design.md
 * fixture (the spec the package was designed to consume) and against
 * hand-rolled malformed inputs that verify the no-throw contract.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  labelToTokenKey,
  parseDesignMd,
  type DesignTokens,
} from "../src/index.js";

const FIXTURE_PATH = resolve(
  __dirname,
  "../../../docs/specs/meta-platform/themes/flowcoder-default.design.md",
);
const FIXTURE = readFileSync(FIXTURE_PATH, "utf-8");

describe("WI-613 — labelToTokenKey", () => {
  it("converts Title Case labels to kebab-case", () => {
    expect(labelToTokenKey("Text Primary")).toBe("text-primary");
    expect(labelToTokenKey("Sidebar Active BG")).toBe("sidebar-active-bg");
    expect(labelToTokenKey("Border Default")).toBe("border-default");
  });

  it("trims separator punctuation and collapses runs", () => {
    expect(labelToTokenKey("  Surface  Raised  ")).toBe("surface-raised");
    expect(labelToTokenKey("Text — Subtle")).toBe("text-subtle");
  });
});

describe("WI-613 — parseDesignMd (flowcoder-default fixture)", () => {
  let tokens: DesignTokens;

  it("loads the fixture and produces a structurally complete result", () => {
    tokens = parseDesignMd(FIXTURE);
    expect(tokens).toMatchObject({
      colors: { light: expect.any(Object), dark: expect.any(Object) },
      sidebar: { light: expect.any(Object), dark: expect.any(Object) },
      meta: { name: expect.any(String) },
    });
  });

  it("extracts the title + category from the header", () => {
    tokens = parseDesignMd(FIXTURE);
    expect(tokens.meta.name).toBe("FlowCoder Default");
    expect(tokens.meta.category).toBe("Meta-Platform Baseline");
  });

  it("extracts the Neutral Scale palette (light + dark)", () => {
    tokens = parseDesignMd(FIXTURE);
    expect(tokens.colors.light["text-primary"]).toBe("#18181B");
    expect(tokens.colors.dark["text-primary"]).toBe("#FAFAFA");
    expect(tokens.colors.light["border-default"]).toBe("#E4E4E7");
    expect(tokens.colors.dark["background-base"]).toBe("#0C0E12");
    expect(tokens.colors.light["surface-raised"]).toBe("#F8F9FA");
    expect(tokens.colors.dark["surface-muted"]).toBe("#27272A");
  });

  it("extracts the Sidebar palette under the dedicated record", () => {
    tokens = parseDesignMd(FIXTURE);
    expect(tokens.sidebar.light["sidebar-bg"]).toBe("#FAFAFA");
    expect(tokens.sidebar.dark["sidebar-bg"]).toBe("#0F1115");
    expect(tokens.sidebar.light["sidebar-border"]).toBe("#E4E4E7");
    expect(tokens.sidebar.dark["sidebar-border"]).toBe("#1F2127");
  });

  it("skips rows that don't carry a hex value (rgba / accent reference)", () => {
    tokens = parseDesignMd(FIXTURE);
    // Sidebar Active BG row is `rgba(accent, 0.1) | rgba(accent, 0.15)`
    // — no hex literal → should NOT appear in the sidebar record.
    expect(tokens.sidebar.light["sidebar-active-bg"]).toBeUndefined();
    expect(tokens.sidebar.dark["sidebar-active-bg"]).toBeUndefined();
    // Sidebar Active Foreground = `accent` — also no hex, should be skipped.
    expect(tokens.sidebar.light["sidebar-active-foreground"]).toBeUndefined();
  });
});

describe("WI-613 — parseDesignMd (robustness)", () => {
  it("returns an empty token set for empty / whitespace input (no throw)", () => {
    expect(parseDesignMd("")).toEqual({
      colors: { light: {}, dark: {} },
      sidebar: { light: {}, dark: {} },
      meta: { name: "" },
    });
    expect(parseDesignMd("   \n\n  ")).toEqual({
      colors: { light: {}, dark: {} },
      sidebar: { light: {}, dark: {} },
      meta: { name: "" },
    });
  });

  it("ignores a malformed table block without throwing", () => {
    const broken = [
      "# Design System: Broken",
      "",
      "### Neutral Scale",
      "| Role | Light |",
      // Missing separator + truncated row.
      "| Text Primary",
    ].join("\n");
    expect(() => parseDesignMd(broken)).not.toThrow();
    const tokens = parseDesignMd(broken);
    expect(tokens.colors.light).toEqual({});
    expect(tokens.colors.dark).toEqual({});
  });

  it("ignores section headings other than Neutral Scale + Sidebar (out-of-scope for WI-613)", () => {
    const tokens = parseDesignMd(FIXTURE);
    // Typography roles ("Display Hero" etc.) and spacing constants live
    // under §3 / §4 — the WI-613 parser must not surface them.
    expect(tokens.colors.light["display-hero"]).toBeUndefined();
    expect(tokens.colors.light["sidebar-width"]).toBeUndefined();
  });
});
