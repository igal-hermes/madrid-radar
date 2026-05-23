import type { Article } from './news.js';
import { getArticleText } from './article-content.js';
import { translateAndSummarizeWithOpenRouter } from './openrouter.js';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function formatArticleLine(article: Article): Promise<string | null> {
  try {
    const articleText = await getArticleText(article.url);
    const { title, summary } = await translateAndSummarizeWithOpenRouter({
      sourceName: article.sourceName,
      originalTitle: article.title,
      articleUrl: article.url,
      articleText: articleText || article.title,
    });
    return `\n• ${article.sourceName}\n${title}\n${summary}\n${article.url}`;
  } catch {
    return null;
  }
}

export async function sendTelegram(articles: Article[]): Promise<void> {
  if (articles.length === 0) return;
  const token = env('TELEGRAM_BOT_TOKEN');
  const chatId = env('TELEGRAM_CHAT_ID');

  const rows = await Promise.all(articles.slice(0, 6).map((article) => formatArticleLine(article)));
  const successfulRows = rows.filter((row): row is string => Boolean(row));
  if (successfulRows.length === 0) return;

  const text = ['🚨 Real Madrid news update', ...successfulRows].join('\n');

  const payload = { chat_id: chatId, text, disable_web_page_preview: false };
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const migratedChatId = body?.parameters?.migrate_to_chat_id;
    if (migratedChatId) {
      const retry = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, chat_id: migratedChatId }),
      });
      if (retry.ok) return;
      const retryBody = await retry.text();
      throw new Error(`Telegram send failed ${retry.status}: ${retryBody}`);
    }
    throw new Error(`Telegram send failed ${response.status}: ${JSON.stringify(body)}`);
  }
}
