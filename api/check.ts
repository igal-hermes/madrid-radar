import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getArticles } from './_lib/news.js';
import { store } from './_lib/store.js';
import { sendTelegram } from './_lib/telegram.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && request.headers.authorization !== `Bearer ${secret}` && request.query.secret !== secret) {
      return response.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (!store.configured()) {
      return response.status(500).json({ ok: false, error: 'Redis/KV env vars are required for deduped alerts' });
    }

    const articles = await getArticles();
    const initialized = await store.initialized();
    const fresh = [];
    for (const article of articles) {
      if (!(await store.seen(article.id))) fresh.push(article);
    }
    await store.markSeen(articles.map((article) => article.id));

    if (!initialized) {
      await store.setInitialized();
      return response.status(200).json({ ok: true, initialized: true, baseline: articles.length, sent: 0 });
    }

    await sendTelegram(fresh);
    return response.status(200).json({ ok: true, checked: articles.length, sent: fresh.length });
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
