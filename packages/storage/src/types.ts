/**
 * @axle/storage — Shared types
 */

export type BucketName = "documents" | "recordings" | "exports";

export interface UploadResult {
  path: string;
  url: string;
  size: number;
  contentType: string;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

export interface StorageConfig {
  maxSize: number;
  allowedMimeTypes: string[];
}

export interface FileMetadata {
  size: number;
  contentType: string;
  lastModified: Date;
}

export interface UploadOptions {
  /** Override the generated path */
  path?: string;
  /** Organization ID to scope the path (required unless path is provided) */
  orgId?: string;
  /** Override default content type */
  contentType?: string;
  /** Override per-bucket StorageConfig */
  config?: Partial<StorageConfig>;
}
