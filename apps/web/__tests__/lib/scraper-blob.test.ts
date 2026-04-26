import { describe, it, expect, vi, beforeEach } from "vitest";

const putMock = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => putMock(...args),
}));

const { uploadScraperResult } = await import("../../lib/scraper-blob");

describe("uploadScraperResult", () => {
  beforeEach(() => {
    putMock.mockReset();
    putMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/scraper/o_1/2026-04/j_1/abc.pdf",
      pathname: "scraper/o_1/2026-04/j_1/abc.pdf",
    });
  });

  it("uploads with the expected path convention", async () => {
    const body = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    await uploadScraperResult({
      orgId: "o_1",
      jobId: "j_1",
      target: "납세증명서",
      body,
      now: new Date("2026-04-26T00:00:00Z"),
    });

    expect(putMock).toHaveBeenCalledOnce();
    const [pathname, calledBody, opts] = putMock.mock.calls[0] as [
      string,
      Buffer,
      { access: string; contentType: string; addRandomSuffix: boolean },
    ];
    expect(pathname).toBe("scraper/o_1/2026-04/j_1/납세증명서.pdf");
    expect(calledBody).toBe(body);
    expect(opts.access).toBe("public");
    expect(opts.contentType).toBe("application/pdf");
    expect(opts.addRandomSuffix).toBe(true);
  });

  it("returns url + pathname + size + content type", async () => {
    const body = Buffer.alloc(1024);
    const res = await uploadScraperResult({
      orgId: "o_1",
      jobId: "j_1",
      target: "result",
      body,
    });
    expect(res.url).toContain("blob.vercel-storage.com");
    expect(res.contentType).toBe("application/pdf");
    expect(res.size).toBe(1024);
  });

  it("sanitizes path segments containing slashes / spaces", async () => {
    await uploadScraperResult({
      orgId: "org/with/slash",
      jobId: " job 1 ",
      target: "weird/name with space",
      body: Buffer.from([1]),
      now: new Date("2026-04-26T00:00:00Z"),
    });
    const [pathname] = putMock.mock.calls[0] as [string];
    expect(pathname).not.toContain("org/with/slash");
    expect(pathname).toMatch(/^scraper\/org_with_slash\/2026-04\/job_1\/weird_name_with_space\.pdf$/);
  });

  it("formats year-month with UTC zero-padding", async () => {
    await uploadScraperResult({
      orgId: "o",
      jobId: "j",
      target: "x",
      body: Buffer.from([1]),
      now: new Date("2026-01-05T23:30:00Z"),
    });
    const [pathname] = putMock.mock.calls[0] as [string];
    expect(pathname).toContain("/2026-01/");
  });

  it("accepts override contentType", async () => {
    await uploadScraperResult({
      orgId: "o",
      jobId: "j",
      target: "x",
      body: Buffer.from([1]),
      contentType: "image/png",
    });
    const [, , opts] = putMock.mock.calls[0] as [string, Buffer, { contentType: string }];
    expect(opts.contentType).toBe("image/png");
  });

  it("computes size for ArrayBuffer body", async () => {
    const body = new ArrayBuffer(2048);
    const res = await uploadScraperResult({
      orgId: "o",
      jobId: "j",
      target: "x",
      body,
    });
    expect(res.size).toBe(2048);
  });
});
