/**
 * @axle/storage — Upload utilities
 */

import { randomUUID } from "node:crypto";
import { createStorageClient } from "./client.js";
import type {
  BucketName,
  StorageConfig,
  UploadOptions,
  UploadResult,
} from "./types.js";

/** Default 50 MB limit */
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;

const BUCKET_CONFIGS: Record<BucketName, StorageConfig> = {
  documents: {
    maxSize: DEFAULT_MAX_SIZE,
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },
  recordings: {
    maxSize: 500 * 1024 * 1024, // 500 MB for audio/video
    allowedMimeTypes: [
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "video/mp4",
      "video/webm",
    ],
  },
  exports: {
    maxSize: DEFAULT_MAX_SIZE,
    allowedMimeTypes: [
      "application/pdf",
      "text/csv",
      "application/json",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
};

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

function validateFile(
  bucket: BucketName,
  size: number,
  contentType: string,
  overrideConfig?: Partial<StorageConfig>
): void {
  const base = BUCKET_CONFIGS[bucket];
  const config: StorageConfig = {
    maxSize: overrideConfig?.maxSize ?? base.maxSize,
    allowedMimeTypes: overrideConfig?.allowedMimeTypes ?? base.allowedMimeTypes,
  };

  if (size > config.maxSize) {
    throw new StorageValidationError(
      `File size ${size} bytes exceeds maximum ${config.maxSize} bytes for bucket "${bucket}"`
    );
  }

  // Normalise: strip parameters (e.g. "image/jpeg; charset=utf-8")
  const normalised = contentType.split(";")[0].trim().toLowerCase();
  if (!config.allowedMimeTypes.includes(normalised)) {
    throw new StorageValidationError(
      `MIME type "${normalised}" is not allowed for bucket "${bucket}". Allowed: ${config.allowedMimeTypes.join(", ")}`
    );
  }
}

function buildPath(
  bucket: BucketName,
  filename: string,
  orgId?: string
): string {
  const uuid = randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return orgId
    ? `${orgId}/${bucket}/${uuid}-${safeName}`
    : `${bucket}/${uuid}-${safeName}`;
}

/**
 * Upload a Buffer to Supabase Storage.
 *
 * @param bucket  Target bucket (documents | recordings | exports)
 * @param filename Original filename — used to generate a collision-free storage path
 * @param buffer  File content
 * @param options Optional overrides (orgId, contentType, path, config)
 */
export async function uploadFile(
  bucket: BucketName,
  filename: string,
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const contentType = options.contentType ?? "application/octet-stream";
  validateFile(bucket, buffer.byteLength, contentType, options.config);

  const storagePath =
    options.path ?? buildPath(bucket, filename, options.orgId);

  const supabase = createStorageClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicUrl,
    size: buffer.byteLength,
    contentType,
  };
}

/**
 * Extract a file from a FormData object and upload it.
 *
 * @param bucket    Target bucket
 * @param formData  FormData instance (Web API)
 * @param fieldName The field name of the file input
 * @param options   Optional overrides
 */
export async function uploadFromFormData(
  bucket: BucketName,
  formData: FormData,
  fieldName: string,
  options: Omit<UploadOptions, "contentType"> = {}
): Promise<UploadResult> {
  const entry = formData.get(fieldName);

  if (!(entry instanceof File)) {
    throw new StorageValidationError(
      `FormData field "${fieldName}" is missing or is not a File`
    );
  }

  const arrayBuffer = await entry.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return uploadFile(bucket, entry.name, buffer, {
    ...options,
    contentType: entry.type || "application/octet-stream",
  });
}
