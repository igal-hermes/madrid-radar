import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const newsTs = new URL('../api/_lib/news.ts', import.meta.url);

test('combined feed is date-sorted before limiting so later sources are not always dropped', async () => {
  const source = await readFile(newsTs, 'utf8');

  assert.match(source, /sortArticlesByDate/, 'news combiner should sort all sources before applying the global limit');
  assert.match(source, /sortArticlesByDate\(\[\.\.\.unique\.values\(\)\]\)\.slice\(0, 80\)/, 'source limiting should happen after sorting unique articles');
});
