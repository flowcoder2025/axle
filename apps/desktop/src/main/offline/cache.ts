/**
 * Offline SQLite cache using better-sqlite3.
 *
 * Stores client and project data for offline access.
 * Maintains a sync queue to track local mutations and push them
 * to the server when the app is back online.
 */

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType = "client" | "project";
export type SyncStatus = "pending" | "syncing" | "done" | "failed";

export interface CachedClient {
  id: string;
  orgId: string;
  name: string;
  businessNumber?: string;
  status: string;
  cachedAt: string;
  data: Record<string, unknown>;
}

export interface CachedProject {
  id: string;
  clientId: string;
  title: string;
  status: string;
  cachedAt: string;
  data: Record<string, unknown>;
}

export interface SyncQueueEntry {
  id: number;
  entityType: EntityType;
  entityId: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

let db: Database.Database | null = null;

function getDbPath(userDataPath?: string): string {
  const base = userDataPath ?? join(process.env.HOME ?? ".", ".axle");
  mkdirSync(base, { recursive: true });
  return join(base, "offline-cache.db");
}

export function openDatabase(userDataPath?: string): Database.Database {
  if (db) return db;

  db = new Database(getDbPath(userDataPath));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  migrate(db);
  return db;
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}

// For testing — allow injecting a db instance
export function setDatabase(instance: Database.Database): void {
  db = instance;
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS cached_clients (
      id            TEXT PRIMARY KEY,
      org_id        TEXT NOT NULL,
      name          TEXT NOT NULL,
      business_number TEXT,
      status        TEXT NOT NULL DEFAULT 'ACTIVE',
      cached_at     TEXT NOT NULL,
      data          TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cached_clients_org_id
      ON cached_clients(org_id);

    CREATE TABLE IF NOT EXISTS cached_projects (
      id          TEXT PRIMARY KEY,
      client_id   TEXT NOT NULL,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL,
      cached_at   TEXT NOT NULL,
      data        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cached_projects_client_id
      ON cached_projects(client_id);

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

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status
      ON sync_queue(status);
  `);
}

// ---------------------------------------------------------------------------
// Client cache operations
// ---------------------------------------------------------------------------

export function storeClient(client: CachedClient): void {
  const instance = db!;
  instance
    .prepare(
      `INSERT OR REPLACE INTO cached_clients
        (id, org_id, name, business_number, status, cached_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      client.id,
      client.orgId,
      client.name,
      client.businessNumber ?? null,
      client.status,
      client.cachedAt,
      JSON.stringify(client.data)
    );
}

export function getClient(id: string): CachedClient | null {
  const row = db!
    .prepare("SELECT * FROM cached_clients WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  return row ? rowToClient(row) : null;
}

export function listClients(orgId: string): CachedClient[] {
  const rows = db!
    .prepare("SELECT * FROM cached_clients WHERE org_id = ? ORDER BY name")
    .all(orgId) as Record<string, unknown>[];

  return rows.map(rowToClient);
}

export function deleteClient(id: string): void {
  db!.prepare("DELETE FROM cached_clients WHERE id = ?").run(id);
}

function rowToClient(row: Record<string, unknown>): CachedClient {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    businessNumber: (row.business_number as string | null) ?? undefined,
    status: row.status as string,
    cachedAt: row.cached_at as string,
    data: JSON.parse(row.data as string) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Project cache operations
// ---------------------------------------------------------------------------

export function storeProject(project: CachedProject): void {
  db!
    .prepare(
      `INSERT OR REPLACE INTO cached_projects
        (id, client_id, title, status, cached_at, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      project.id,
      project.clientId,
      project.title,
      project.status,
      project.cachedAt,
      JSON.stringify(project.data)
    );
}

export function getProject(id: string): CachedProject | null {
  const row = db!
    .prepare("SELECT * FROM cached_projects WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  return row ? rowToProject(row) : null;
}

export function listProjects(clientId: string): CachedProject[] {
  const rows = db!
    .prepare("SELECT * FROM cached_projects WHERE client_id = ? ORDER BY title")
    .all(clientId) as Record<string, unknown>[];

  return rows.map(rowToProject);
}

export function deleteProject(id: string): void {
  db!.prepare("DELETE FROM cached_projects WHERE id = ?").run(id);
}

function rowToProject(row: Record<string, unknown>): CachedProject {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    title: row.title as string,
    status: row.status as string,
    cachedAt: row.cached_at as string,
    data: JSON.parse(row.data as string) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Sync queue operations
// ---------------------------------------------------------------------------

export function enqueueSyncOperation(
  entityType: EntityType,
  entityId: string,
  operation: SyncQueueEntry["operation"],
  payload: Record<string, unknown>
): number {
  const result = db!
    .prepare(
      `INSERT INTO sync_queue
        (entity_type, entity_id, operation, payload, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`
    )
    .run(entityType, entityId, operation, JSON.stringify(payload), new Date().toISOString());

  return result.lastInsertRowid as number;
}

export function getPendingSyncEntries(limit = 50): SyncQueueEntry[] {
  const rows = db!
    .prepare(
      `SELECT * FROM sync_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map(rowToSyncEntry);
}

export function markSyncAttempt(
  id: number,
  status: SyncStatus,
  error?: string
): void {
  db!
    .prepare(
      `UPDATE sync_queue
       SET status = ?,
           attempts = attempts + 1,
           last_attempt_at = ?,
           error = ?
       WHERE id = ?`
    )
    .run(status, new Date().toISOString(), error ?? null, id);
}

export function clearDoneSyncEntries(): number {
  const result = db!
    .prepare("DELETE FROM sync_queue WHERE status = 'done'")
    .run();

  return result.changes;
}

export function getSyncQueueStats(): {
  pending: number;
  syncing: number;
  done: number;
  failed: number;
} {
  const rows = db!
    .prepare("SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status")
    .all() as Array<{ status: string; count: number }>;

  const stats = { pending: 0, syncing: 0, done: 0, failed: 0 };
  for (const row of rows) {
    stats[row.status as SyncStatus] = row.count;
  }
  return stats;
}

function rowToSyncEntry(row: Record<string, unknown>): SyncQueueEntry {
  return {
    id: row.id as number,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id as string,
    operation: row.operation as SyncQueueEntry["operation"],
    payload: JSON.parse(row.payload as string) as Record<string, unknown>,
    status: row.status as SyncStatus,
    attempts: row.attempts as number,
    createdAt: row.created_at as string,
    lastAttemptAt: (row.last_attempt_at as string | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
  };
}
