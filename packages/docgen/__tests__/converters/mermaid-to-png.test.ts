import { describe, it, expect, vi } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn((_cmd: string, args: string[], _opts: unknown, cb: Function) => {
    const fs = require("fs");
    const outIdx = args.indexOf("-o");
    if (outIdx >= 0) {
      fs.writeFileSync(args[outIdx + 1], Buffer.from("fake-png"));
    }
    cb(null, "", "");
  }),
}));

describe("convertMermaid", () => {
  it("returns PNG buffer from mermaid code", async () => {
    const { convertMermaid } = await import("../../src/converters/mermaid-to-png.js");
    const result = await convertMermaid("graph TD; A-->B;");
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});
