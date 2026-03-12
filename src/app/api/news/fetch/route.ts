import { NextResponse } from 'next/server';
import { fetchAllNews } from '@/lib/newsFetcher';

export const dynamic = 'force-dynamic';

// Simple in-memory lock to prevent concurrent fetches
let isFetching = false;

export async function POST() {
  if (isFetching) {
    return NextResponse.json({ message: 'Fetch already in progress' }, { status: 409 });
  }

  isFetching = true;
  try {
    const results = await fetchAllNews();
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    return NextResponse.json({ success: true, totalAdded, results });
  } catch (err) {
    console.error('POST /api/news/fetch error:', err);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  } finally {
    isFetching = false;
  }
}
