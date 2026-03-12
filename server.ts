import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import cron from 'node-cron';
import { initDB } from './src/lib/db';
import { fetchAllNews } from './src/lib/newsFetcher';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3000', 10);

async function main() {
  // Initialize the SQLite database
  console.log('Initializing database...');
  initDB();

  // Prepare Next.js
  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, () => {
    console.log(`\n> StableCoin News is running on http://localhost:${port}`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
    console.log(`> News updates scheduled daily at 08:00 JST (Asia/Tokyo)\n`);

    // Fetch news in the background after server is ready
    console.log('Running initial news fetch in background...');
    fetchAllNews().catch((err) => console.error('Initial fetch failed:', err));
  });

  // Schedule news fetching: 08:00 JST and 20:00 JST
  // node-cron timezone option handles the JST conversion automatically
  cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('\n[CRON] 08:00 JST — Fetching latest news...');
      await fetchAllNews().catch((err) => console.error('[CRON] Fetch error:', err));
    },
    { timezone: 'Asia/Tokyo' }
  );

  console.log('Cron job scheduled. Server is ready.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
