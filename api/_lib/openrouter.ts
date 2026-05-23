type TranslationResult = {
  title: string;
  summary: string;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function translateAndSummarizeWithOpenRouter(input: {
  sourceName: string;
  originalTitle: string;
  articleUrl: string;
  articleText: string;
}): Promise<TranslationResult> {
  const apiKey = env('OPENROUTER_API_KEY');
  const model = process.env.OPENROUTER_MODEL || 'openrouter/owl-alpha';
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-oss-20b:free';
  const maxChars = Number(process.env.OPENROUTER_ARTICLE_MAX_CHARS || 3500);
  const clipped = input.articleText.slice(0, maxChars).trim();

  const prompt = [
    'You prepare concise English Real Madrid news alerts for Telegram.',
    'Return STRICT JSON ONLY with keys: title, summary.',
    'Rules:',
    '- If the source text is Spanish, translate the title and summary into natural English',
    '- If the source text is already English, keep/rewrite the title naturally in English without translating it unnecessarily',
    '- title: <= 110 chars',
    '- summary: 1-2 short English sentences, <= 280 chars total',
    '- keep names, scores, competition names accurate',
    '- no markdown, no extra keys, no commentary',
    '',
    `SOURCE: ${input.sourceName}`,
    `URL: ${input.articleUrl}`,
    `ORIGINAL_TITLE: ${input.originalTitle}`,
    'ARTICLE_TEXT:',
    clipped,
  ].join('\n');

  async function callModel(modelName: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://madridradar.com',
        'X-Title': 'Madrid Radar',
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter error (${modelName}) ${response.status}: ${body}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error(`OpenRouter returned empty content (${modelName})`);
    }

    return raw;
  }

  let raw: string;
  try {
    raw = await callModel(model);
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === model) throw primaryError;
    raw = await callModel(fallbackModel);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OpenRouter returned non-JSON content: ${raw.slice(0, 200)}`);
  }

  const title = typeof (parsed as Record<string, unknown>).title === 'string'
    ? (parsed as Record<string, string>).title.trim()
    : '';
  const summary = typeof (parsed as Record<string, unknown>).summary === 'string'
    ? (parsed as Record<string, string>).summary.trim()
    : '';

  if (!title || !summary) {
    throw new Error(`OpenRouter JSON missing title/summary: ${raw.slice(0, 200)}`);
  }

  return { title, summary };
}
