import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const newsTs = new URL('../api/_lib/news.ts', import.meta.url);
const appTsx = new URL('../src/App.tsx', import.meta.url);
const articleTs = new URL('../api/article.ts', import.meta.url);
const openrouterTs = new URL('../api/_lib/openrouter.ts', import.meta.url);

test('Managing Madrid RSS is configured and Atom entry links are read from href attributes', async () => {
  const source = await readFile(newsTs, 'utf8');

  assert.match(source, /'managing'/, 'news SourceId should include Managing Madrid');
  assert.match(source, /Managing Madrid/, 'source list should include Managing Madrid');
  assert.match(source, /www\.managingmadrid\.com\/rss\/index\.xml/, 'source list should use Managing Madrid RSS feed');
  assert.match(source, /@_href/, 'RSS normalizer should read Atom link href attributes, not just RSS link text');
  assert.match(source, /textField\(getField\(item, 'title'\)\)/, 'RSS normalizer should read Atom title text instead of rendering title objects as [object Object]');
});

test('Managing Madrid appears in UI filters and article content whitelist', async () => {
  const app = await readFile(appTsx, 'utf8');
  const article = await readFile(articleTs, 'utf8');

  assert.match(app, /managing/, 'UI Article source union/filter should include Managing Madrid');
  assert.match(article, /managingmadrid/, '/api/article should allow Managing Madrid article URLs');
});

test('OpenRouter prompt summarizes English sources without unnecessary translation', async () => {
  const source = await readFile(openrouterTs, 'utf8');

  assert.match(source, /If the source text is already English/i, 'Telegram summary prompt should handle English sources without translation');
});
