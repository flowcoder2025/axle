import { describe, it, expect, vi, beforeEach } from "vitest";

const fakeOcr = {
  parseBusinessCard: vi.fn(),
  parseReceipt: vi.fn(),
};

// vi.mock is hoisted above imports. The lazy-import.loadModule that ocrHandler
// uses to dynamically resolve "@axle/ocr" is replaced with a stub returning
// the fakeOcr module. The specifier here is the relative path from this test
// file to the source module — vitest resolves both sides to the same module id.
vi.mock("../../src/dispatcher/lazy-import.js", () => ({
  loadModule: vi.fn(async () => fakeOcr),
}));

import { ocrHandler } from "../../src/dispatcher/handlers/ocr.js";

const sampleBase64 = Buffer.from("x").toString("base64");

beforeEach(() => {
  fakeOcr.parseBusinessCard.mockReset();
  fakeOcr.parseReceipt.mockReset();
});

describe("ocrHandler mode dispatch", () => {
  it("default mode = business-card (회귀)", async () => {
    fakeOcr.parseBusinessCard.mockResolvedValueOnce({ name: "X" });

    const result = await ocrHandler.run({
      imageBase64: sampleBase64,
      mimeType: "image/jpeg",
    });

    expect(fakeOcr.parseBusinessCard).toHaveBeenCalledTimes(1);
    expect(fakeOcr.parseReceipt).not.toHaveBeenCalled();
    expect((result as { name: string }).name).toBe("X");
  });

  it("mode=receipt → parseReceipt", async () => {
    fakeOcr.parseReceipt.mockResolvedValueOnce({ vendor: "GS25" });

    const result = await ocrHandler.run({
      imageBase64: sampleBase64,
      mimeType: "image/jpeg",
      mode: "receipt",
    });

    expect(fakeOcr.parseReceipt).toHaveBeenCalledTimes(1);
    expect(fakeOcr.parseBusinessCard).not.toHaveBeenCalled();
    expect((result as { vendor: string }).vendor).toBe("GS25");
  });

  it("mode=business-card → parseBusinessCard", async () => {
    fakeOcr.parseBusinessCard.mockResolvedValueOnce({ name: "Y" });

    const result = await ocrHandler.run({
      imageBase64: sampleBase64,
      mimeType: "image/jpeg",
      mode: "business-card",
    });

    expect(fakeOcr.parseBusinessCard).toHaveBeenCalledTimes(1);
    expect(fakeOcr.parseReceipt).not.toHaveBeenCalled();
    expect((result as { name: string }).name).toBe("Y");
  });
});
