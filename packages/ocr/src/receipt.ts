import Anthropic from "@anthropic-ai/sdk";
import type { ReceiptData } from "./types.js";

export class ParseReceiptError extends Error {
  public readonly rawText?: string;

  constructor(message: string, rawText?: string) {
    super(message);
    this.name = "ParseReceiptError";
    this.rawText = rawText;
  }
}

const SYSTEM_PROMPT = `영수증 이미지를 분석해 다음 JSON 스키마로만 응답하세요. 추측 금지 — 읽을 수 없는 필드는 null.

{
  "vendor": "string",
  "date": "YYYY-MM-DD | null",
  "type": "purchase | sale | unknown",
  "items": [{"name": "string", "qty": number, "unitPrice": number, "unit": "string | null"}],
  "subtotal": "number | null",
  "tax": "number | null",
  "total": "number | null",
  "currency": "KRW",
  "confidence": "0.0~1.0"
}

JSON 외 텍스트 출력 금지.`;

const MAX_ATTEMPTS = 2;
const MAX_TOKENS = 2048;
// AnthropicProvider(packages/ai/src/providers/anthropic.ts)와 동일한 모델 id 사용.
// SDK가 alias를 거부하면 dated id로 교체 (예: claude-sonnet-4-5-20250929).
const MODEL = "claude-sonnet-4-6";

const VALID_TYPES = new Set(["purchase", "sale", "unknown"]);

// Anthropic SDK message content shapes vary by version; keep loose typing for the
// payload we send while still asserting on the parsed JSON we receive back.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChatMessage = { role: "user" | "assistant"; content: any };

export async function parseReceipt(
  buf: Buffer,
  mimeType: string
): Promise<ReceiptData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ParseReceiptError(
      "ANTHROPIC_API_KEY environment variable is not set"
    );
  }

  const client = new Anthropic({ apiKey });
  const base64 = buf.toString("base64");

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType,
            data: base64,
          },
        },
        { type: "text", text: "위 영수증을 JSON으로 변환." },
      ],
    },
  ];

  let lastRawText = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Transport/SDK errors (429, network, etc.) must not enter the retry loop —
    // retries are reserved for JSON parse / schema violations where replaying
    // the assistant turn with feedback can succeed.
    let resp;
    try {
      resp = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ParseReceiptError(`Anthropic SDK error: ${reason}`);
    }

    // Concatenate all text blocks — some Anthropic responses split content
    // across multiple blocks even when output is a single JSON document.
    // Use `unknown` + property check since SDK union (text/thinking/tool_use/…)
    // doesn't all carry `.text`, and we only want text blocks.
    const text = (resp.content ?? [])
      .map((b: unknown): string => {
        if (
          typeof b === "object" &&
          b !== null &&
          (b as { type?: unknown }).type === "text" &&
          typeof (b as { text?: unknown }).text === "string"
        ) {
          return (b as { text: string }).text;
        }
        return "";
      })
      .join("");
    lastRawText = text;

    try {
      const parsed = JSON.parse(text) as unknown;
      validateReceiptData(parsed);
      return parsed;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (attempt >= MAX_ATTEMPTS) {
        throw new ParseReceiptError(
          `JSON parse failed after ${MAX_ATTEMPTS} attempts: ${reason}`,
          text
        );
      }
      console.warn(
        "[parseReceipt] attempt 1 JSON parse failed, retrying with feedback",
        { reason }
      );
      // feedback retry: replay assistant's bad reply + ask for valid JSON.
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `이전 응답이 not valid JSON 입니다: ${reason}. 스키마에 맞춰 JSON만 다시 응답하세요.`,
      });
    }
  }

  // Defensive: loop always returns or throws above.
  throw new ParseReceiptError(
    "parseReceipt exited retry loop without result",
    lastRawText
  );
}

function validateReceiptData(d: unknown): asserts d is ReceiptData {
  if (typeof d !== "object" || d === null) {
    throw new Error("response is not an object");
  }
  const obj = d as Record<string, unknown>;
  if (typeof obj.vendor !== "string") {
    throw new Error("vendor missing or not a string");
  }
  if (typeof obj.type !== "string" || !VALID_TYPES.has(obj.type)) {
    throw new Error(`invalid type: ${String(obj.type)}`);
  }
  if (!Array.isArray(obj.items)) {
    throw new Error("items is not an array");
  }
  for (const item of obj.items) {
    if (typeof item !== "object" || item === null) {
      throw new Error("item is not an object");
    }
    const it = item as Record<string, unknown>;
    if (typeof it.name !== "string") {
      throw new Error("item.name missing or not a string");
    }
    if (typeof it.qty !== "number") {
      throw new Error("item.qty missing or not a number");
    }
    if (typeof it.unitPrice !== "number") {
      throw new Error("item.unitPrice missing or not a number");
    }
  }
  if (obj.currency !== "KRW") {
    throw new Error("currency must be KRW");
  }
  if (typeof obj.confidence !== "number") {
    throw new Error("confidence missing or not a number");
  }
}
