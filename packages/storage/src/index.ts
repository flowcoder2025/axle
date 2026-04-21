/**
 * @axle/storage — Supabase Storage client + utilities
 *
 * Export map:
 * - createStorageClient, resetStorageClient, BUCKETS  → Supabase client singleton
 * - uploadFile, uploadFromFormData, StorageValidationError → Upload helpers
 * - getSignedUrl, getPublicUrl, deleteFile, getFileMetadata → Download / URL helpers
 * - generateThumbnail, getImageDimensions → Image utilities
 * - Types: BucketName, UploadResult, SignedUrlResult, StorageConfig, FileMetadata, UploadOptions
 */

export const STORAGE_PACKAGE = "@axle/storage" as const;

// Client
export { createStorageClient, resetStorageClient, BUCKETS } from "./client.js";

// Upload
export {
  uploadFile,
  uploadFromFormData,
  StorageValidationError,
} from "./upload.js";

// Download
export {
  getSignedUrl,
  getPublicUrl,
  downloadFile,
  deleteFile,
  getFileMetadata,
} from "./download.js";

// Image
export {
  generateThumbnail,
  getImageDimensions,
} from "./image.js";

// Types
export type {
  BucketName,
  UploadResult,
  SignedUrlResult,
  StorageConfig,
  FileMetadata,
  UploadOptions,
} from "./types.js";

export type { ThumbnailOptions, ImageDimensions } from "./image.js";
