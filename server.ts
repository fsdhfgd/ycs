import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cache for IP ranges
  let rangesCache: any = null;
  let lastFetch = 0;
  const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

  app.get('/api/ranges', async (req, res) => {
    const now = Date.now();
    if (rangesCache && now - lastFetch < CACHE_TTL) {
      return res.json(rangesCache);
    }

    try {
      console.log('Fetching fresh IP ranges...');
      const [aws, gcp, oracle, cloudflare] = await Promise.all([
        axios.get('https://ip-ranges.amazonaws.com/ip-ranges.json').then(r => r.data).catch(() => null),
        axios.get('https://www.gstatic.com/ipranges/cloud.json').then(r => r.data).catch(() => null),
        axios.get('https://docs.oracle.com/iaas/tools/public_ip_ranges.json').then(r => r.data).catch(() => null),
        axios.get('https://api.cloudflare.com/client/v4/ips').then(r => r.data).catch(() => null),
      ]);

      // Azure is tricky, we'll try a common one or skip for now if it fails
      // Microsoft changes the link weekly. For the purpose of this tool, we'll use a common pattern or fallback.
      // A more robust way would be to scrape the download page, but that's overkill for a quick tool.
      
      rangesCache = {
        aws,
        gcp,
        oracle,
        cloudflare,
        updatedAt: now
      };
      lastFetch = now;
      res.json(rangesCache);
    } catch (error) {
      console.error('Error fetching ranges:', error);
      res.status(500).json({ error: 'Failed to fetch IP ranges' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
