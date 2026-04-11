/**
 * Tests for certificate IPC handlers (WI-127).
 * Mocks Electron's ipcMain and fs module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers = new Map<string, IpcHandler>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: IpcHandler) => {
      handlers.set(channel, fn);
    },
  },
}));

// Create a minimal DER-encoded buffer that starts with SEQUENCE tag (0x30)
const MOCK_P12_BUFFER = Buffer.from([
  0x30, 0x82, 0x01, 0x00, // SEQUENCE
  // Pad with zeros to simulate a real file
  ...Array(252).fill(0),
]);

vi.mock("fs", () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.endsWith(".p12") || path.endsWith(".pfx")) {
      return MOCK_P12_BUFFER;
    }
    throw new Error("ENOENT: no such file");
  }),
  statSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { registerCertHandlers, certStore, validateExtension, parsePkcs12 } from "../src/main/ipc/cert";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const invoke = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for channel: ${channel}`);
  return handler(null, ...args);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Certificate IPC handlers", () => {
  beforeEach(() => {
    handlers.clear();
    certStore.clear();
    registerCertHandlers();
  });

  it("load returns a CertInfo for a valid .p12 file", async () => {
    const info = await invoke("cert:load", "/certs/test.p12", "password123") as {
      id: string; filePath: string; fingerprint: string; validFrom: string; validTo: string;
    };
    expect(info.id).toBeTruthy();
    expect(info.filePath).toBe("/certs/test.p12");
    expect(info.fingerprint).toMatch(/^[A-F0-9:]+$/);
    expect(info.validFrom).toBeTruthy();
    expect(info.validTo).toBeTruthy();
  });

  it("load adds cert to store", async () => {
    await invoke("cert:load", "/certs/test.p12", "pass");
    expect(certStore.size).toBe(1);
  });

  it("list returns all loaded certs", async () => {
    await invoke("cert:load", "/certs/a.p12", "p1");
    await invoke("cert:load", "/certs/b.pfx", "p2");
    const list = await invoke("cert:list") as unknown[];
    expect(list).toHaveLength(2);
  });

  it("verify returns true for a non-expired cert", async () => {
    const info = await invoke("cert:load", "/certs/test.p12", "pass") as { id: string };
    const valid = await invoke("cert:verify", info.id);
    expect(valid).toBe(true);
  });

  it("verify returns false for unknown cert ID", async () => {
    const valid = await invoke("cert:verify", "non-existent-id");
    expect(valid).toBe(false);
  });

  it("remove deletes cert from store", async () => {
    const info = await invoke("cert:load", "/certs/test.p12", "pass") as { id: string };
    await invoke("cert:remove", info.id);
    expect(certStore.size).toBe(0);
  });

  it("remove throws for unknown ID", async () => {
    await expect(invoke("cert:remove", "unknown-id")).rejects.toThrow("not found");
  });

  it("load rejects unsupported extension", async () => {
    await expect(invoke("cert:load", "/certs/test.pem", "pass")).rejects.toThrow("Unsupported");
  });
});

describe("validateExtension", () => {
  it("allows .p12", () => {
    expect(() => validateExtension("/a/b.p12")).not.toThrow();
  });

  it("allows .pfx", () => {
    expect(() => validateExtension("/a/b.pfx")).not.toThrow();
  });

  it("rejects .pem", () => {
    expect(() => validateExtension("/a/b.pem")).toThrow("Unsupported");
  });
});

describe("parsePkcs12", () => {
  it("returns fingerprint and synthetic subject for valid buffer", () => {
    const result = parsePkcs12(MOCK_P12_BUFFER, "pass");
    expect(result.fingerprint).toMatch(/^[A-F0-9:]+$/);
    expect(result.subject).toBeDefined();
    expect(result.validFrom).toBeInstanceOf(Date);
    expect(result.validTo).toBeInstanceOf(Date);
    expect(result.validTo > result.validFrom).toBe(true);
  });

  it("throws for buffer not starting with SEQUENCE tag", () => {
    // 4+ bytes so it passes the length check, but tag is not 0x30
    const bad = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    expect(() => parsePkcs12(bad, "pass")).toThrow("expected ASN.1 SEQUENCE");
  });

  it("throws for empty buffer", () => {
    expect(() => parsePkcs12(Buffer.alloc(0), "pass")).toThrow("too short");
  });
});
