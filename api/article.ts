import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseArticleHtml } from './_lib/article-content.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const url = String(request.query.url || '');
    if (!url || !/^https:\/\/(www\.)?(marca\.com|as\.com|cadenaser\.com|managingmadrid\.com)\//.test(url)) {
      return response.status(400).json({ ok: false, error: 'Unsupported or missing article URL' });
    }

    const articleResponse = await fetch(url, { headers: { 'user-agent': 'MadridRadar/1.0 (+https://vercel.app)' } });
    if (!articleResponse.ok) {
      return response.status(articleResponse.status).json({ ok: false, error: `Article returned ${articleResponse.status}` });
    }
    const html = await articleResponse.text();
    const { title, description, content } = parseArticleHtml(html);

    response.setHeader('cache-control', 's-maxage=600, stale-while-revalidate=3600');
    return response.status(200).json({ ok: true, title, description, content, url });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
