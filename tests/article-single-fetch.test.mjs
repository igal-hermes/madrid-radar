import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const articleTs = new URL('../api/article.ts', import.meta.url);

test('/api/article parses content from the first article fetch instead of fetching the URL twice', async () => {
  const source = await readFile(articleTs, 'utf8');

  assert.doesNotMatch(
    source,
    /getArticleText\(url\)/,
    'api/article.ts should not call getArticleText(url), because that performs a second network fetch for the same article URL',
  );

  assert.match(
    source,
    /parseArticleHtml\(html\)/,
    'api/article.ts should parse title/description/content from the already-fetched HTML payload',
  );
});
