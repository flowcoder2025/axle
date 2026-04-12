import { execFile } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export interface MermaidOptions {
  width?: number;
  height?: number;
  theme?: "default" | "dark" | "forest";
  backgroundColor?: string;
}

export async function convertMermaid(
  mermaidCode: string,
  options?: MermaidOptions
): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `mermaid-${id}.mmd`);
  const outputPath = join(tmpdir(), `mermaid-${id}.png`);

  try {
    writeFileSync(inputPath, mermaidCode, "utf-8");

    const args = ["-i", inputPath, "-o", outputPath, "-b", options?.backgroundColor ?? "transparent"];
    if (options?.theme) args.push("-t", options.theme);
    if (options?.width) args.push("-w", String(options.width));
    if (options?.height) args.push("-H", String(options.height));

    await new Promise<void>((resolve, reject) => {
      execFile("mmdc", args, { timeout: 30_000 }, (err, _stdout, stderr) => {
        if (err) return reject(new Error(`mmdc error: ${stderr || err.message}`));
        resolve();
      });
    });

    return readFileSync(outputPath);
  } finally {
    try { unlinkSync(inputPath); } catch { /* ignore */ }
    try { unlinkSync(outputPath); } catch { /* ignore */ }
  }
}
