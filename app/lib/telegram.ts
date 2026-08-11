import { env } from "cloudflare:workers";

type TelegramEnvironment = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};

type DonationNotification = {
  blockNo: string;
  flatNo: string;
  amount: number;
  referenceNo: string;
  source: "resident" | "committee";
};

export async function notifyPortalAdminOfDonation(notification: DonationNotification) {
  const telegram = env as unknown as TelegramEnvironment;
  const token = telegram.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = telegram.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const message = [
    "🪔 New donation recorded",
    `Block: ${notification.blockNo}`,
    `Flat: ${notification.flatNo}`,
    `Amount: ₹${notification.amount.toLocaleString("en-IN")}`,
    `Reference: ${notification.referenceNo}`,
    `Source: ${notification.source === "resident" ? "Resident form" : "Committee entry"}`,
    "Review: https://ganeshfestival2026.hallmarkskyrena.workers.dev/admin",
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Telegram returned HTTP ${response.status}.`);
}
