import { describe, expect, it } from "vitest";
import {
  Z_IMAGE_WORKFLOW,
  defaultWorkflowIdForMode,
  getWorkflow,
  listWorkflowIds,
  registerWorkflow,
} from "../../src/providers/comfyui/workflows.js";
import type {
  ComfyUINode,
  ComfyUIWorkflowBuilder,
} from "../../src/providers/comfyui/types.js";
import type { GenerationRequest } from "../../src/types.js";

const baseReq = (overrides: Partial<GenerationRequest> = {}): GenerationRequest => ({
  prompt: "a tiger in a neon alley",
  mode: "CREATE",
  ...overrides,
});

describe("Z-Image workflow registry", () => {
  it("registers z-image-default at the spec id", () => {
    expect(Z_IMAGE_WORKFLOW.id).toBe("z-image-default");
    expect(getWorkflow("z-image-default")).toBe(Z_IMAGE_WORKFLOW);
    expect(listWorkflowIds()).toContain("z-image-default");
  });

  it("supports CREATE/POSTER/DETAIL_PAGE/COMPOSITE modes (text-to-image only)", () => {
    expect(Z_IMAGE_WORKFLOW.modes).toEqual([
      "CREATE",
      "POSTER",
      "DETAIL_PAGE",
      "COMPOSITE",
    ]);
  });

  it("returns z-image-default for default-supported modes, undefined otherwise", () => {
    expect(defaultWorkflowIdForMode("CREATE")).toBe("z-image-default");
    expect(defaultWorkflowIdForMode("POSTER")).toBe("z-image-default");
    expect(defaultWorkflowIdForMode("DETAIL_PAGE")).toBe("z-image-default");
    expect(defaultWorkflowIdForMode("COMPOSITE")).toBe("z-image-default");
    expect(defaultWorkflowIdForMode("EDIT")).toBeUndefined();
    expect(defaultWorkflowIdForMode("DETAIL_EDIT")).toBeUndefined();
    expect(defaultWorkflowIdForMode("RETOUCH")).toBeUndefined();
  });

  it("registerWorkflow can add new ids and getWorkflow finds them", () => {
    const fake: ComfyUIWorkflowBuilder = {
      id: "test-fake-workflow",
      modes: ["CREATE"],
      build: () => ({ prompt: {}, outputNodeIds: [] }),
    };
    registerWorkflow(fake);
    expect(getWorkflow("test-fake-workflow")).toBe(fake);
    expect(listWorkflowIds()).toContain("test-fake-workflow");
  });
});

describe("Z-Image workflow.build — graph topology", () => {
  it("emits the SDXL-class 7-node chain (loader→clip×2→latent→ksampler→vae→save)", () => {
    const wf = Z_IMAGE_WORKFLOW.build(baseReq());
    expect(Object.keys(wf.prompt).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(wf.prompt["1"].class_type).toBe("CheckpointLoaderSimple");
    expect(wf.prompt["2"].class_type).toBe("CLIPTextEncode");
    expect(wf.prompt["3"].class_type).toBe("CLIPTextEncode");
    expect(wf.prompt["4"].class_type).toBe("EmptyLatentImage");
    expect(wf.prompt["5"].class_type).toBe("KSampler");
    expect(wf.prompt["6"].class_type).toBe("VAEDecode");
    expect(wf.prompt["7"].class_type).toBe("SaveImage");
    expect(wf.outputNodeIds).toEqual(["7"]);
  });

  it("wires KSampler inputs to model/positive/negative/latent_image refs correctly", () => {
    const wf = Z_IMAGE_WORKFLOW.build(baseReq());
    const k = wf.prompt["5"] as ComfyUINode;
    expect(k.inputs.model).toEqual(["1", 0]);
    expect(k.inputs.positive).toEqual(["2", 0]);
    expect(k.inputs.negative).toEqual(["3", 0]);
    expect(k.inputs.latent_image).toEqual(["4", 0]);
  });

  it("VAEDecode reads from KSampler output and uses Loader vae output", () => {
    const wf = Z_IMAGE_WORKFLOW.build(baseReq());
    const v = wf.prompt["6"] as ComfyUINode;
    expect(v.inputs.samples).toEqual(["5", 0]);
    expect(v.inputs.vae).toEqual(["1", 2]);
  });

  it("SaveImage reads VAEDecode output and prefixes with axle/z-image", () => {
    const wf = Z_IMAGE_WORKFLOW.build(baseReq());
    const s = wf.prompt["7"] as ComfyUINode;
    expect(s.inputs.images).toEqual(["6", 0]);
    expect(s.inputs.filename_prefix).toBe("axle/z-image");
  });
});

describe("Z-Image workflow.build — request → graph mapping", () => {
  it("injects positive prompt into node 2 and negative into node 3", () => {
    const wf = Z_IMAGE_WORKFLOW.build(
      baseReq({ prompt: "tiger", negativePrompt: "blurry, low quality" }),
    );
    expect((wf.prompt["2"] as ComfyUINode).inputs.text).toBe("tiger");
    expect((wf.prompt["3"] as ComfyUINode).inputs.text).toBe("blurry, low quality");
  });

  it("uses empty negative when not specified", () => {
    const wf = Z_IMAGE_WORKFLOW.build(baseReq({ negativePrompt: undefined }));
    expect((wf.prompt["3"] as ComfyUINode).inputs.text).toBe("");
  });

  it("maps every aspect ratio to a documented (w,h) bucket", () => {
    const cases: Array<[GenerationRequest["aspectRatio"], number, number]> = [
      ["1:1", 1024, 1024],
      ["3:4", 896, 1152],
      ["4:3", 1152, 896],
      ["9:16", 768, 1344],
      ["16:9", 1344, 768],
      ["2:3", 832, 1216],
      ["3:2", 1216, 832],
    ];
    for (const [ratio, width, height] of cases) {
      const wf = Z_IMAGE_WORKFLOW.build(baseReq({ aspectRatio: ratio }));
      const latent = wf.prompt["4"] as ComfyUINode;
      expect(latent.inputs.width).toBe(width);
      expect(latent.inputs.height).toBe(height);
    }
  });

  it("falls back to 1024x1024 when aspectRatio is omitted", () => {
    const wf = Z_IMAGE_WORKFLOW.build(baseReq({ aspectRatio: undefined }));
    const latent = wf.prompt["4"] as ComfyUINode;
    expect(latent.inputs.width).toBe(1024);
    expect(latent.inputs.height).toBe(1024);
  });

  it("clamps batch_size from request.count to [1, 8]", () => {
    expect(
      ((Z_IMAGE_WORKFLOW.build(baseReq({ count: 0 })).prompt["4"] as ComfyUINode).inputs as { batch_size: number }).batch_size,
    ).toBe(1);
    expect(
      ((Z_IMAGE_WORKFLOW.build(baseReq({ count: 100 })).prompt["4"] as ComfyUINode).inputs as { batch_size: number }).batch_size,
    ).toBe(8);
    expect(
      ((Z_IMAGE_WORKFLOW.build(baseReq({ count: 4 })).prompt["4"] as ComfyUINode).inputs as { batch_size: number }).batch_size,
    ).toBe(4);
  });

  it("uses metadata.checkpoint when provided, otherwise z-image_v1.safetensors", () => {
    const def = Z_IMAGE_WORKFLOW.build(baseReq());
    expect((def.prompt["1"] as ComfyUINode).inputs.ckpt_name).toBe(
      "z-image_v1.safetensors",
    );
    const custom = Z_IMAGE_WORKFLOW.build(
      baseReq({ metadata: { checkpoint: "z-image-turbo.safetensors" } }),
    );
    expect((custom.prompt["1"] as ComfyUINode).inputs.ckpt_name).toBe(
      "z-image-turbo.safetensors",
    );
  });

  it("uses metadata.steps and metadata.cfg when within bounds", () => {
    const wf = Z_IMAGE_WORKFLOW.build(
      baseReq({ metadata: { steps: 30, cfg: 5.5 } }),
    );
    const k = wf.prompt["5"] as ComfyUINode;
    expect(k.inputs.steps).toBe(30);
    expect(k.inputs.cfg).toBe(5.5);
  });

  it("falls back to defaults when metadata.steps/cfg are out of bounds", () => {
    const wf = Z_IMAGE_WORKFLOW.build(
      baseReq({ metadata: { steps: 0, cfg: 50 } }),
    );
    const k = wf.prompt["5"] as ComfyUINode;
    expect(k.inputs.steps).toBe(20);
    expect(k.inputs.cfg).toBe(7.0);
  });

  it("seed is deterministic for the same prompt+mode (FNV-1a hash)", () => {
    const a = Z_IMAGE_WORKFLOW.build(baseReq({ prompt: "tiger", mode: "CREATE" }));
    const b = Z_IMAGE_WORKFLOW.build(baseReq({ prompt: "tiger", mode: "CREATE" }));
    const c = Z_IMAGE_WORKFLOW.build(baseReq({ prompt: "tiger", mode: "POSTER" }));
    const d = Z_IMAGE_WORKFLOW.build(baseReq({ prompt: "lion", mode: "CREATE" }));
    expect((a.prompt["5"] as ComfyUINode).inputs.seed).toEqual(
      (b.prompt["5"] as ComfyUINode).inputs.seed,
    );
    expect((a.prompt["5"] as ComfyUINode).inputs.seed).not.toEqual(
      (c.prompt["5"] as ComfyUINode).inputs.seed,
    );
    expect((a.prompt["5"] as ComfyUINode).inputs.seed).not.toEqual(
      (d.prompt["5"] as ComfyUINode).inputs.seed,
    );
  });

  it("metadata.seed pins the seed exactly (overriding hash)", () => {
    const wf = Z_IMAGE_WORKFLOW.build(baseReq({ metadata: { seed: 42 } }));
    expect((wf.prompt["5"] as ComfyUINode).inputs.seed).toBe(42);
  });

  it("seed is always a non-negative 32-bit integer", () => {
    for (const prompt of ["a", "longer prompt with spaces", "한글 프롬프트", "🎨"]) {
      const wf = Z_IMAGE_WORKFLOW.build(baseReq({ prompt }));
      const seed = (wf.prompt["5"] as ComfyUINode).inputs.seed as number;
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});
