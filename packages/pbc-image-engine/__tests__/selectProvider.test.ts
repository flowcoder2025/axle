import { describe, expect, it } from "vitest";
import {
  getDefaultPreferences,
  selectProvider,
} from "../src/selectProvider.js";
import {
  GENERATION_MODES,
  IMAGE_PROVIDERS,
  ImageGenerationError,
  type GenerationMode,
  type GenerationRequest,
  type ImageProvider,
} from "../src/index.js";

const baseReq = (overrides: Partial<GenerationRequest> = {}): GenerationRequest => ({
  prompt: "studio cat",
  mode: "CREATE",
  ...overrides,
});

describe("selectProvider — explicit provider pin (caller wins)", () => {
  it("returns the pinned provider when no availability info is given", () => {
    expect(selectProvider(baseReq({ provider: "openrouter" }))).toBe("openrouter");
    expect(selectProvider(baseReq({ provider: "comfyui-local" }))).toBe("comfyui-local");
    expect(selectProvider(baseReq({ provider: "comfyui-cloud" }))).toBe("comfyui-cloud");
  });

  it("returns the pinned provider when its availability is explicitly true", () => {
    expect(
      selectProvider(baseReq({ provider: "vertex-ai" }), {
        available: { "vertex-ai": true },
      }),
    ).toBe("vertex-ai");
  });

  it("throws PROVIDER_UNAVAILABLE only when pinned provider is explicitly false", () => {
    let captured: ImageGenerationError | undefined;
    try {
      selectProvider(baseReq({ provider: "vertex-ai" }), {
        available: { "vertex-ai": false },
      });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured).toBeInstanceOf(ImageGenerationError);
    expect(captured!.code).toBe("PROVIDER_UNAVAILABLE");
    expect(captured!.retryable).toBe(false);
    expect(captured!.message).toContain("vertex-ai");
  });

  it("does NOT fall back when pinned provider is unavailable (caller intent is law)", () => {
    expect(() =>
      selectProvider(baseReq({ provider: "openrouter" }), {
        available: { openrouter: false, "google-genai": true },
      }),
    ).toThrow(/openrouter/);
  });
});

describe("selectProvider — default mode-based routing", () => {
  it("routes CREATE/POSTER/COMPOSITE/DETAIL_PAGE to google-genai first", () => {
    for (const mode of ["CREATE", "POSTER", "COMPOSITE", "DETAIL_PAGE"] as GenerationMode[]) {
      expect(selectProvider(baseReq({ mode }))).toBe("google-genai");
    }
  });

  it("routes EDIT/DETAIL_EDIT/RETOUCH to vertex-ai first (Imagen capability)", () => {
    for (const mode of ["EDIT", "DETAIL_EDIT", "RETOUCH"] as GenerationMode[]) {
      expect(selectProvider(baseReq({ mode }))).toBe("vertex-ai");
    }
  });

  it("falls back to next preference when first is unavailable", () => {
    expect(
      selectProvider(baseReq({ mode: "CREATE" }), {
        available: { "google-genai": false },
      }),
    ).toBe("openrouter");

    expect(
      selectProvider(baseReq({ mode: "EDIT" }), {
        available: { "vertex-ai": false },
      }),
    ).toBe("google-genai");

    expect(
      selectProvider(baseReq({ mode: "RETOUCH" }), {
        available: { "vertex-ai": false, "google-genai": false },
      }),
    ).toBe("openrouter");
  });

  it("never auto-picks ComfyUI providers (caller must pin them)", () => {
    for (const mode of GENERATION_MODES) {
      const picked = selectProvider(baseReq({ mode }));
      expect(picked).not.toBe("comfyui-local");
      expect(picked).not.toBe("comfyui-cloud");
    }
  });
});

describe("selectProvider — custom preferences override", () => {
  it("uses options.preferences instead of the mode default", () => {
    const prefs: ImageProvider[] = ["openrouter", "google-genai"];
    expect(
      selectProvider(baseReq({ mode: "CREATE" }), { preferences: prefs }),
    ).toBe("openrouter");
  });

  it("walks options.preferences in order", () => {
    expect(
      selectProvider(baseReq({ mode: "CREATE" }), {
        preferences: ["vertex-ai", "openrouter", "google-genai"],
        available: { "vertex-ai": false },
      }),
    ).toBe("openrouter");
  });

  it("permits ComfyUI providers in custom preferences (caller-as-policy)", () => {
    expect(
      selectProvider(baseReq({ mode: "CREATE" }), {
        preferences: ["comfyui-local", "google-genai"],
        available: { "comfyui-local": true },
      }),
    ).toBe("comfyui-local");
  });
});

describe("selectProvider — exhaustion", () => {
  it("throws PROVIDER_UNAVAILABLE when every default preference is false", () => {
    let captured: ImageGenerationError | undefined;
    try {
      selectProvider(baseReq({ mode: "CREATE" }), {
        available: {
          "google-genai": false,
          openrouter: false,
          "vertex-ai": false,
        },
      });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("PROVIDER_UNAVAILABLE");
    expect(captured?.retryable).toBe(false);
    expect(captured?.message).toMatch(/google-genai/);
    expect(captured?.message).toMatch(/openrouter/);
    expect(captured?.message).toMatch(/vertex-ai/);
  });

  it("throws when custom preferences are all unavailable", () => {
    expect(() =>
      selectProvider(baseReq({ mode: "EDIT" }), {
        preferences: ["vertex-ai", "google-genai"],
        available: { "vertex-ai": false, "google-genai": false },
      }),
    ).toThrow(/PROVIDER_UNAVAILABLE|not available|No image provider/i);
  });

  it("throws INVALID_INPUT when mode is missing or unknown", () => {
    let captured: ImageGenerationError | undefined;
    try {
      selectProvider({ prompt: "x", mode: "NOT_A_MODE" as GenerationMode });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("INVALID_INPUT");
  });
});

describe("getDefaultPreferences", () => {
  it("returns exactly 3 Direct API providers per mode (no ComfyUI)", () => {
    for (const mode of GENERATION_MODES) {
      const prefs = getDefaultPreferences(mode);
      expect(prefs).toHaveLength(3);
      expect(new Set(prefs).size).toBe(3);
      for (const p of prefs) {
        expect(["google-genai", "vertex-ai", "openrouter"]).toContain(p);
      }
    }
  });

  it("returns a fresh array (mutation-safe)", () => {
    const a = getDefaultPreferences("CREATE");
    a.push("comfyui-local");
    const b = getDefaultPreferences("CREATE");
    expect(b).toHaveLength(3);
    expect(b).not.toContain("comfyui-local");
  });

  it("covers every mode in GENERATION_MODES", () => {
    expect(GENERATION_MODES).toHaveLength(7);
    for (const mode of GENERATION_MODES) {
      expect(() => getDefaultPreferences(mode)).not.toThrow();
    }
  });
});

describe("selectProvider — every IMAGE_PROVIDERS id is valid input", () => {
  it("accepts each of the 5 spec providers as an explicit pin", () => {
    expect(IMAGE_PROVIDERS).toHaveLength(5);
    for (const provider of IMAGE_PROVIDERS) {
      expect(selectProvider(baseReq({ provider }))).toBe(provider);
    }
  });
});
