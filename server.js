import express from 'express';
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

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.webmanifest')) {
      res.type('application/manifest+json');
    }
  }
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`JATHUFY server listening on http://${HOST}:${PORT}`);
});
