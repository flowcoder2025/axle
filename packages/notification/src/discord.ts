/**
 * Discord Webhook notification channel.
 *
 * Requires env var: DISCORD_WEBHOOK_URL
 */

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
}

export interface DiscordNotificationOptions {
  username?: string;
  avatarUrl?: string;
  embeds?: DiscordEmbed[];
}

function getWebhookUrl(): string {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    throw new Error(
      "Missing DISCORD_WEBHOOK_URL environment variable."
    );
  }
  return url;
}

/**
 * sendDiscordNotification — post a message (and optional embeds) to a Discord webhook.
 *
 * @param message  Plain text content (can be empty string when using embeds only)
 * @param options  Optional username override, avatar URL, and rich embed array
 */
export async function sendDiscordNotification(
  message: string,
  options: DiscordNotificationOptions = {}
): Promise<void> {
  const webhookUrl = getWebhookUrl();

  const body: Record<string, unknown> = {
    content: message,
    ...(options.username !== undefined ? { username: options.username } : {}),
    ...(options.avatarUrl !== undefined ? { avatar_url: options.avatarUrl } : {}),
    ...(options.embeds !== undefined ? { embeds: options.embeds } : {}),
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Discord returns 204 No Content on success
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Discord Webhook error ${response.status}: ${detail}`
    );
  }
}
