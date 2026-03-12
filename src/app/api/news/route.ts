import { NextRequest, NextResponse } from 'next/server';
import { getDB, NewsArticle } from '@/lib/db';
import { getLastFetchTime } from '@/lib/newsFetcher';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const db = getDB();

    let query: string;
    let params: (string | number)[];

    if (category === 'all') {
      query = `
        SELECT * FROM news_articles
        ORDER BY relevance_score DESC, published_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    } else {
      query = `
        SELECT * FROM news_articles
        WHERE category = ?
        ORDER BY relevance_score DESC, published_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [category, limit, offset];
    }

    const articles = db.prepare(query).all(...params) as NewsArticle[];

    const countQuery =
      category === 'all'
        ? `SELECT COUNT(*) as total FROM news_articles`
        : `SELECT COUNT(*) as total FROM news_articles WHERE category = ?`;
    const countParams = category === 'all' ? [] : [category];
    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

    const lastFetch = getLastFetchTime();

    return NextResponse.json({
      articles,
      total,
      limit,
      offset,
      lastFetch,
    });
  } catch (err) {
    console.error('GET /api/news error:', err);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
