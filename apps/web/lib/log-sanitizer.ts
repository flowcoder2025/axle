/**
 * Log sanitizer — recursively redacts sensitive credential fields before
 * structured data leaves the process (Sentry events, console JSON dumps,
 * AutomationLog.detail, scraper API request/response logs).
 *
 * Used by:
 *  - sentry.server.config.ts beforeSend
 *  - any custom logger that serializes objects (add explicit call)
 *
 * Field name matching is case-insensitive against a denylist. Values are
 * replaced with the literal string "[REDACTED]". For tokenHash specifically,
 * we keep the prefix (first 8 chars) for diagnostics — see ScraperApiKey.prefix.
 */

const REDACTED = "[REDACTED]";

/**
 * Field names whose values must be fully redacted, case-insensitive.
 * Add new entries when introducing new credential fields.
 */
const SENSITIVE_KEYS = new Set<string>([
  // Scraper credentials
  "pfxbase64",
  "pfxciphertext",
  "passwordciphertext",
  "certpassword",
  "userpw",
  // Generic
  "password",
  "passcode",
  "secret",
  // Token-like
  "accesstoken",
  "refreshtoken",
  "scraperkey",
  "x-scraper-key",
  // OAuth & API keys
  "apikey",
  "apisecret",
  "clientsecret",
  // Auth headers (lowercased)
  "authorization",
  "cookie",
  "set-cookie",
]);

/**
 * Field names where the value should be partially redacted (keep first 8 chars).
 * Useful for hashes/prefixes that aid diagnostics without exposing the secret.
 */
const PARTIAL_KEYS = new Set<string>(["tokenhash"]);

const MAX_DEPTH = 8;

function redactValue(_key: string, value: unknown, partial: boolean): unknown {
  if (typeof value !== "string") return REDACTED;
  if (!partial) return REDACTED;
  if (value.length <= 8) return REDACTED;
  return `${value.slice(0, 8)}…[REDACTED]`;
}

function walk(input: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return input;
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;

  // Pass through built-in value types unchanged (Date, RegExp, URL, Error).
  if (input instanceof Date || input instanceof RegExp || input instanceof URL) return input;
  if (input instanceof Error) return input;

  if (Array.isArray(input)) {
    return input.map((item) => walk(item, depth + 1));
  }

  // Buffer/typed-arrays leak credentials when serialized — drop content.
  if (input instanceof Uint8Array) return REDACTED;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower)) {
      out[key] = redactValue(key, value, false);
    } else if (PARTIAL_KEYS.has(lower)) {
      out[key] = redactValue(key, value, true);
    } else {
      out[key] = walk(value, depth + 1);
    }
  }
  return out;
}

/**
 * Returns a sanitized deep copy of the input. Original is not mutated.
 */
export function redactCredentials<T>(input: T): T {
  return walk(input, 0) as T;
}

/**
 * Sentry beforeSend hook. Mutates the event in place is not needed —
 * we return a sanitized copy so the original payload reference isn't leaked
 * via shared references.
 */
export function sentryBeforeSend<E extends object>(event: E): E {
  return redactCredentials(event);
}
