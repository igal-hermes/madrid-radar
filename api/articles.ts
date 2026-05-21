import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getArticles } from './_lib/news.js';

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    const articles = await getArticles();
    response.setHeader('cache-control', 's-maxage=120, stale-while-revalidate=300');
    response.status(200).json({ ok: true, articles, checkedAt: new Date().toISOString() });
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
