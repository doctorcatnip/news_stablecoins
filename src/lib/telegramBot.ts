import { Telegraf, Context, Markup } from 'telegraf';
import { getDB, TelegramSubscription } from './db';
import {
  AVAILABLE_TOPICS,
  Topic,
  curateDailyDigest,
  answerNewsQuery,
  getRecentArticles,
} from './aiCurator';

let bot: Telegraf | null = null;

// ─── DB helpers ──────────────────────────────────────────────────────────────

function getSubscription(chatId: number): TelegramSubscription | null {
  const db = getDB();
  return (
    (db
      .prepare('SELECT * FROM telegram_subscriptions WHERE chat_id = ?')
      .get(chatId) as TelegramSubscription | undefined) ?? null
  );
}

function upsertSubscription(
  chatId: number,
  username: string | undefined,
  topics: string[]
): void {
  const db = getDB();
  db.prepare(
    `INSERT INTO telegram_subscriptions (chat_id, username, topics, active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(chat_id) DO UPDATE SET
       username = excluded.username,
       topics   = excluded.topics,
       active   = 1`
  ).run(chatId, username ?? null, JSON.stringify(topics));
}

function setActive(chatId: number, active: boolean): void {
  getDB()
    .prepare('UPDATE telegram_subscriptions SET active = ? WHERE chat_id = ?')
    .run(active ? 1 : 0, chatId);
}

function getUserTopics(chatId: number): string[] {
  const sub = getSubscription(chatId);
  if (!sub) return ['Stablecoins', 'Payments'];
  try {
    return JSON.parse(sub.topics) as string[];
  } catch {
    return ['Stablecoins', 'Payments'];
  }
}

// ─── Keyboard helpers ─────────────────────────────────────────────────────────

function topicsKeyboard(selected: string[]) {
  const buttons = AVAILABLE_TOPICS.map((t) => {
    const isOn = selected.includes(t);
    return Markup.button.callback(`${isOn ? '✅' : '⬜'} ${t}`, `toggle:${t}`);
  });

  // 2 per row
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  rows.push([Markup.button.callback('💾 Save', 'save_topics')]);
  return Markup.inlineKeyboard(rows);
}

// ─── Bot setup ────────────────────────────────────────────────────────────────

export function createBot(token: string): Telegraf {
  bot = new Telegraf(token);

  // /start
  bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const username = ctx.from?.username;
    const existing = getSubscription(chatId);

    if (!existing) {
      upsertSubscription(chatId, username, ['Stablecoins', 'Payments']);
    } else {
      setActive(chatId, true);
    }

    await ctx.reply(
      `👋 *Welcome to CryptoNews Bot!*\n\n` +
        `I'm powered by Claude AI and will send you curated news about your favourite crypto topics.\n\n` +
        `*Commands:*\n` +
        `📋 /topics – choose your topics\n` +
        `📰 /digest – get today's AI digest\n` +
        `🔍 /news – see latest headlines\n` +
        `❓ /ask <question> – ask me anything\n` +
        `⏸ /pause – pause notifications\n` +
        `▶️ /resume – resume notifications\n` +
        `ℹ️ /status – your subscription info`,
      { parse_mode: 'Markdown' }
    );
  });

  // /topics – show toggle keyboard
  bot.command('topics', async (ctx) => {
    const topics = getUserTopics(ctx.chat.id);
    await ctx.reply(
      '🗂 *Select your topics* (tap to toggle, then tap 💾 Save):',
      {
        parse_mode: 'Markdown',
        ...topicsKeyboard(topics),
      }
    );
  });

  // Inline callback for topic toggle
  bot.action(/^toggle:(.+)$/, async (ctx) => {
    const topic = ctx.match[1] as Topic;
    const chatId = ctx.chat!.id;
    const topics = getUserTopics(chatId);

    const idx = topics.indexOf(topic);
    if (idx === -1) topics.push(topic);
    else topics.splice(idx, 1);

    // Persist temp state via upsert (reuses active subscription)
    upsertSubscription(chatId, ctx.from?.username, topics);

    await ctx.editMessageReplyMarkup(topicsKeyboard(topics).reply_markup);
    await ctx.answerCbQuery(
      `${topics.includes(topic) ? '✅ Added' : '❌ Removed'}: ${topic}`
    );
  });

  // Inline callback save topics
  bot.action('save_topics', async (ctx) => {
    const topics = getUserTopics(ctx.chat!.id);
    await ctx.editMessageText(
      `✅ *Topics saved!*\n\nYou're subscribed to: ${topics.join(', ')}\n\nUse /digest to get your next update.`,
      { parse_mode: 'Markdown' }
    );
    await ctx.answerCbQuery('Topics saved!');
  });

  // /digest – AI-curated digest
  bot.command('digest', async (ctx) => {
    const topics = getUserTopics(ctx.chat.id);
    const thinking = await ctx.reply('⏳ Generating your AI digest…');

    try {
      const digest = await curateDailyDigest(topics, 24);
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id);
      // Telegram message limit is 4096 chars; split if needed
      for (const chunk of splitMessage(digest)) {
        await ctx.reply(chunk, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
      }
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id);
      await ctx.reply(`❌ Error generating digest: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // /news – raw latest headlines (no AI, fast)
  bot.command('news', async (ctx) => {
    const topics = getUserTopics(ctx.chat.id);
    const articles = getRecentArticles(topics, 24, 10);

    if (articles.length === 0) {
      await ctx.reply('📭 No articles found in the last 24 hours for your topics.');
      return;
    }

    const lines = articles.map(
      (a, i) =>
        `${i + 1}. *${escapeMarkdown(a.title)}*\n   _${a.source}_ · ${a.category}\n   ${a.url}`
    );

    const msg = `📰 *Latest headlines for: ${topics.join(', ')}*\n\n${lines.join('\n\n')}`;
    for (const chunk of splitMessage(msg)) {
      await ctx.reply(chunk, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
    }
  });

  // /ask <question>
  bot.command('ask', async (ctx) => {
    const question = ctx.message.text.replace(/^\/ask\s*/i, '').trim();
    if (!question) {
      await ctx.reply('💬 Usage: /ask What is the latest on USDC?');
      return;
    }

    const topics = getUserTopics(ctx.chat.id);
    const thinking = await ctx.reply('🤔 Thinking…');

    try {
      const answer = await answerNewsQuery(question, topics);
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id);
      for (const chunk of splitMessage(answer)) {
        await ctx.reply(chunk, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
      }
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id);
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // /pause
  bot.command('pause', async (ctx) => {
    const sub = getSubscription(ctx.chat.id);
    if (!sub) {
      await ctx.reply('You have no active subscription. Use /start first.');
      return;
    }
    setActive(ctx.chat.id, false);
    await ctx.reply('⏸ Notifications paused. Use /resume to turn them back on.');
  });

  // /resume
  bot.command('resume', async (ctx) => {
    const sub = getSubscription(ctx.chat.id);
    if (!sub) {
      await ctx.reply('You have no subscription yet. Use /start to begin.');
      return;
    }
    setActive(ctx.chat.id, true);
    await ctx.reply('▶️ Notifications resumed! You will receive the next scheduled digest.');
  });

  // /status
  bot.command('status', async (ctx) => {
    const sub = getSubscription(ctx.chat.id);
    if (!sub) {
      await ctx.reply('No subscription found. Use /start to get set up.');
      return;
    }
    const topics = getUserTopics(ctx.chat.id);
    await ctx.reply(
      `ℹ️ *Your Subscription*\n\n` +
        `Status: ${sub.active ? '✅ Active' : '⏸ Paused'}\n` +
        `Topics: ${topics.join(', ')}\n` +
        `Digest schedule: 08:00 & 20:00 JST\n\n` +
        `Use /topics to change your topics.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Help fallback
  bot.help(async (ctx) => {
    await ctx.reply(
      `*CryptoNews Bot Commands*\n\n` +
        `/start – subscribe & welcome\n` +
        `/topics – choose your topics\n` +
        `/digest – AI-curated digest (last 24h)\n` +
        `/news – raw latest headlines\n` +
        `/ask <q> – ask a question about recent news\n` +
        `/pause – pause scheduled digests\n` +
        `/resume – resume scheduled digests\n` +
        `/status – view your subscription`,
      { parse_mode: 'Markdown' }
    );
  });

  return bot;
}

// ─── Scheduled broadcast ─────────────────────────────────────────────────────

/** Called after each news fetch to push digests to all active subscribers */
export async function broadcastDigest(botInstance?: Telegraf): Promise<void> {
  const instance = botInstance ?? bot;
  if (!instance) {
    console.warn('[TelegramBot] broadcastDigest called but bot is not initialised');
    return;
  }

  const db = getDB();
  const subs = db
    .prepare('SELECT * FROM telegram_subscriptions WHERE active = 1')
    .all() as TelegramSubscription[];

  console.log(`[TelegramBot] Broadcasting digest to ${subs.length} subscriber(s)…`);

  for (const sub of subs) {
    let topics: string[];
    try {
      topics = JSON.parse(sub.topics) as string[];
    } catch {
      topics = ['Stablecoins', 'Payments'];
    }

    try {
      const digest = await curateDailyDigest(topics, 12); // last 12h for scheduled runs
      for (const chunk of splitMessage(digest)) {
        await instance.telegram.sendMessage(sub.chat_id, chunk, {
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true },
        });
      }
    } catch (err) {
      console.error(`[TelegramBot] Failed to send digest to ${sub.chat_id}:`, err);
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function splitMessage(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let idx = remaining.lastIndexOf('\n', limit);
    if (idx === -1) idx = limit;
    chunks.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx + 1);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function escapeMarkdown(text: string): string {
  // Escape Markdown special chars for Telegram MarkdownV1
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export function getBot(): Telegraf | null {
  return bot;
}
