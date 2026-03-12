'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/', label: '📰 News' },
  { href: '/community', label: '💬 Community' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[#30363d] bg-[#0d1117]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm">
              SC
            </div>
            <span className="hidden sm:block font-semibold text-[#e6edf3] group-hover:text-sky-400 transition-colors">
              StableCoin News
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
