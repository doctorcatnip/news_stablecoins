import { NewsArticle } from '@/lib/db';

const CATEGORY_STYLES: Record<string, string> = {
  Stablecoins: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  Payments: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  'Payment Gateways': 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30',
  X402: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  General: 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30',
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  article: NewsArticle;
}

export default function NewsCard({ article }: Props) {
  const categoryStyle =
    CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES['General'];

  return (
    <article className="news-card group flex flex-col gap-3 bg-[#1c2128] border border-[#30363d] rounded-xl p-5 transition-all duration-200">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[#8b949e] bg-white/5 px-2 py-0.5 rounded-full">
            {article.source}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryStyle}`}>
            {article.category}
          </span>
        </div>
        <time
          dateTime={article.published_at}
          className="text-xs text-[#6e7681] shrink-0"
          title={new Date(article.published_at).toLocaleString()}
        >
          {timeAgo(article.published_at)}
        </time>
      </div>

      {/* Headline */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#e6edf3] font-semibold leading-snug hover:text-sky-400 transition-colors line-clamp-2"
      >
        {article.title}
      </a>

      {/* Summary */}
      {article.summary && (
        <p className="text-sm text-[#8b949e] leading-relaxed line-clamp-3">
          {article.summary}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-[#30363d]">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sky-500 hover:text-sky-400 font-medium transition-colors"
        >
          Read full article →
        </a>
      </div>
    </article>
  );
}
