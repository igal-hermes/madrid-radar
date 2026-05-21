import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { texts, targetLang = 'EN' } = request.body || {};
  if (!Array.isArray(texts) || texts.length === 0 || texts.some((t) => typeof t !== 'string')) {
    return response.status(400).json({ ok: false, error: 'Missing or invalid texts array' });
  }
  if (!DEEPL_API_KEY) {
    return response.status(500).json({ ok: false, error: 'DeepL API key not configured' });
  }

  try {
    const params = new URLSearchParams();
    params.append('target_lang', targetLang);
    for (const text of texts) {
      if (text.trim()) params.append('text', text);
    }

    const deeplResponse = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!deeplResponse.ok) {
      const errorText = await deeplResponse.text();
      return response.status(502).json({ ok: false, error: `DeepL error: ${errorText}` });
    }

    const data = await deeplResponse.json();
    response.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=86400');
    return response.status(200).json({ ok: true, translations: data.translations });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
