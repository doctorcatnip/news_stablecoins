# StableCoin News

A real-time news aggregator and community platform focused on **stablecoins**, **x402**, **crypto payment gateways**, and **digital payments**.

## Features

- **News Aggregation** — Pulls from 19+ top crypto media outlets via RSS feeds
- **Auto-updates** — Scheduled twice daily at **08:00 JST** and **20:00 JST**
- **Category Filtering** — Filter by Stablecoins, Payments, Payment Gateways, X402
- **Community Chat** — Real-time chat (polling-based) for discussing topics
- **Manual Refresh** — Trigger an instant news fetch from the UI

## News Sources

CoinDesk · CoinTelegraph · Decrypt · The Block · CryptoSlate · Bitcoinist · NewsBTC · BeInCrypto · Blockworks · U.Today · Crypto Briefing · CryptoNews · CoinGape · AMBCrypto · Daily Hodl · and more

## Tech Stack

- **Framework**: Next.js 14 (App Router + custom server)
- **Database**: SQLite via `better-sqlite3`
- **Scheduler**: `node-cron` with Asia/Tokyo timezone
- **Styling**: Tailwind CSS (dark theme)
- **RSS**: `rss-parser`

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install & Run

```bash
npm install
npm run dev        # dev mode (also runs cron + initial fetch)
```

### Production

```bash
npm run build
npm start
```

The server starts on `http://localhost:3000` (or set `PORT` env var).

### Manual News Fetch

```bash
npm run fetch-news   # fetch once from CLI
```

Or click **Refresh Now** on the website UI.

## Configuration

Copy `.env.example` to `.env` and adjust:

```
PORT=3000
NODE_ENV=development
```

## Deployment Notes

- The `data/` directory is created automatically to store `news.db`
- SQLite file lives at `./data/news.db` — do not commit this file
- For production, ensure the process has write access to `./data/`
- The custom server (`server.ts`) must be kept running for cron jobs to fire
- For serverless deployment (Vercel etc.), use an external cron service to `POST /api/news/fetch`

## Schedule

| Time (JST) | Time (UTC) | Action |
|-----------|-----------|--------|
| 08:00 JST | 23:00 UTC | Fetch latest news |
| 20:00 JST | 11:00 UTC | Fetch latest news |
