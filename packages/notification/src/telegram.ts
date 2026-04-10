/**
 * Telegram Bot notification channel.
 *
 * Requires env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (for default recipient)
 */

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error(
      "Missing TELEGRAM_BOT_TOKEN environment variable."
    );
  }
  return token;
}

/**
 * sendTelegramNotification — send a text message to a Telegram chat.
 *
 * @param chatId  Telegram chat / user ID (string or numeric string)
 * @param message Plain text or HTML message content
 */
export async function sendTelegramNotification(
  chatId: string,
  message: string
): Promise<void> {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Telegram API error ${response.status}: ${detail}`
    );
  }
}

/**
 * sendTelegramToDefault — convenience wrapper that sends to TELEGRAM_CHAT_ID.
 *
 * Requires env var: TELEGRAM_CHAT_ID
 */
export async function sendTelegramToDefault(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new Error(
      "Missing TELEGRAM_CHAT_ID environment variable."
    );
  }
  return sendTelegramNotification(chatId, message);
}
