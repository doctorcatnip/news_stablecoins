import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use a global singleton to prevent multiple connections during Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

export interface NewsArticle {
  id: number;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  category: string;
  relevance_score: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  username: string;
  message: string;
  created_at: string;
}

export function getDB(): Database.Database {
  if (!global.__db) {
    const dbDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'news.db');
    global.__db = new Database(dbPath);
    global.__db.pragma('journal_mode = WAL');
    global.__db.pragma('foreign_keys = ON');
    initSchema(global.__db);
  }
  return global.__db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS news_articles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      summary     TEXT DEFAULT '',
      url         TEXT UNIQUE NOT NULL,
      source      TEXT NOT NULL,
      published_at TEXT NOT NULL,
      category    TEXT DEFAULT 'General',
      relevance_score INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL,
      message     TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fetch_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at  TEXT DEFAULT (datetime('now')),
      articles_added INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_news_published   ON news_articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_news_category    ON news_articles(category);
    CREATE INDEX IF NOT EXISTS idx_news_relevance   ON news_articles(relevance_score DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_created     ON chat_messages(id DESC);
  `);

  // Migration: add relevance_score column to existing databases that don't have it
  const cols = db.prepare(`PRAGMA table_info(news_articles)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === 'relevance_score')) {
    db.exec(`ALTER TABLE news_articles ADD COLUMN relevance_score INTEGER DEFAULT 0`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_news_relevance ON news_articles(relevance_score DESC)`);
  }
}

export function initDB(): void {
  getDB();
}
