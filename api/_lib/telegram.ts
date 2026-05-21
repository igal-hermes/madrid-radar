import type { Article } from './news';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function sendTelegram(articles: Article[]): Promise<void> {
  if (articles.length === 0) return;
  const token = env('TELEGRAM_BOT_TOKEN');
  const chatId = env('TELEGRAM_CHAT_ID');
  const text = [
    '🚨 Real Madrid news update',
    ...articles.slice(0, 6).map((article) => `\n• ${article.sourceName}\n${article.title}\n${article.url}`),
  ].join('\n');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram send failed ${response.status}: ${body}`);
  }
}
