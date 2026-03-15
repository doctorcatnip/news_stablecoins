import Anthropic from '@anthropic-ai/sdk';
import { getDB, NewsArticle } from './db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const AVAILABLE_TOPICS = [
  'Stablecoins',
  'Payments',
  'Payment Gateways',
  'X402',
  'CBDC',
  'DeFi',
  'General',
] as const;

export type Topic = (typeof AVAILABLE_TOPICS)[number];

/** Maps a user-friendly topic to the DB category values we filter on */
const TOPIC_TO_CATEGORIES: Record<string, string[]> = {
  Stablecoins: ['Stablecoins'],
  Payments: ['Payments'],
  'Payment Gateways': ['Payment Gateways'],
  X402: ['X402'],
  CBDC: ['Stablecoins', 'General'], // CBDC falls under stablecoins category
  DeFi: ['General', 'Payments'],
  General: ['General'],
};

export function getRecentArticles(topics: string[], hoursBack = 24, limit = 30): NewsArticle[] {
  const db = getDB();
  const cats = topics.flatMap((t) => TOPIC_TO_CATEGORIES[t] ?? [t]);
  const unique = Array.from(new Set(cats));
  const placeholders = unique.map(() => '?').join(',');

  const rows = db
    .prepare(
      `SELECT * FROM news_articles
       WHERE category IN (${placeholders})
         AND published_at >= datetime('now', '-${hoursBack} hours')
       ORDER BY published_at DESC
       LIMIT ?`
    )
    .all(...unique, limit) as NewsArticle[];

  return rows;
}

export async function curateDailyDigest(
  topics: string[],
  hoursBack = 24
): Promise<string> {
  const articles = getRecentArticles(topics, hoursBack, 30);

  if (articles.length === 0) {
    return `📭 No new articles found for your topics (${topics.join(', ')}) in the last ${hoursBack} hours.`;
  }

  const articleList = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.category}] ${a.title}\n   Source: ${a.source} | ${new Date(a.published_at).toLocaleDateString()}\n   ${a.summary?.slice(0, 200) || ''}\n   URL: ${a.url}`
    )
    .join('\n\n');

  const prompt = `You are a crypto/fintech news curator. A user has subscribed to these topics: ${topics.join(', ')}.

Here are the latest articles fetched from RSS feeds:

${articleList}

Please create a concise, well-formatted Telegram digest message. Requirements:
- Use Telegram-friendly formatting (bold with **text**, no HTML)
- Group articles by topic/category
- Write a 1-2 sentence insight for the top 3-5 most important stories
- Include the article URL for each featured story
- Add a brief "Key Takeaway" at the end (2-3 sentences)
- Keep the total under 4000 characters
- Use emojis sparingly but effectively
- Start with a header like "📰 Daily Crypto News Digest"`;

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });

  const response = await stream.finalMessage();

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock && 'text' in textBlock
    ? textBlock.text
    : '⚠️ Could not generate digest at this time.';
}

export async function answerNewsQuery(
  userQuestion: string,
  topics: string[]
): Promise<string> {
  const articles = getRecentArticles(topics, 72, 20); // last 3 days

  const context =
    articles.length > 0
      ? articles
          .map(
            (a) =>
              `Title: ${a.title}\nSource: ${a.source}\nDate: ${a.published_at}\nSummary: ${a.summary}\nURL: ${a.url}`
          )
          .join('\n---\n')
      : 'No recent articles available.';

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    thinking: { type: 'adaptive' },
    system: `You are a knowledgeable crypto/fintech assistant integrated into a Telegram bot.
Answer questions concisely based on recent news articles.
Always cite the article URLs when relevant. Keep responses under 3000 characters.
Use plain text suitable for Telegram (no HTML, use **bold** sparingly).`,
    messages: [
      {
        role: 'user',
        content: `Recent news context:\n${context}\n\nUser question: ${userQuestion}`,
      },
    ],
  });

  const response = await stream.finalMessage();
  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock && 'text' in textBlock
    ? textBlock.text
    : '⚠️ Could not answer at this time.';
}
