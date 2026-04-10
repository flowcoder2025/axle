/**
 * @axle/storage — Download / URL / metadata utilities
 */

import { createStorageClient } from "./client.js";
import type { BucketName, FileMetadata, SignedUrlResult } from "./types.js";

/** Default signed URL expiry: 1 hour */
const DEFAULT_EXPIRES_IN = 60 * 60;

/**
 * Generate a signed (time-limited) URL for a private file.
 *
 * @param bucket     Source bucket
 * @param path       Storage path of the file
 * @param expiresIn  Expiry in seconds (default: 3600)
 */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<SignedUrlResult> {
  const supabase = createStorageClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown error"}`);
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return { url: data.signedUrl, expiresAt };
}

/**
 * Return the public URL of a file in a public bucket.
 * No expiry — file must be configured as public in Supabase.
 *
 * @param bucket Source bucket
 * @param path   Storage path of the file
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const supabase = createStorageClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 *
 * @param bucket Source bucket
 * @param path   Storage path of the file
 */
export async function deleteFile(
  bucket: BucketName,
  path: string
): Promise<void> {
  const supabase = createStorageClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Retrieve metadata for a stored file.
 *
 * @param bucket Source bucket
 * @param path   Storage path of the file
 */
export async function getFileMetadata(
  bucket: BucketName,
  path: string
): Promise<FileMetadata> {
  const supabase = createStorageClient();

  // list() with a search prefix is the only way to get object metadata via the JS SDK
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const filename = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;

  const { data, error } = await supabase.storage.from(bucket).list(dir, {
    search: filename,
    limit: 1,
  });

  if (error) {
    throw new Error(`Failed to retrieve file metadata: ${error.message}`);
  }

  const file = data?.find((f) => f.name === filename);

  if (!file) {
    throw new Error(`File not found: ${bucket}/${path}`);
  }

  return {
    size: file.metadata?.size ?? 0,
    contentType: file.metadata?.mimetype ?? "application/octet-stream",
    lastModified: file.updated_at ? new Date(file.updated_at) : new Date(0),
  };
}
