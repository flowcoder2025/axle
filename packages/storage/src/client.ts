/**
 * @axle/storage — Supabase Storage singleton client
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BucketName } from "./types.js";

export const BUCKETS = {
  DOCUMENTS: "documents",
  RECORDINGS: "recordings",
  EXPORTS: "exports",
} as const satisfies Record<string, BucketName>;

let _client: SupabaseClient | null = null;

/**
 * Returns the singleton Supabase client.
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
 */
export function createStorageClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  _client = createClient(url, key, {
    auth: {
      // Service-role client — no automatic session management
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _client;
}

/**
 * Reset the singleton (primarily for testing).
 */
export function resetStorageClient(): void {
  _client = null;
}
