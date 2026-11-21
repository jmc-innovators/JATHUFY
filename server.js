import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const publicDir = path.join(__dirname, 'pulse');

// In-memory cache for Tamil 2026 catalogue (30 min TTL)
let tamilCache = { tracks: [], fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000;

const TAMIL_QUERIES = [
  'tamil 2026',
  'tamil 2025',
  'tamil hits 2026',
  'anirudh ravichander tamil',
  'sai abhyankkar',
  'a r rahman tamil',
  'santhosh narayanan tamil',
  'yuvan shankar raja tamil',
  'g v prakash tamil',
  'harris jayaraj tamil',
  'sid sriram tamil',
  'pradeep kumar tamil',
  'dhanush tamil',
  'sean roldan tamil',
  'hiphop tamizha',
  'thaman s tamil',
  'sam c s tamil',
  'vijay antony tamil',
  'imman tamil',
  'tamil cinema hits'
];

const NON_TAMIL_PATTERN = /\b(hindi|punjabi|telugu|malayalam|kannada|bhojpuri|marathi|gujarati|bengali|devotional|spiritual|hanuman|bhajan|chalisa|mantra|lofi|karaoke|instrumental|ringtone|bgm|8d audio)\b/i;

function normalizeKey(title, artist) {
  return `${String(title || '').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^a-z0-9]/g, '')}::${String(artist || '').toLowerCase().split(/[,&]/)[0].replace(/[^a-z0-9]/g, '')}`;
}

function upgradeArtwork(url, size = 600) {
  if (!url) return '';
  return String(url).replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'JATHUFY/1.0' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadTamil100() {
  const seenIds = new Set();
  const seenKeys = new Set();
  const collected = [];

  const addItem = (item) => {
    if (!item || !item.previewUrl || !item.trackName || !item.artistName) return;
    if (item.wrapperType && item.wrapperType !== 'track') return;
    if (item.kind && item.kind !== 'song') return;
    const genre = String(item.primaryGenreName || '');
    const title = String(item.trackName || '');
    const album = String(item.collectionName || '');
    if (NON_TAMIL_PATTERN.test(genre) || NON_TAMIL_PATTERN.test(title) || NON_TAMIL_PATTERN.test(album)) return;
    const releaseYear = item.releaseDate ? Number(String(item.releaseDate).slice(0, 4)) : 2026;
    if (releaseYear < 2015) return;
    const isTamilTagged = /tamil/i.test(genre) || /tamil/i.test(album) || /tamil/i.test(title);
    const isTamilArtist = /anirudh|rahman|santhosh|sid sriram|sai abhyankkar|yuvan|prakash|jayaraj|pradeep|roldan|hiphop tamizha|dhee|jonita|dhanush|thaman|sam c\.?s|vijay antony|imman|gv prakash|shreya|karthik|chinmayi|spb|ilayaraja|ilaiyaraaja|shankar mahadevan|harishankar|srinivas|benny dayal|shakthisree|svet|adithya|arivu|ofro|paal dabba|kaber|think indie/i.test(`${item.artistName} ${album}`);
    if (!isTamilTagged && !isTamilArtist) return;

    const id = String(item.trackId || '');
    const key = normalizeKey(item.trackName, item.artistName);
    if ((id && seenIds.has(id)) || seenKeys.has(key)) return;
    if (id) seenIds.add(id);
    seenKeys.add(key);

    collected.push({
      id: 'tm_' + (id || collected.length + 1),
      trackId: item.trackId || null,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName || 'Tamil Singles',
      year: Number.isFinite(releaseYear) ? releaseYear : 2026,
      releaseDate: item.releaseDate || '',
      dur: Math.max(15, Math.round((item.trackTimeMillis || 210000) / 1000)),
      previewDur: 30,
      genre: item.primaryGenreName || 'Tamil',
      previewUrl: item.previewUrl,
      artworkUrl: upgradeArtwork(item.artworkUrl100, 300),
      artworkLarge: upgradeArtwork(item.artworkUrl100, 600)
    });
  };

  // 1. Apple Music India Top 100 Chart -> resolve Tamil matches via iTunes Lookup
  const chart = await fetchJson('https://rss.applemarketingtools.com/api/v2/in/songs/100/most-played.json');
  const chartResults = chart?.feed?.results || [];
  const tamilChartHints = /tamil|anirudh|rahman|santhosh|sid sriram|sai abhyankkar|yuvan|prakash|jayaraj|pradeep|roldan|hiphop tamizha|dhee|jonita/i;
  const chartCandidates = chartResults.filter(x =>
    (x.genres || []).some(g => /tamil/i.test(g.name || '')) || tamilChartHints.test(x.artistName || '') || tamilChartHints.test(x.name || '')
  );
  if (chartCandidates.length) {
    const ids = chartCandidates.map(x => String(x.id || '').split('/').pop()).filter(x => /^\d+$/.test(x)).slice(0, 40);
    if (ids.length) {
      const lookup = await fetchJson(`https://itunes.apple.com/lookup?id=${ids.join(',')}&entity=song&country=IN`);
      (lookup?.results || []).forEach(addItem);
    }
  }

  // 2. Fetch parallel iTunes search batches to reliably reach 100 unique playable Tamil tracks (prioritizing 2025/2026)
  const searchResults = await Promise.all(
    TAMIL_QUERIES.map(term =>
      fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=25&country=IN`)
    )
  );

  for (const data of searchResults) {
    const items = (data?.results || []).slice().sort((a, b) => {
      const ya = a.releaseDate ? Number(String(a.releaseDate).slice(0, 4)) : 0;
      const yb = b.releaseDate ? Number(String(b.releaseDate).slice(0, 4)) : 0;
      return yb - ya;
    });
    for (const item of items) {
      if (collected.length >= 100) break;
      addItem(item);
    }
    if (collected.length >= 100) break;
  }

  // Sort final list so 2026 & 2025 releases appear first
  collected.sort((a, b) => (b.year || 0) - (a.year || 0));
  return collected.slice(0, 100);
}

app.get('/api/tamil-songs', async (_req, res) => {
  try {
    const now = Date.now();
    if (tamilCache.tracks.length >= 80 && now - tamilCache.fetchedAt < CACHE_TTL_MS) {
      return res.json({ count: tamilCache.tracks.length, cached: true, tracks: tamilCache.tracks });
    }
    const tracks = await loadTamil100();
    if (tracks.length > 0) {
      tamilCache = { tracks, fetchedAt: now };
    }
    return res.json({ count: tracks.length, cached: false, tracks });
  } catch (err) {
    console.error('Failed to load Tamil songs:', err);
    return res.status(500).json({ count: 0, tracks: [], error: 'Failed to load Tamil catalogue' });
  }
});

const publicAssetsDir = path.join(__dirname, 'public', 'assets', 'aistudio');
const indexTemplate = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

function resolveSiteOrigin(req) {
  const rawHost = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();
  if (rawHost) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawHost);
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const proto = isLocal ? (forwardedProto || req.protocol || 'http') : 'https';
    return `${proto}://${rawHost}`;
  }
  const configured = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  return configured || `http://localhost:${PORT}`;
}

function sendIndexHtml(req, res) {
  const origin = resolveSiteOrigin(req);
  const html = indexTemplate.replaceAll('__SITE_ORIGIN__', origin);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(html);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy', tamilCached: tamilCache.tracks.length });
});

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.get(['/', '/index.html'], sendIndexHtml);

app.get(['/manifest.webmanifest', '/site.webmanifest'], (_req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(publicDir, 'manifest.webmanifest'));
});

app.get(['/favicon.svg', '/icon.svg'], (_req, res) => {
  res.type('image/svg+xml');
  res.sendFile(path.join(publicAssetsDir, 'favicon_97cfe0e1.svg'));
});

app.get(['/favicon-96x96.png', '/favicon.ico'], (_req, res) => {
  res.type('image/png');
  res.sendFile(path.join(publicAssetsDir, 'favicon-96x96_e09a4bb2.png'));
});

app.get('/apple-touch-icon.png', (_req, res) => {
  res.type('image/png');
  res.sendFile(path.join(publicAssetsDir, 'apple-touch-icon_6b362fe9.png'));
});

app.get('/web-app-manifest-192x192.png', (_req, res) => {
  res.type('image/png');
  res.sendFile(path.join(publicAssetsDir, 'web-app-manifest-192x192_c0d0e92c.png'));
});

app.get('/web-app-manifest-512x512.png', (_req, res) => {
  res.type('image/png');
  res.sendFile(path.join(publicAssetsDir, 'web-app-manifest-512x512_c1671e3a.png'));
});

app.get('/jathufy-logo.png', (_req, res) => {
  res.type('image/png');
  res.sendFile(path.join(publicAssetsDir, 'jathufy-logo_fe498894.png'));
});

app.get('/og-image.png', (_req, res) => {
  res.type('image/png');
  res.sendFile(path.join(publicAssetsDir, 'file_0000000019788211b937aaff901ce977_2b6a3659.png'));
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(express.static(publicDir, {
  index: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.webmanifest')) {
      res.type('application/manifest+json');
    }
  }
}));

const STATIC_EXT = /\.(?:js|mjs|css|png|jpe?g|gif|webp|svg|ico|wav|mp3|m4a|ogg|aac|flac|webm|json|webmanifest|map|woff2?|ttf)$/i;

app.get('*', (req, res) => {
  if (STATIC_EXT.test(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  return sendIndexHtml(req, res);
});

app.listen(PORT, HOST, () => {
  console.log(`JATHUFY server listening on http://${HOST}:${PORT}`);
});
