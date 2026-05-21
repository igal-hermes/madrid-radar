# Madrid Radar

A tiny Vercel app that watches Spanish Real Madrid news sources and sends new-item alerts to a dedicated Telegram bot chat.

## Sources

- Marca Real Madrid RSS
- AS Diario Real Madrid tag RSS
- Cadena SER Real Madrid tag page

## Required environment variables

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
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
2. Add it to the friend's Telegram group.
3. Send one message in the group.
4. Get the chat id from `https://api.telegram.org/bot<token>/getUpdates` or a helper bot.
5. Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` into Vercel environment variables.

## Scheduling

Vercel Hobby only supports daily cron jobs, so this repo uses GitHub Actions for the 10-minute MVP scheduler.

Set these GitHub repo secrets after the Vercel preview/project URL exists:

```bash
MADRID_RADAR_CHECK_URL=https://your-vercel-url.vercel.app/api/check
CRON_SECRET=optional-same-value-as-vercel
```

The workflow `.github/workflows/check-news.yml` calls `/api/check` every 10 minutes. The endpoint itself lives on Vercel and sends Telegram messages.
