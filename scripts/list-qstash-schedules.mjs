#!/usr/bin/env node
import process from 'node:process';

const qstashToken = process.env.QSTASH_TOKEN;
const qstashUrl = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
if (!qstashToken) {
  console.error('Missing QSTASH_TOKEN');
  process.exit(1);
}

const response = await fetch(`${qstashUrl}/v2/schedules`, {
  headers: { Authorization: `Bearer ${qstashToken}` },
});
const text = await response.text();
if (!response.ok) {
  console.error(`QStash list failed: ${response.status}`);
  console.error(text);
  process.exit(1);
}
console.log(text);
