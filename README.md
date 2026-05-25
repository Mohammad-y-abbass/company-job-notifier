# Company Job Notifier

Daily monitor for company careers pages and LinkedIn company feeds. It checks for changes, stores page hashes in `data.json`, and sends Telegram alerts when something new appears.

## Features

- Monitors company careers pages from each main website URL.
- Monitors LinkedIn company posts feeds.
- Monitors LinkedIn company jobs feeds.
- Sends Telegram notifications on first baseline capture and later changes.
- Runs careers checks in parallel while LinkedIn checks continue sequentially.
- Runs locally or daily with GitHub Actions.

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
LINKEDIN_LI_AT=your_linkedin_li_at_cookie
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

## Telegram Setup

1. Create a bot with `@BotFather`.
2. Copy the bot token into `TELEGRAM_BOT_TOKEN`.
3. Send a message to your bot.
4. Open `https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates`.
5. Copy the `chat.id` value into `TELEGRAM_CHAT_ID`.

## Run Locally

```bash
npm run start
```

To show the browser while debugging:

```env
HEADLESS_BROWSER=false
```

## Runtime Behavior

Careers checks run with a small parallel worker pool because each company website is usually a different domain. LinkedIn checks stay sequential with pacing because every request hits `linkedin.com`.

The default careers concurrency is configured in `src/config.ts`:

```ts
CAREERS_CONCURRENCY: 5
```

## GitHub Actions

The repo includes a daily workflow:

```text
.github/workflows/daily-monitor.yml
```

Add these GitHub repository secrets:

```text
LINKEDIN_LI_AT
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

The workflow runs once per day and can also be triggered manually from the GitHub Actions tab. After each run, it commits updated `data.json` hashes back to the repository.

## Data Format

Each company in `data.json` should use the main website and main LinkedIn company URL:

```json
{
  "id": "109730305",
  "website": "https://example.com",
  "linkedinUrl": "https://www.linkedin.com/company/example",
  "name": "Example Company",
  "lastCareersHash": "...",
  "lastLinkedInHash": "...",
  "lastChecked": "2026-05-25T15:21:41.083Z"
}
```

The scraper derives routes like `/careers`, `/posts/`, and `/jobs/` during runtime.
