import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const newsTs = new URL('../api/_lib/news.ts', import.meta.url);

test('Cadena SER parser accepts current article URLs that no longer end in .html', async () => {
  const source = await readFile(newsTs, 'utf8');

  assert.doesNotMatch(
    source,
    /url\.endsWith\(['"]\.html['"]\)/,
    'Cadena SER current article URLs are extensionless; requiring .html drops every SER article',
  );

  assert.match(
    source,
    /isCadenaSerArticleUrl/,
    'Cadena SER URL filtering should use an explicit article URL predicate instead of the old .html suffix check',
  );
});
