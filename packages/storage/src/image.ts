/**
 * @axle/storage — Image processing utilities (Sharp)
 */

import sharp from "sharp";

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  /** Sharp fit strategy (default: "inside") */
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  /** Output format (default: "webp") */
  format?: "jpeg" | "png" | "webp";
  /** Quality for jpeg/webp (default: 80) */
  quality?: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Generate a thumbnail from an image buffer.
 *
 * @param buffer   Source image buffer (any Sharp-supported format)
 * @param options  Resize / format options
 * @returns        Resized image buffer
 */
export async function generateThumbnail(
  buffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer> {
  const {
    width = 320,
    height = 320,
    fit = "inside",
    format = "webp",
    quality = 80,
  } = options;

  const pipeline = sharp(buffer).resize({ width, height, fit });

  switch (format) {
    case "jpeg":
      pipeline.jpeg({ quality });
      break;
    case "png":
      pipeline.png({ quality });
      break;
    case "webp":
    default:
      pipeline.webp({ quality });
      break;
  }

  const output = await pipeline.toBuffer();
  return output;
}

/**
 * Read the pixel dimensions of an image without decoding the full image.
 *
 * @param buffer Source image buffer
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<ImageDimensions> {
  const metadata = await sharp(buffer).metadata();

  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error("Unable to determine image dimensions");
  }

  return { width: metadata.width, height: metadata.height };
}

