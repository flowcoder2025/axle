import { BUCKETS } from "@axle/storage";

/**
 * Extract the storage path after the bucket name from a Supabase storage URL.
 * URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * @param fileUrl  Full Supabase storage public URL
 * @param bucket   Bucket name to locate in the URL (defaults to BUCKETS.DOCUMENTS)
 * @returns        The path segment after the bucket name, or fileUrl as-is if not matched
 */
export function extractStoragePath(
  fileUrl: string,
  bucket: string = BUCKETS.DOCUMENTS
): string {
  const marker = `/object/public/${bucket}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) {
    return fileUrl.slice(idx + marker.length);
  }
  return fileUrl;
}
