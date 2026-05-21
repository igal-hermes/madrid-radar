#!/usr/bin/env node
import process from 'node:process';

const qstashToken = process.env.QSTASH_TOKEN;
const qstashUrl = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
const destination = process.env.CHECK_URL || 'https://madrid-radar.vercel.app/api/check';
const cronSecret = process.env.CRON_SECRET;
const cron = process.env.QSTASH_CRON || '*/5 * * * *';

if (!qstashToken) {
  console.error('Missing QSTASH_TOKEN');
  process.exit(1);
}
if (!cronSecret) {
  console.error('Missing CRON_SECRET');
  process.exit(1);
}

const response = await fetch(`${qstashUrl}/v2/schedules/${destination}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${qstashToken}`,
    'Content-Type': 'text/plain',
    'Upstash-Cron': cron,
    'Upstash-Method': 'POST',
    'Upstash-Forward-Authorization': `Bearer ${cronSecret}`,
  },
  body: '',
});

const text = await response.text();
if (!response.ok) {
  console.error(`QStash schedule creation failed: ${response.status}`);
  console.error(text);
  process.exit(1);
}

try {
  const data = JSON.parse(text);
  console.log(JSON.stringify({ ok: true, scheduleId: data.scheduleId || data.id, destination, cron }, null, 2));
} catch {
  console.log(text);
}
