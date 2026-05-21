import type { VercelRequest, VercelResponse } from '@vercel/node';

function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return '';
}

function extractParagraphs(html: string): string {
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  const scope = articleMatch?.[0] || html;
  const paragraphs = [...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((text) => text.length > 80)
    .filter((text) => !/cookies|suscríbete|newsletter|publicidad/i.test(text));
  return paragraphs.slice(0, 5).join('\n\n');
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const url = String(request.query.url || '');
    if (!url || !/^https:\/\/(www\.)?(marca\.com|as\.com|cadenaser\.com)\//.test(url)) {
      return response.status(400).json({ ok: false, error: 'Unsupported or missing article URL' });
    }

    const articleResponse = await fetch(url, {
      headers: { 'user-agent': 'MadridRadar/1.0 (+https://vercel.app)' },
    });
    if (!articleResponse.ok) {
      return response.status(articleResponse.status).json({ ok: false, error: `Article returned ${articleResponse.status}` });
    }

    const html = await articleResponse.text();
    const title = extractMeta(html, 'og:title') || cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description');
    const body = extractParagraphs(html);
    const content = body || description;

    response.setHeader('cache-control', 's-maxage=600, stale-while-revalidate=3600');
    return response.status(200).json({ ok: true, title, description, content, url });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
