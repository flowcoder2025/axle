import { z } from "zod";

const configSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3100),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // MLX LLM server
  MLX_MODEL_PATH: z
    .string()
    .default("/Users/jerome/.cache/huggingface/hub/mlx-community"),
  MLX_PORT: z.coerce.number().int().positive().default(8080),
  MLX_HOST: z.string().default("127.0.0.1"),
  MLX_HEALTH_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  MLX_RESTART_DELAY_MS: z.coerce.number().int().positive().default(5_000),

  // Claude MQ
  CLAUDE_MQ_DIR: z.string().default(".claude-mq"),
  CLAUDE_MQ_INBOX: z.string().default(".claude-mq/inbox"),
  CLAUDE_MQ_OUTBOX: z.string().default(".claude-mq/outbox"),
  CLAUDE_MQ_STATUS_FILE: z.string().default(".claude-mq/status.json"),

  // Whisper
  WHISPER_MODEL: z.string().default("large-v3"),
  WHISPER_LANGUAGE: z.string().default("ko"),
  WHISPER_OUTPUT_DIR: z.string().default("/tmp/axle-whisper"),

  // Upload
  UPLOAD_DIR: z.string().default("/tmp/axle-uploads"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(100),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const config: Config = loadConfig();

export const mlxBaseUrl = (): string =>
  `http://${config.MLX_HOST}:${config.MLX_PORT}`;
