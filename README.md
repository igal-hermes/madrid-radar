# Madrid Radar

A tiny Vercel app that watches Spanish Real Madrid news sources and sends new-item alerts to a dedicated Telegram channel.

## Sources

- Marca Real Madrid RSS
- AS Diario Real Madrid tag RSS
- Cadena SER Real Madrid tag page

## Required environment variables

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
VITE_TELEGRAM_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
CRON_SECRET=optional
```

Use Upstash Redis (or Vercel's Redis integration) for the KV REST variables. The app uses Redis only to remember which article IDs were already seen.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## API routes

- `GET /api/articles` — returns the current feed.
- `GET|POST /api/check` — checks for new articles and sends Telegram alerts. First successful run establishes a baseline and sends nothing.

## Telegram setup

1. Create a bot with `@BotFather`.
2. Add it to the public Telegram channel as an admin.
3. Grant the bot permission to post messages.
4. For the public channel, set `TELEGRAM_CHAT_ID=@madridradar`. For a private channel, use the numeric `-100...` chat id.
5. Put `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `VITE_TELEGRAM_URL=https://t.me/madridradar` into Vercel environment variables.

## Scheduling

Vercel Hobby only supports daily cron jobs, and GitHub scheduled workflows proved unreliable for this project. Use Upstash QStash for the production 5-minute scheduler.

Create the schedule from a trusted machine with:

```bash
export QSTASH_TOKEN=...
export CRON_SECRET=... # same value as the Vercel CRON_SECRET env var
node scripts/create-qstash-schedule.mjs
```

Optional env vars:

```bash
QSTASH_URL=https://qstash.upstash.io
CHECK_URL=https://madrid-radar.vercel.app/api/check
QSTASH_CRON='*/5 * * * *'
```

The GitHub Actions workflow remains as a manual `workflow_dispatch` smoke test only.
