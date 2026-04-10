/**
 * WI-120: mlx-whisper Local Transcription
 *
 * Subprocess wrapper for mlx-whisper CLI.
 * Input:  audio file path
 * Output: transcription text
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { config } from "../config.js";

export interface TranscribeOptions {
  /** Path to the input audio file */
  audioPath: string;
  /** Override default model (large-v3) */
  model?: string;
  /** Override default language (ko) */
  language?: string;
  /** Output directory for intermediate files */
  outputDir?: string;
}

export interface TranscribeResult {
  text: string;
  /** Language detected / used */
  language: string;
  /** Duration in seconds if reported by whisper */
  durationSec?: number;
}

/**
 * Run mlx-whisper on an audio file and return the transcription text.
 *
 * mlx-whisper writes a .txt alongside the audio file by default.
 * We redirect output to a temp directory to avoid polluting the input location.
 */
export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscribeResult> {
  const {
    audioPath,
    model = config.WHISPER_MODEL,
    language = config.WHISPER_LANGUAGE,
    outputDir = config.WHISPER_OUTPUT_DIR,
  } = options;

  await mkdir(outputDir, { recursive: true });

  const outputTxtPath = join(
    outputDir,
    basename(audioPath).replace(/\.[^.]+$/, ".txt")
  );

  const args = [
    audioPath,
    "--model",
    model,
    "--language",
    language,
    "--output-dir",
    outputDir,
    "--output-format",
    "txt",
  ];

  const text = await runWhisperProcess(args, outputTxtPath);

  return { text, language };
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function runWhisperProcess(
  args: string[],
  outputTxtPath: string
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn("mlx_whisper", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stderr: string[] = [];

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr.push(chunk.toString());
    });

    proc.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn mlx_whisper: ${err.message}. Ensure mlx-whisper is installed (pip install mlx-whisper).`
        )
      );
    });

    proc.on("exit", async (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `mlx_whisper exited with code ${code}:\n${stderr.join("")}`
          )
        );
        return;
      }

      try {
        const raw = await readFile(outputTxtPath, "utf8");
        const text = raw.trim();
        // Clean up temp output file
        await unlink(outputTxtPath).catch(() => undefined);
        resolve(text);
      } catch (err) {
        reject(
          new Error(
            `mlx_whisper succeeded but output file not found at ${outputTxtPath}: ${String(err)}`
          )
        );
      }
    });
  });
}
