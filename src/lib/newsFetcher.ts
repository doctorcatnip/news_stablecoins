import Parser from 'rss-parser';
import { getDB } from './db';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; StablecoinNewsAggregator/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  timeout: 15000,
});

// Keywords to identify relevant articles
const KEYWORDS = [
  'stablecoin', 'stablecoins', 'stable coin', 'stable coins',
  'x402',
  'payment gateway', 'payment gateways', 'crypto gateway',
  'crypto payment', 'crypto payments', 'cryptocurrency payment',
  'usdc', 'usdt', 'dai', 'pyusd', 'tusd', 'usdd', 'frax',
  'payment rail', 'payment rails',
  'on-chain payment', 'onchain payment',
  'cbdc', 'digital dollar', 'digital currency payment',
  'stablecoin payment', 'fiat-backed',
  'circle', 'tether', 'paxos',
  'crypto remittance', 'crypto transfer',
  'web3 payment', 'defi payment',
  'lightning network payment', 'cross-border payment crypto',
  // Agentic payment keywords
  'agentic payment', 'agentic payments', 'ai agent payment',
  'autonomous payment', 'agent payment', 'ai payment',
];

// Weighted keyword groups for relevance scoring
const WEIGHTED_KEYWORDS: Array<{ keywords: string[]; weight: number }> = [
  // Highest priority — niche/specific topics
  { keywords: ['x402'], weight: 10 },
  { keywords: ['agentic payment', 'agentic payments', 'ai agent payment', 'autonomous payment', 'agent payment'], weight: 10 },
  // High priority — specific stablecoin payment use cases
  { keywords: ['stablecoin payment', 'stablecoin use case', 'stablecoin adoption', 'stablecoin-based'], weight: 8 },
  { keywords: ['payment gateway', 'payment gateways', 'crypto gateway'], weight: 6 },
  { keywords: ['web3 payment', 'defi payment', 'on-chain payment', 'onchain payment'], weight: 6 },
  // Medium priority — core stablecoin terms
  { keywords: ['stablecoin', 'stablecoins', 'stable coin', 'stable coins'], weight: 4 },
  { keywords: ['usdc', 'usdt', 'dai', 'pyusd', 'tusd', 'usdd', 'frax'], weight: 4 },
  { keywords: ['crypto payment', 'crypto payments', 'cryptocurrency payment'], weight: 4 },
  { keywords: ['cbdc', 'digital dollar'], weight: 3 },
  { keywords: ['payment rail', 'payment rails', 'cross-border payment'], weight: 3 },
  // Lower priority — broader terms
  { keywords: ['circle', 'tether', 'paxos'], weight: 2 },
  { keywords: ['crypto remittance', 'crypto transfer'], weight: 2 },
];

// Source authority bonus points
const SOURCE_BONUS: Record<string, number> = {
  'CoinDesk Stablecoins': 5,
  'CoinTelegraph Stablecoins': 5,
  'CoinTelegraph Payments': 4,
  'CoinDesk': 3,
  'Blockworks': 3,
  'The Block': 3,
  'CoinTelegraph': 2,
  'Decrypt': 2,
};

// Crypto & finance news RSS sources
const RSS_SOURCES = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
  { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph' },
  { url: 'https://decrypt.co/feed', name: 'Decrypt' },
  { url: 'https://www.theblock.co/rss.xml', name: 'The Block' },
  { url: 'https://cryptoslate.com/feed/', name: 'CryptoSlate' },
  { url: 'https://bitcoinist.com/feed/', name: 'Bitcoinist' },
  { url: 'https://www.newsbtc.com/feed/', name: 'NewsBTC' },
  { url: 'https://beincrypto.com/feed/', name: 'BeInCrypto' },
  { url: 'https://blockworks.co/feed', name: 'Blockworks' },
  { url: 'https://u.today/rss', name: 'U.Today' },
  { url: 'https://cryptobriefing.com/feed/', name: 'Crypto Briefing' },
  { url: 'https://www.cryptonews.com/news/feed/', name: 'CryptoNews' },
  { url: 'https://coingape.com/feed/', name: 'CoinGape' },
  { url: 'https://ambcrypto.com/feed/', name: 'AMBCrypto' },
  { url: 'https://dailyhodl.com/feed/', name: 'Daily Hodl' },
  { url: 'https://www.coindesk.com/tag/stablecoins/feed/', name: 'CoinDesk Stablecoins' },
  { url: 'https://cointelegraph.com/tags/stablecoin/feed', name: 'CoinTelegraph Stablecoins' },
  { url: 'https://cointelegraph.com/tags/payments/feed', name: 'CoinTelegraph Payments' },
  { url: 'https://feeds.feedburner.com/CryptoCoinsNews', name: 'CryptoCoinNews' },
];

function isRelevant(title: string, description: string = ''): boolean {
  const text = (title + ' ' + description).toLowerCase();
  return KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function computeRelevanceScore(title: string, description: string, source: string): number {
  const titleLower = title.toLowerCase();
  const bodyLower = description.toLowerCase();
  let score = 0;

  for (const { keywords, weight } of WEIGHTED_KEYWORDS) {
    for (const kw of keywords) {
      if (titleLower.includes(kw)) {
        score += weight * 2; // Title match counts double
      } else if (bodyLower.includes(kw)) {
        score += weight;
      }
    }
  }

  // Add source authority bonus
  score += SOURCE_BONUS[source] ?? 1;
  return score;
}

function classifyCategory(title: string, description: string = ''): string {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('x402')) return 'X402';
  if (
    text.includes('agentic payment') ||
    text.includes('agentic payments') ||
    text.includes('ai agent payment') ||
    text.includes('autonomous payment') ||
    text.includes('agent payment')
  )
    return 'Agentic Payments';
  if (
    text.includes('payment gateway') ||
    text.includes('payment gateways') ||
    text.includes('crypto gateway') ||
    text.includes('web3 payment') ||
    text.includes('defi payment')
  )
    return 'Payment Gateways';
  if (
    text.includes('stablecoin') ||
    text.includes('stable coin') ||
    text.includes('usdc') ||
    text.includes('usdt') ||
    text.includes('dai') ||
    text.includes('pyusd') ||
    text.includes('cbdc') ||
    text.includes('circle') ||
    text.includes('tether') ||
    text.includes('fiat-backed')
  )
    return 'Stablecoins';
  if (
    text.includes('payment') ||
    text.includes('payment rail') ||
    text.includes('remittance') ||
    text.includes('cross-border')
  )
    return 'Payments';
  return 'General';
}

function cleanText(html: string): string {
  // Strip HTML tags and decode basic entities
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FetchResult {
  source: string;
  added: number;
  skipped: number;
  error?: string;
}

export async function fetchAllNews(): Promise<FetchResult[]> {
  console.log(`[${new Date().toISOString()}] Starting news fetch...`);
  const db = getDB();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO news_articles (title, summary, url, source, published_at, category, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const logFetch = db.prepare(`
    INSERT INTO fetch_log (fetched_at, articles_added) VALUES (datetime('now'), ?)
  `);

  const results: FetchResult[] = [];
  let totalAdded = 0;

  for (const source of RSS_SOURCES) {
    const result: FetchResult = { source: source.name, added: 0, skipped: 0 };

    try {
      const feed = await parser.parseURL(source.url);

      for (const item of feed.items ?? []) {
        const title = cleanText(item.title ?? '');
        const rawSummary = item.contentSnippet ?? item.summary ?? item.content ?? '';
        const summary = cleanText(rawSummary).slice(0, 600);
        const url = item.link ?? item.guid ?? '';
        const pubDate = item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString();

        if (!title || !url) {
          result.skipped++;
          continue;
        }

        if (!isRelevant(title, summary)) {
          result.skipped++;
          continue;
        }

        const category = classifyCategory(title, summary);
        const relevanceScore = computeRelevanceScore(title, summary, source.name);
        const stmt = insert.run(title, summary, url, source.name, pubDate, category, relevanceScore);
        if (stmt.changes > 0) {
          result.added++;
          totalAdded++;
        } else {
          result.skipped++;
        }
      }

      results.push(result);
      console.log(`  ${source.name}: +${result.added} articles (${result.skipped} skipped)`);
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      results.push(result);
      console.error(`  [ERROR] ${source.name}: ${result.error}`);
    }
  }

  logFetch.run(totalAdded);
  console.log(`[${new Date().toISOString()}] Fetch complete. Total new articles: ${totalAdded}`);
  return results;
}

export function getLastFetchTime(): string | null {
  const db = getDB();
  const row = db
    .prepare(`SELECT fetched_at FROM fetch_log ORDER BY id DESC LIMIT 1`)
    .get() as { fetched_at: string } | undefined;
  return row?.fetched_at ?? null;
}
