/**
 * WI-122: Transcription Route
 *
 * POST /api/transcribe — accepts multipart audio upload → returns whisper transcription
 */

import express, { Router } from "express";
import multer from "multer";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { transcribeAudio } from "../mlx/whisper.js";
import { config } from "../config.js";

export const transcribeRouter = Router();

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "video/mp4",
  "video/webm",
]);

const upload = multer({
  dest: config.UPLOAD_DIR,
  limits: {
    fileSize: config.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported audio format: ${file.mimetype}. ` +
            `Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`
        )
      );
    }
  },
});

// Ensure upload dir exists at module load
mkdir(config.UPLOAD_DIR, { recursive: true }).catch(() => undefined);

/**
 * POST /api/transcribe
 *
 * Multipart body:
 *   audio   — audio file (required)
 *   model   — whisper model override (optional)
 *   language — language code override (optional, default: ko)
 */
transcribeRouter.post(
  "/api/transcribe",
  upload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided. Use field name 'audio'." });
      return;
    }

    const audioPath = join(config.UPLOAD_DIR, req.file.filename);
    const model = (req.body as Record<string, string>).model ?? config.WHISPER_MODEL;
    const language = (req.body as Record<string, string>).language ?? config.WHISPER_LANGUAGE;

    try {
      const result = await transcribeAudio({ audioPath, model, language });

      res.json({
        text: result.text,
        language: result.language,
        model,
        originalName: req.file.originalname,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "Transcription failed", details: message });
    } finally {
      // Always remove the temporary upload file
      await unlink(audioPath).catch(() => undefined);
    }
  }
);

// Multer error handler
transcribeRouter.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err instanceof multer.MulterError || err.message.startsWith("Unsupported")) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
);
