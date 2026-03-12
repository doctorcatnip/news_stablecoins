'use client';

import { useState, useEffect, useCallback } from 'react';
import NewsCard from './NewsCard';
import { NewsArticle } from '@/lib/db';

const CATEGORIES = ['all', 'Stablecoins', 'Payments', 'Payment Gateways', 'X402', 'General'];

interface NewsResponse {
  articles: NewsArticle[];
  total: number;
  lastFetch: string | null;
}

export default function NewsFeed() {
  const [category, setCategory] = useState('all');
  const [data, setData] = useState<NewsResponse>({ articles: [], total: 0, lastFetch: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchNews = useCallback(async (cat: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/news?category=${encodeURIComponent(cat)}&limit=60`);
      if (!res.ok) throw new Error('Failed to load news');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(category);
  }, [category, fetchNews]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/news/fetch', { method: 'POST' });
      await fetchNews(category);
    } finally {
      setRefreshing(false);
    }
  };

  const formatFetchTime = (ts: string | null) => {
    if (!ts) return 'Never';
    const d = new Date(ts + 'Z'); // SQLite stores UTC without Z
    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Tokyo',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Crypto News</h1>
          <p className="text-sm text-[#8b949e] mt-1">
            Stablecoins · X402 · Payments · Crypto Gateways
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.lastFetch && (
            <span className="text-xs text-[#6e7681]">
              Updated: {formatFetchTime(data.lastFetch)}
            </span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                       bg-sky-500/10 text-sky-400 border border-sky-500/30
                       hover:bg-sky-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-thin">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              category === cat
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'bg-[#1c2128] text-[#8b949e] border border-[#30363d] hover:text-[#e6edf3] hover:border-sky-500/50'
            }`}
          >
            {cat === 'all' ? 'All Topics' : cat}
          </button>
        ))}
        {!loading && (
          <span className="shrink-0 ml-auto text-xs text-[#6e7681]">
            {data.total} articles
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5 animate-pulse"
            >
              <div className="flex gap-2 mb-3">
                <div className="h-5 w-20 bg-[#30363d] rounded-full" />
                <div className="h-5 w-24 bg-[#30363d] rounded-full" />
              </div>
              <div className="h-5 bg-[#30363d] rounded mb-2" />
              <div className="h-4 w-4/5 bg-[#30363d] rounded mb-4" />
              <div className="h-3 bg-[#30363d] rounded mb-2" />
              <div className="h-3 w-3/4 bg-[#30363d] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Articles grid */}
      {!loading && data.articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data.articles.length === 0 && !error && (
        <div className="text-center py-20 text-[#8b949e]">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-lg font-medium text-[#e6edf3] mb-2">No articles yet</p>
          <p className="text-sm mb-6">
            Click &quot;Refresh Now&quot; to fetch the latest news from all sources.
          </p>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-6 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Fetching…' : 'Fetch News Now'}
          </button>
        </div>
      )}
    </div>
  );
}
