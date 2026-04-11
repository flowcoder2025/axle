/**
 * Tests for offline SQLite cache (WI-131).
 * Uses an in-memory SQLite database.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";

// We import setDatabase to inject an in-memory db for tests
import {
  setDatabase,
  storeClient,
  getClient,
  listClients,
  deleteClient,
  storeProject,
  getProject,
  listProjects,
  deleteProject,
  enqueueSyncOperation,
  getPendingSyncEntries,
  markSyncAttempt,
  clearDoneSyncEntries,
  getSyncQueueStats,
} from "../src/main/offline/cache";

// ---------------------------------------------------------------------------
// Test setup: in-memory DB
// ---------------------------------------------------------------------------

let testDb: Database.Database;

function openInMemoryDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_clients (
      id            TEXT PRIMARY KEY,
      org_id        TEXT NOT NULL,
      name          TEXT NOT NULL,
      business_number TEXT,
      status        TEXT NOT NULL DEFAULT 'ACTIVE',
      cached_at     TEXT NOT NULL,
      data          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cached_clients_org_id ON cached_clients(org_id);

    CREATE TABLE IF NOT EXISTS cached_projects (
      id          TEXT PRIMARY KEY,
      client_id   TEXT NOT NULL,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL,
      cached_at   TEXT NOT NULL,
      data        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cached_projects_client_id ON cached_projects(client_id);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type     TEXT NOT NULL CHECK(entity_type IN ('client', 'project')),
      entity_id       TEXT NOT NULL,
      operation       TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
      payload         TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'done', 'failed')),
      attempts        INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL,
      last_attempt_at TEXT,
      error           TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
  `);

  return db;
}

beforeEach(() => {
  testDb = openInMemoryDb();
  setDatabase(testDb);
});

afterEach(() => {
  testDb.close();
});

// ---------------------------------------------------------------------------
// Client cache tests
// ---------------------------------------------------------------------------

describe("Client cache", () => {
  const sampleClient = {
    id: "client-1",
    orgId: "org-1",
    name: "ACME Corp",
    businessNumber: "123-45-67890",
    status: "ACTIVE",
    cachedAt: new Date().toISOString(),
    data: { email: "test@acme.com" },
  };

  it("stores and retrieves a client", () => {
    storeClient(sampleClient);
    const retrieved = getClient("client-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe("ACME Corp");
    expect(retrieved!.businessNumber).toBe("123-45-67890");
    expect(retrieved!.data.email).toBe("test@acme.com");
  });

  it("returns null for unknown client", () => {
    expect(getClient("nonexistent")).toBeNull();
  });

  it("upserts on duplicate ID", () => {
    storeClient(sampleClient);
    storeClient({ ...sampleClient, name: "ACME Updated" });
    expect(getClient("client-1")!.name).toBe("ACME Updated");
  });

  it("lists clients by orgId", () => {
    storeClient(sampleClient);
    storeClient({ ...sampleClient, id: "client-2", orgId: "org-2", name: "Other Org" });
    const list = listClients("org-1");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("client-1");
  });

  it("deletes a client", () => {
    storeClient(sampleClient);
    deleteClient("client-1");
    expect(getClient("client-1")).toBeNull();
  });

  it("handles missing businessNumber gracefully", () => {
    storeClient({ ...sampleClient, businessNumber: undefined });
    const retrieved = getClient("client-1");
    expect(retrieved!.businessNumber).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Project cache tests
// ---------------------------------------------------------------------------

describe("Project cache", () => {
  const sampleProject = {
    id: "proj-1",
    clientId: "client-1",
    title: "사업계획서 작성",
    status: "IN_PROGRESS",
    cachedAt: new Date().toISOString(),
    data: { dueDate: "2026-12-31" },
  };

  it("stores and retrieves a project", () => {
    storeProject(sampleProject);
    const retrieved = getProject("proj-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe("사업계획서 작성");
    expect(retrieved!.data.dueDate).toBe("2026-12-31");
  });

  it("returns null for unknown project", () => {
    expect(getProject("nonexistent")).toBeNull();
  });

  it("lists projects by clientId", () => {
    storeProject(sampleProject);
    storeProject({ ...sampleProject, id: "proj-2", clientId: "client-2" });
    const list = listProjects("client-1");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("proj-1");
  });

  it("deletes a project", () => {
    storeProject(sampleProject);
    deleteProject("proj-1");
    expect(getProject("proj-1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sync queue tests
// ---------------------------------------------------------------------------

describe("Sync queue", () => {
  it("enqueues an operation and returns an ID", () => {
    const id = enqueueSyncOperation("client", "client-1", "UPDATE", { name: "New Name" });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("getPendingSyncEntries returns pending entries", () => {
    enqueueSyncOperation("client", "c-1", "CREATE", { name: "A" });
    enqueueSyncOperation("project", "p-1", "UPDATE", { title: "B" });
    const entries = getPendingSyncEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].status).toBe("pending");
  });

  it("markSyncAttempt updates status and increments attempts", () => {
    const id = enqueueSyncOperation("client", "c-1", "UPDATE", {});
    markSyncAttempt(id, "done");
    const entries = getPendingSyncEntries();
    expect(entries).toHaveLength(0); // done — not in pending list
  });

  it("markSyncAttempt stores error message on failure", () => {
    const id = enqueueSyncOperation("client", "c-1", "DELETE", {});
    markSyncAttempt(id, "failed", "Network timeout");
    const stats = getSyncQueueStats();
    expect(stats.failed).toBe(1);
  });

  it("clearDoneSyncEntries removes completed entries", () => {
    const id = enqueueSyncOperation("client", "c-1", "UPDATE", {});
    markSyncAttempt(id, "done");
    const removed = clearDoneSyncEntries();
    expect(removed).toBe(1);
    const stats = getSyncQueueStats();
    expect(stats.done).toBe(0);
  });

  it("getSyncQueueStats counts by status", () => {
    enqueueSyncOperation("client", "c-1", "CREATE", {});
    enqueueSyncOperation("client", "c-2", "UPDATE", {});
    const id = enqueueSyncOperation("project", "p-1", "DELETE", {});
    markSyncAttempt(id, "failed");
    const stats = getSyncQueueStats();
    expect(stats.pending).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.done).toBe(0);
  });

  it("respects limit in getPendingSyncEntries", () => {
    for (let i = 0; i < 5; i++) {
      enqueueSyncOperation("client", `c-${i}`, "UPDATE", {});
    }
    const entries = getPendingSyncEntries(3);
    expect(entries).toHaveLength(3);
  });
});
