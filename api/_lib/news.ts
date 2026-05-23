import { XMLParser } from 'fast-xml-parser';

export type SourceId = 'marca' | 'as' | 'ser' | 'managing';

export type Article = {
  id: string;
  source: SourceId;
  sourceName: string;
  title: string;
  url: string;
  publishedAt?: string;
};

const parser = new XMLParser({ ignoreAttributes: false });

const SOURCES: Array<{ id: SourceId; name: string; feed?: string; page?: string }> = [
  { id: 'marca', name: 'Marca', feed: 'https://e00-marca.uecdn.es/rss/futbol/real-madrid.xml' },
  { id: 'as', name: 'AS Diario', feed: 'https://feeds.as.com/mrss-s/list/as/site/as.com/tag/real_madrid_a' },
  { id: 'ser', name: 'Cadena SER', page: 'https://cadenaser.com/tag/real_madrid/a/' },
  { id: 'managing', name: 'Managing Madrid', feed: 'https://www.managingmadrid.com/rss/index.xml' },
];

function idFor(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) hash = Math.imul(31, hash) + url.charCodeAt(i) | 0;
  return Math.abs(hash).toString(36);
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': 'MadridRadar/1.0 (+https://vercel.app)' },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function getField(item: unknown, key: string): unknown {
  return typeof item === 'object' && item !== null ? (item as Record<string, unknown>)[key] : undefined;
}

function textField(value: unknown): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['#text'] : value;
}

function normalizeItem(source: SourceId, sourceName: string, item: unknown): Article | null {
  const link = getField(item, 'link');
  const linkText = typeof link === 'object' && link !== null
    ? ((link as Record<string, unknown>)['#text'] ?? (link as Record<string, unknown>)['@_href'])
    : link;
  const title = cleanText(textField(getField(item, 'title')));
  const url = cleanText(linkText);
  if (!title || !url) return null;
  const publishedAt = cleanText(getField(item, 'pubDate') ?? getField(item, 'published') ?? getField(item, 'updated'));
  return { id: idFor(url), source, sourceName, title, url, publishedAt };
}

async function fetchRss(source: SourceId, sourceName: string, url: string): Promise<Article[]> {
  const xml = await fetchText(url);
  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  return items.map((item) => normalizeItem(source, sourceName, item)).filter(Boolean) as Article[];
}

function absoluteUrl(base: string, href: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function isCadenaSerArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'cadenaser.com'
      && /^\/[a-z0-9-]+\/20\d{2}\/\d{2}\/\d{2}\//.test(parsed.pathname);
  } catch {
    return false;
  }
}

async function fetchCadenaSer(): Promise<Article[]> {
  const base = 'https://cadenaser.com/tag/real_madrid/a/';
  const html = await fetchText(base);
  const seen = new Set<string>();
  const articles: Article[] = [];
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const url = absoluteUrl(base, match[1]);
    const title = cleanText(match[2]);
    if (!title || !isCadenaSerArticleUrl(url)) continue;
    if (seen.has(url)) continue;
    const haystack = `${title} ${url}`.toLowerCase();
    if (!/(real madrid|madrid|mbapp|vinicius|bernab|xabi alonso)/.test(haystack)) continue;
    seen.add(url);
    articles.push({ id: idFor(url), source: 'ser', sourceName: 'Cadena SER', title, url });
    if (articles.length >= 20) break;
  }
  return articles;
}

function sortArticlesByDate(articles: Article[]): Article[] {
  return articles.sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

export async function getArticles(): Promise<Article[]> {
  const batches = await Promise.allSettled(
    SOURCES.map(async (source) => {
      if (source.feed) return fetchRss(source.id, source.name, source.feed);
      return fetchCadenaSer();
    }),
  );
  const articles = batches.flatMap((batch) => batch.status === 'fulfilled' ? batch.value : []);
  const unique = new Map<string, Article>();
  for (const article of articles) unique.set(article.url, article);
  return sortArticlesByDate([...unique.values()]).slice(0, 80);
}
