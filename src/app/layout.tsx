import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'StableCoin News — Stablecoins, Payments & Crypto Gateways',
  description:
    'Live news aggregator covering stablecoins, x402, crypto payment gateways, and digital payments. Community chat included.',
  keywords: 'stablecoin, x402, crypto payments, payment gateway, USDC, USDT, DeFi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0d1117] text-[#e6edf3] antialiased">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="mt-16 border-t border-[#30363d] py-6 text-center text-sm text-[#8b949e]">
          <p>StableCoin News &mdash; Aggregating from top crypto media outlets</p>
          <p className="mt-1">Updates at 08:00 &amp; 20:00 JST daily</p>
        </footer>
      </body>
    </html>
  );
}
