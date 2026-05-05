import { afterEach, describe, expect, it } from "vitest";
import {
  FREE_MODE_SYSTEM_PROMPT,
  PRESETS,
  PRO_MODE_SYSTEM_PROMPT,
  RETOUCH_FREE,
  RETOUCH_PRO,
  applyPreset,
  getPreset,
  listPresetIds,
  registerPreset,
} from "../src/presets/index.js";
import { ImageGenerationError, type GenerationRequest } from "../src/index.js";

describe("PRO_MODE_SYSTEM_PROMPT — preserved canonical content", () => {
  it("is a non-empty string with multiple lines", () => {
    expect(typeof PRO_MODE_SYSTEM_PROMPT).toBe("string");
    expect(PRO_MODE_SYSTEM_PROMPT.length).toBeGreaterThan(200);
    expect(PRO_MODE_SYSTEM_PROMPT.split("\n").length).toBeGreaterThan(10);
  });

  it("encodes the load-bearing rules of FlowRetouch PRO mode", () => {
    // These keywords are the contract. If a future edit removes them,
    // the test fails — that is intentional, since the prompt is the
    // single source of truth for FlowRetouch + apps that import it.
    expect(PRO_MODE_SYSTEM_PROMPT).toMatch(/identity preservation/i);
    expect(PRO_MODE_SYSTEM_PROMPT).toMatch(/skin texture|pores/i);
    expect(PRO_MODE_SYSTEM_PROMPT).toMatch(/freckles|moles/i);
    expect(PRO_MODE_SYSTEM_PROMPT).toMatch(/aspect ratio/i);
    // Anti-patterns it explicitly rejects
    expect(PRO_MODE_SYSTEM_PROMPT).toMatch(/airbrush/i);
    expect(PRO_MODE_SYSTEM_PROMPT).toMatch(/no collage|no watermark|no text overlay/i);
  });

  it("FREE prompt is shorter and explicitly conservative compared to PRO", () => {
    expect(typeof FREE_MODE_SYSTEM_PROMPT).toBe("string");
    expect(FREE_MODE_SYSTEM_PROMPT.length).toBeLessThan(PRO_MODE_SYSTEM_PROMPT.length);
    expect(FREE_MODE_SYSTEM_PROMPT).toMatch(/free tier|free /i);
    expect(FREE_MODE_SYSTEM_PROMPT).toMatch(/light|conservative|mild/i);
    expect(FREE_MODE_SYSTEM_PROMPT).toMatch(/identity preservation/i);
  });
});

describe("RETOUCH_PRO and RETOUCH_FREE preset shapes", () => {
  it("RETOUCH_PRO is RETOUCH mode with style and pro tier metadata", () => {
    expect(RETOUCH_PRO.mode).toBe("RETOUCH");
    expect(RETOUCH_PRO.style).toBe("retouch-pro");
    expect(RETOUCH_PRO.count).toBe(1);
    expect(RETOUCH_PRO.metadata?.systemPrompt).toBe(PRO_MODE_SYSTEM_PROMPT);
    expect(RETOUCH_PRO.metadata?.tier).toBe("pro");
  });

  it("RETOUCH_FREE is RETOUCH mode with style and free tier metadata", () => {
    expect(RETOUCH_FREE.mode).toBe("RETOUCH");
    expect(RETOUCH_FREE.style).toBe("retouch-free");
    expect(RETOUCH_FREE.count).toBe(1);
    expect(RETOUCH_FREE.metadata?.systemPrompt).toBe(FREE_MODE_SYSTEM_PROMPT);
    expect(RETOUCH_FREE.metadata?.tier).toBe("free");
  });

  it("never carries a `prompt` field (user intent must come from caller)", () => {
    expect("prompt" in RETOUCH_PRO).toBe(false);
    expect("prompt" in RETOUCH_FREE).toBe(false);
  });
});

describe("PRESETS registry", () => {
  it("registers retouch-pro and retouch-free at canonical ids", () => {
    expect(PRESETS["retouch-pro"]).toBe(RETOUCH_PRO);
    expect(PRESETS["retouch-free"]).toBe(RETOUCH_FREE);
  });

  it("getPreset returns the registered entry, undefined for unknown", () => {
    expect(getPreset("retouch-pro")).toBe(RETOUCH_PRO);
    expect(getPreset("retouch-free")).toBe(RETOUCH_FREE);
    expect(getPreset("nonexistent")).toBeUndefined();
  });

  it("listPresetIds includes both retouch ids", () => {
    const ids = listPresetIds();
    expect(ids).toContain("retouch-pro");
    expect(ids).toContain("retouch-free");
  });

  describe("registerPreset", () => {
    afterEach(() => {
      delete PRESETS["test-temp-preset"];
    });

    it("adds new presets and getPreset finds them", () => {
      registerPreset("test-temp-preset", { mode: "POSTER", style: "test-temp-preset" });
      expect(getPreset("test-temp-preset")).toEqual({
        mode: "POSTER",
        style: "test-temp-preset",
      });
    });

    it("throws on id collision (silent shadow prevention)", () => {
      let captured: ImageGenerationError | undefined;
      try {
        registerPreset("retouch-pro", { mode: "RETOUCH" });
      } catch (e) {
        captured = e as ImageGenerationError;
      }
      expect(captured).toBeInstanceOf(ImageGenerationError);
      expect(captured!.code).toBe("INVALID_INPUT");
    });
  });
});

describe("applyPreset — merge semantics", () => {
  const baseReq: GenerationRequest = {
    prompt: "soften my skin and warm the tones",
    mode: "RETOUCH",
    sourceImage: "data:image/png;base64,SRC",
  };

  it("returns the request unchanged when style is undefined", () => {
    const req: GenerationRequest = { ...baseReq, style: undefined };
    expect(applyPreset(req)).toEqual(req);
  });

  it("returns the request unchanged when style is unknown (no throw)", () => {
    const req: GenerationRequest = { ...baseReq, style: "moody-fashion" };
    expect(applyPreset(req)).toEqual(req);
  });

  it("merges retouch-pro defaults onto the request", () => {
    const merged = applyPreset({ ...baseReq, style: "retouch-pro" });
    expect(merged.mode).toBe("RETOUCH"); // preset matches caller anyway
    expect(merged.style).toBe("retouch-pro");
    expect(merged.count).toBe(1);
    expect(merged.metadata?.systemPrompt).toBe(PRO_MODE_SYSTEM_PROMPT);
    expect(merged.metadata?.tier).toBe("pro");
    // Caller's required fields remain intact
    expect(merged.prompt).toBe(baseReq.prompt);
    expect(merged.sourceImage).toBe(baseReq.sourceImage);
  });

  it("caller fields override preset defaults (intent first)", () => {
    const merged = applyPreset({
      ...baseReq,
      style: "retouch-pro",
      count: 4, // caller wants 4 variants, override preset's 1
    });
    expect(merged.count).toBe(4);
  });

  it("metadata is shallow-merged: caller wins per key, preset survives others", () => {
    const merged = applyPreset({
      ...baseReq,
      style: "retouch-pro",
      metadata: { traceId: "abc-123", tier: "trial" }, // override tier
    });
    expect(merged.metadata?.traceId).toBe("abc-123");
    expect(merged.metadata?.tier).toBe("trial"); // caller wins
    expect(merged.metadata?.systemPrompt).toBe(PRO_MODE_SYSTEM_PROMPT); // preset survives
  });

  it("retouch-free preset injects FREE prompt", () => {
    const merged = applyPreset({ ...baseReq, style: "retouch-free" });
    expect(merged.metadata?.systemPrompt).toBe(FREE_MODE_SYSTEM_PROMPT);
    expect(merged.metadata?.tier).toBe("free");
  });

  it("does not mutate the original request", () => {
    const req: GenerationRequest = { ...baseReq, style: "retouch-pro" };
    const before = JSON.stringify(req);
    applyPreset(req);
    expect(JSON.stringify(req)).toBe(before);
  });

  it("does not mutate the preset object", () => {
    const before = JSON.stringify(RETOUCH_PRO);
    applyPreset({ ...baseReq, style: "retouch-pro", count: 7 });
    expect(JSON.stringify(RETOUCH_PRO)).toBe(before);
  });
});

describe("RETOUCH mode end-to-end (input: image + prompt + pro/free)", () => {
  it("PRO request shape matches the spec acceptance criterion", () => {
    const req: GenerationRequest = {
      prompt: "remove blemishes and balance skin tone",
      mode: "RETOUCH",
      sourceImage: "data:image/png;base64,USERPHOTO",
      style: "retouch-pro",
    };
    const merged = applyPreset(req);
    expect(merged.mode).toBe("RETOUCH");
    expect(merged.sourceImage).toBeTruthy();
    expect(merged.prompt).toBeTruthy();
    expect(merged.metadata?.tier).toBe("pro");
    expect(typeof merged.metadata?.systemPrompt).toBe("string");
  });

  it("FREE request shape matches the spec acceptance criterion", () => {
    const req: GenerationRequest = {
      prompt: "small touch-up",
      mode: "RETOUCH",
      sourceImage: "data:image/png;base64,USERPHOTO",
      style: "retouch-free",
    };
    const merged = applyPreset(req);
    expect(merged.mode).toBe("RETOUCH");
    expect(merged.metadata?.tier).toBe("free");
  });

  it("spreading the preset directly is also a valid construction pattern", () => {
    // Per spec doc — apps may build the request via spread instead of style:
    const req: GenerationRequest = {
      ...RETOUCH_PRO,
      prompt: "soft retouch",
      sourceImage: "data:image/png;base64,X",
    } as GenerationRequest;
    expect(req.mode).toBe("RETOUCH");
    expect(req.style).toBe("retouch-pro");
    expect(req.metadata?.systemPrompt).toBe(PRO_MODE_SYSTEM_PROMPT);
  });
});
