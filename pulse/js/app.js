/* JATHUFY — Your Sound. Your World. Music Discovery & Streaming Web Player */
(() => {
'use strict';
const D = window.PULSE_DATA;
const TR = Object.fromEntries(D.tracks.map(t => [t.id, t]));
const AL = Object.fromEntries(D.albums.map(a => [a.id, a]));
const AR = Object.fromEntries(D.artists.map(a => [a.id, a]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, c = '') => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ---------- state ---------- */
const KEY = 'jathufy.v2';
const defaults = {
  name: 'Listener',
  liked: ['t1', 't4'],
  playlists: [],
  savedAlbums: ['al1'],
  followed: ['ar2'],
  recent: [],
  plays: 0,
  volume: 0.7,
  shuffle: false,
  repeat: 'off',
  queue: [],
  qi: -1,
  libFilter: 'all',
  libSort: 'recent',
  homeFilter: 'all',
  npvOpen: true,
  sideCollapsed: false
};
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem('jathufy.v1') || localStorage.getItem('pulse.v1') || '{}';
    const value = { ...defaults, ...JSON.parse(raw) };
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
    return value;
  } catch {
    return { ...defaults };
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ }
}

let tamilTrackIds = [];
let tamilStatus = 'loading'; // 'loading' | 'ready' | 'error'
let uploadedTrackIds = [];
let playlistFilterQuery = '';
let currentContextName = 'Now Playing';

const allPlaylists = () => {
  const list = [...D.seedPlaylists];
  if (uploadedTrackIds.length) {
    list.unshift({
      id: 'uploaded_songs',
      name: 'Uploaded Songs',
      desc: 'Audio files uploaded from your device.',
      tracks: uploadedTrackIds.slice(),
      seed: true,
      uploaded: true,
      cover: 'images/cover-liked-songs.jpg'
    });
  }
  return [...list, ...S.playlists];
};
const getPl = id => allPlaylists().find(p => p.id === id);
const isLiked = id => S.liked.includes(id);

/* ---------- artwork helpers (real track/album covers + SVG fallback) ---------- */
const artCache = {};
function svgArt(h1, h2, shape) {
  const k = [h1, h2, shape].join();
  if (artCache[k]) return artCache[k];
  const a = `hsl(${h1} 65% 42%)`, b = `hsl(${h2} 70% 18%)`, c = `hsl(${h1} 85% 72% / .5)`;
  let g = '';
  if (shape === 'sun') g = `<circle cx="150" cy="130" r="70" fill="${c}"/><path d="M0 190h300v110H0z" fill="hsl(${h2} 70% 14% / .7)"/><path d="M0 205h300M0 225h300M0 248h300" stroke="${c}" stroke-width="3"/>`;
  else if (shape === 'rings') g = [40, 80, 120, 160].map(r => `<circle cx="150" cy="150" r="${r}" fill="none" stroke="${c}" stroke-width="6"/>`).join('');
  else if (shape === 'tri') g = `<path d="M150 40 260 240H40z" fill="${c}"/><path d="M150 100 210 215H90z" fill="hsl(${h2} 70% 18% / .75)"/>`;
  else g = Array.from({ length: 16 }, (_, i) => `<rect x="${(i % 4) * 75 + 8}" y="${Math.floor(i / 4) * 75 + 8}" width="59" height="59" rx="${i % 3 ? 10 : 30}" fill="${c}" opacity="${(0.25 + (i * 37 % 60) / 100).toFixed(2)}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/>${g}</svg>`;
  return (artCache[k] = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg));
}
const hash = s => [...String(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const fallbackArt = (key = 'jathufy') => {
  const h = hash(key) % 360;
  return svgArt(h, (h + 55) % 360, ['sun', 'rings', 'tri', 'grid'][h % 4]);
};
const albumArt = (a, large = false) => {
  if (!a) return fallbackArt('album');
  if (large && a.artworkLarge) return a.artworkLarge;
  if (a.artworkUrl) return a.artworkUrl;
  return svgArt(a.hue, a.hue2, a.shape);
};
const artistArt = (a, large = false) => {
  if (!a) return fallbackArt('artist');
  if (large && a.artworkLarge) return a.artworkLarge;
  if (a.artworkUrl) return a.artworkUrl;
  return svgArt(a.hue, a.hue2, a.shape);
};
const trackArt = (t, large = false) => {
  if (!t) return fallbackArt('track');
  if (large && t.artworkLarge) return t.artworkLarge;
  if (t.artworkUrl) return t.artworkUrl;
  return albumArt(AL[t.album], large);
};
function playlistArt(p, large = false) {
  if (!p) return fallbackArt('playlist');
  if (p.cover) return p.cover;
  const first = p.tracks.map(id => TR[id]).find(Boolean);
  if (first) return trackArt(first, large);
  return fallbackArt(p.name);
}
const heroColor = h => `hsl(${h} 45% 28%)`;
const img = (src, cls = '', size = 48, fbKey = 'art', alt = '') => {
  const fb = fallbackArt(fbKey);
  return `<img class="${cls}" src="${esc(src || fb)}" data-fb="${esc(fb)}" onerror="this.onerror=null;this.src=this.dataset.fb" referrerpolicy="no-referrer" alt="${esc(alt)}" width="${size}" height="${size}" loading="lazy" decoding="async">`;
};
const artistLink = id => AR[id] ? `<a href="#/artist/${id}">${esc(AR[id].name)}</a>` : '<span>Unknown Artist</span>';

/* ---------- IndexedDB for persistent uploaded audio files ---------- */
const DB_NAME = 'jathufy-uploads';
const STORE_NAME = 'tracks';
function openUploadDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function parseAudioFilename(filename) {
  const base = String(filename || 'Untitled Track').replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const parts = base.split(/\s+[-–]\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: S.name || 'Local Upload', title: base || 'Untitled Track' };
}
function probeAudioDuration(url) {
  return new Promise(resolve => {
    const a = new Audio();
    a.preload = 'metadata';
    const done = dur => { a.removeAttribute('src'); resolve(Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 30); };
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(30);
    a.src = url;
  });
}
function registerUploadedRecord(rec) {
  const aid = 'up_ar_' + hash(rec.artist).toString(36);
  if (!AR[aid]) {
    const hue = hash(rec.artist) % 360;
    AR[aid] = { id: aid, name: rec.artist, hue, hue2: (hue + 55) % 360, shape: 'rings', artworkUrl: 'images/cover-liked-songs.jpg', bio: 'Uploaded audio artist in your personal library.' };
    D.artists.push(AR[aid]);
  }
  const alid = 'up_al_local';
  if (!AL[alid]) {
    AL[alid] = { id: alid, title: 'Local Uploads', artist: aid, year: 2026, hue: 150, hue2: 200, shape: 'grid', artworkUrl: 'images/cover-liked-songs.jpg' };
    D.albums.push(AL[alid]);
  }
  const fileUrl = rec.blob ? URL.createObjectURL(rec.blob) : rec.file;
  const track = {
    id: rec.id,
    title: rec.title,
    artist: aid,
    album: alid,
    file: fileUrl,
    dur: rec.dur || 30,
    genres: ['Uploaded'],
    artworkUrl: 'images/cover-liked-songs.jpg',
    artworkLarge: 'images/cover-liked-songs.jpg',
    uploaded: true
  };
  TR[track.id] = track;
  if (!D.tracks.some(x => x.id === track.id)) D.tracks.push(track);
  if (!uploadedTrackIds.includes(track.id)) uploadedTrackIds.unshift(track.id);
}
async function loadUploadedTracks() {
  try {
    const db = await openUploadDb();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    records.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    records.forEach(registerUploadedRecord);
    if (records.length) {
      renderLibrary();
      renderView(false);
    }
  } catch { /* ignore when storage restricted */ }
}
async function handleAudioUpload(files) {
  const list = [...(files || [])].filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(f.name));
  if (!list.length) { toast('Please select valid audio files (MP3, WAV, M4A, OGG)'); return; }
  let db = null;
  try { db = await openUploadDb(); } catch {}
  let added = 0;
  for (const file of list) {
    const { artist, title } = parseAudioFilename(file.name);
    const url = URL.createObjectURL(file);
    const dur = await probeAudioDuration(url);
    URL.revokeObjectURL(url);
    const id = 'up_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const rec = { id, title, artist, dur, blob: file, createdAt: Date.now() };
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(rec);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }
    registerUploadedRecord(rec);
    added++;
  }
  renderLibrary();
  toast(`Uploaded ${plural(added, 'song')} to Uploaded Songs`);
  location.hash = '#/playlist/uploaded_songs';
  renderView(true);
}
async function deleteUploadedTrack(id) {
  uploadedTrackIds = uploadedTrackIds.filter(x => x !== id);
  try {
    const db = await openUploadDb();
    await new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {}
  renderLibrary();
  renderView(false);
  toast('Removed uploaded song');
}

/* ---------- toast / menu / modal ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

const menuEl = $('#menu');
let menuReturnFocus = null;
function openMenu(anchor, items, opts = {}) {
  menuReturnFocus = document.activeElement;
  menuEl.innerHTML = items.map((it, i) => it.sep ? '<div class="sep" role="separator"></div>'
    : `<button role="menuitem" class="${it.danger ? 'danger' : ''}" data-mi="${i}">${it.icon ? icon(it.icon) : '<span class="i-sp"></span>'}<span>${esc(it.label)}</span>${it.check ? icon('check', 'tick') : ''}</button>`).join('');
  menuEl.hidden = false;
  const r = anchor.getBoundingClientRect(), mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
  let x = opts.alignLeft ? r.left : r.right - mw, y = r.bottom + 6;
  if (x + mw > innerWidth - 8) x = innerWidth - mw - 8;
  if (x < 8) x = 8;
  if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6);
  menuEl.style.left = x + 'px';
  menuEl.style.top = y + 'px';
  menuEl._items = items;
  const first = $('button', menuEl);
  if (first) first.focus();
}
function closeMenu() {
  if (!menuEl.hidden) {
    menuEl.hidden = true;
    if (menuReturnFocus && menuReturnFocus.focus) menuReturnFocus.focus();
  }
}
menuEl.addEventListener('click', e => {
  const b = e.target.closest('[data-mi]');
  if (!b) return;
  const it = menuEl._items[+b.dataset.mi];
  menuEl.hidden = true;
  menuReturnFocus = null;
  it.fn && it.fn(b);
});
menuEl.addEventListener('keydown', e => {
  const bs = $$('button', menuEl), i = bs.indexOf(document.activeElement);
  if (!bs.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
});

const modalEl = $('#modal');
function modal({ title, text = '', html = '', input = null, confirm = 'Save', cancel = 'Cancel', danger = false }) {
  return new Promise(res => {
    const prev = document.activeElement;
    modalEl.innerHTML = `<form class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>
      ${html || (text ? `<p>${esc(text)}</p>` : '')}${input !== null ? `<input name="v" maxlength="60" value="${esc(input)}" aria-label="${esc(title)}" autocomplete="off">` : ''}
      <div class="dlg-actions">${cancel ? `<button type="button" class="link-btn" data-c>${esc(cancel)}</button>` : ''}<button type="submit" class="pill ${danger ? 'danger' : ''}">${esc(confirm)}</button></div></form>`;
    modalEl.hidden = false;
    const f = $('form', modalEl), inp = $('input', f);
    (inp || $('[type=submit]', f)).focus();
    inp && inp.select();
    const done = v => { modalEl.hidden = true; modalEl.innerHTML = ''; prev && prev.focus && prev.focus(); res(v); };
    f.addEventListener('submit', e => { e.preventDefault(); const v = inp ? inp.value.trim() : true; done(inp && !v ? null : v); });
    const cBtn = $('[data-c]', f);
    if (cBtn) cBtn.onclick = () => done(null);
    modalEl.onclick = e => { if (e.target === modalEl) done(null); };
    modalEl.onkeydown = e => { if (e.key === 'Escape') done(null); };
  });
}

/* ---------- audio engine ---------- */
const audio = new Audio();
audio.preload = 'auto';
audio.volume = S.volume;
let seeking = false;
const cur = () => (S.qi >= 0 ? TR[S.queue[S.qi]] : null);

function loadCurrent(autoplay) {
  const t = cur();
  if (!t) return;
  if (t.previewUrl) {
    audio.src = t.previewUrl;
    if (autoplay) {
      audio.play().catch(err => { if (err && err.name !== 'AbortError' && err.name !== 'NotAllowedError') trackError(); });
      S.recent = [t.id, ...S.recent.filter(x => x !== t.id)].slice(0, 50);
      S.plays++;
    }
    save(); renderPlayer(); markPlaying(); updateMedia();
    if (route().name === 'queue' || route().name === 'recent') renderView(false);
    return;
  }
  if (t.external) {
    audio.pause(); audio.removeAttribute('src'); audio.load();
    if (autoplay) {
      S.recent = [t.id, ...S.recent.filter(x => x !== t.id)].slice(0, 50);
      S.plays++;
      toast('External catalogue track — use More (…) to open link');
    }
    save(); renderPlayer(); markPlaying(); updateMedia();
    if (route().name === 'queue' || route().name === 'recent') renderView(false);
    return;
  }
  audio.src = t.file;
  if (autoplay) {
    audio.play().catch(err => { if (err && err.name !== 'AbortError' && err.name !== 'NotAllowedError') trackError(); });
    S.recent = [t.id, ...S.recent.filter(x => x !== t.id)].slice(0, 50);
    S.plays++;
  }
  save(); renderPlayer(); markPlaying(); updateMedia();
  if (route().name === 'queue' || route().name === 'recent') renderView(false);
}
function trackError() {
  toast("Couldn't play this track. Skipping…");
  if (S.queue.length > 1) setTimeout(() => next(true), 600);
}
audio.addEventListener('error', () => { if (audio.src) trackError(); });
function playList(ids, i = 0, ctxLabel = '') {
  if (!ids.length) return;
  if (ctxLabel) currentContextName = ctxLabel;
  S.queue = ids.slice();
  S.qi = i;
  loadCurrent(true);
}
function toggle() {
  if (!cur()) {
    if (S.queue.length) { S.qi = 0; loadCurrent(true); }
    else if (tamilTrackIds.length) playList(tamilTrackIds, 0, 'Tamil Hits 2026 • Top 100');
    else playList(D.tracks.filter(t => !t.external).map(t => t.id), 0, 'JATHUFY Mix');
    return;
  }
  if (!audio.src) loadCurrent(true);
  else if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}
function next(auto) {
  const n = S.queue.length;
  if (!n) return;
  if (auto && S.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  let i;
  if (S.shuffle && n > 1) { do { i = Math.floor(Math.random() * n); } while (i === S.qi); }
  else {
    i = S.qi + 1;
    if (i >= n) {
      if (S.repeat === 'all' || !auto) i = 0;
      else { audio.pause(); audio.currentTime = 0; renderPlayer(); return; }
    }
  }
  S.qi = i;
  loadCurrent(true);
}
function prev() {
  if (!S.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  S.qi = S.qi > 0 ? S.qi - 1 : (S.repeat === 'all' || S.queue.length > 1 ? S.queue.length - 1 : 0);
  loadCurrent(true);
}
function addToQueue(id, playNext) {
  if (!cur()) { playList([id], 0); return; }
  if (playNext) S.queue.splice(S.qi + 1, 0, id);
  else S.queue.push(id);
  save();
  renderNpv();
  toast(playNext ? 'Playing next' : 'Added to queue');
  if (route().name === 'queue') renderView(false);
}
function moveQueue(from, to) {
  if (from <= S.qi || from >= S.queue.length || to <= S.qi || to >= S.queue.length || from === to) return;
  const [item] = S.queue.splice(from, 1);
  S.queue.splice(to, 0, item);
  save();
  renderNpv();
  renderView(false);
}
audio.addEventListener('ended', () => next(true));
audio.addEventListener('play', () => { renderPlayer(); markPlaying(); });
audio.addEventListener('pause', () => { renderPlayer(); markPlaying(); });
audio.addEventListener('timeupdate', () => { if (!seeking) updateProgress(); });
audio.addEventListener('loadedmetadata', updateProgress);

function dur() {
  if (isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  const t = cur();
  return t ? (t.previewUrl ? 30 : t.dur) : 0;
}
function setFill(el, pct) { el.style.setProperty('--p', pct + '%'); }
function updateProgress() {
  const d = dur(), c = audio.currentTime || 0, pct = d ? (c / d) * 100 : 0;
  $$('.seek').forEach(s => { if (!seeking) s.value = pct * 10; setFill(s, pct); s.setAttribute('aria-valuetext', `${fmt(c)} of ${fmt(d)}`); });
  $$('.t-cur').forEach(e => e.textContent = fmt(c));
  $$('.t-dur').forEach(e => e.textContent = fmt(d));
  $('#mini-bar').style.width = pct + '%';
}
$$('.seek').forEach(s => {
  s.addEventListener('input', () => {
    seeking = true;
    const p = s.value / 10;
    $$('.seek').forEach(x => { x.value = s.value; setFill(x, p); });
    $$('.t-cur').forEach(e => e.textContent = fmt(dur() * p / 100));
  });
  s.addEventListener('change', () => {
    if (cur() && !audio.src) loadCurrent(false);
    audio.currentTime = dur() * s.value / 1000;
    seeking = false;
  });
});
function setVolume(v, persist = true) {
  v = Math.min(1, Math.max(0, v));
  audio.volume = v;
  audio.muted = v === 0;
  if (v > 0) S.volume = v;
  else if (!persist) S.volume = S.volume || 0.5;
  $$('.vol').forEach(x => { x.value = Math.round(v * 100); setFill(x, v * 100); });
  const n = v === 0 ? 'mute' : v < 0.45 ? 'volume-low' : 'volume';
  $$('[data-act=mute]').forEach(b => { b.innerHTML = icon(n); b.setAttribute('aria-label', v === 0 ? 'Unmute' : 'Mute'); });
  save();
}
$$('.vol').forEach(v => v.addEventListener('input', () => setVolume(v.value / 100)));

/* ---------- player UI + Now Playing View ---------- */
function renderPlayer() {
  const t = cur(), playing = t && !audio.paused;
  $('#p-title').textContent = t ? t.title : 'Nothing playing';
  const pa = $('#p-artist');
  pa.textContent = t ? (AR[t.artist]?.name || 'Artist') : 'Pick a song to start';
  pa.href = t ? '#/artist/' + t.artist : '#/home';
  const pArt = $('#p-art');
  if (t) {
    const fb = fallbackArt(t.id);
    pArt.dataset.fb = fb;
    pArt.onerror = () => { pArt.onerror = null; pArt.src = fb; };
    pArt.src = trackArt(t);
    pArt.style.visibility = 'visible';
  } else {
    pArt.style.visibility = 'hidden';
  }
  $('#s-title').textContent = t ? t.title : 'Nothing playing';
  const sa = $('#s-artist');
  sa.textContent = t ? (AR[t.artist]?.name || '') : '';
  sa.href = pa.href;
  if (t) {
    const sArt = $('#s-art');
    const fb = fallbackArt(t.id);
    sArt.dataset.fb = fb;
    sArt.onerror = () => { sArt.onerror = null; sArt.src = fb; };
    sArt.src = trackArt(t, true);
  }
  $$('[data-act=toggle]').forEach(b => { b.innerHTML = icon(playing ? 'pause' : 'play'); b.setAttribute('aria-label', playing ? 'Pause' : 'Play'); });
  $$('[data-act=shuffle]').forEach(b => { b.classList.toggle('on', S.shuffle); b.setAttribute('aria-pressed', S.shuffle); });
  $$('[data-act=repeat]').forEach(b => { b.classList.toggle('on', S.repeat !== 'off'); b.innerHTML = icon(S.repeat === 'one' ? 'repeat1' : 'repeat'); b.setAttribute('aria-label', 'Repeat: ' + S.repeat); });
  $$('[data-act=like-current]').forEach(b => {
    const l = t && isLiked(t.id);
    b.classList.toggle('on', !!l);
    b.innerHTML = icon(l ? 'check-circle' : 'heart');
    b.setAttribute('aria-pressed', !!l);
    b.setAttribute('aria-label', l ? 'Remove from Liked Songs' : 'Save to Liked Songs');
    b.disabled = !t;
  });
  $('#player').classList.toggle('empty', !t);
  document.body.classList.toggle('has-track', !!t);
  $$('[data-act=goto-queue]').forEach(b => b.classList.toggle('on', route().name === 'queue'));
  $$('[data-act=toggle-npv]').forEach(b => b.classList.toggle('on', S.npvOpen));
  updateProgress();
  renderNpv();
}

function renderNpv() {
  const body = $('#npv-body');
  if (!body) return;
  const t = cur();
  $('#npv-ctx').textContent = currentContextName || 'Now Playing';
  if (!t) {
    body.innerHTML = `<div class="empty" style="padding:36px 8px">
      ${icon('music', 'big')}
      <h3>Nothing playing</h3>
      <p>Play any Tamil 2026 hit, curated mix, or uploaded track to view artwork and queue details here.</p>
    </div>`;
    return;
  }
  const ar = AR[t.artist];
  const al = AL[t.album];
  const liked = isLiked(t.id);
  const followed = ar && S.followed.includes(ar.id);
  const nextId = S.queue[S.qi + 1];
  const nextTrack = nextId ? TR[nextId] : null;
  body.innerHTML = `
    <a href="#/album/${t.album}" aria-label="View album ${esc(al?.title || '')}">
      ${img(trackArt(t, true), 'npv-art', 300, t.id, t.title)}
    </a>
    <div class="npv-track-row">
      <div class="npv-track-meta">
        <div class="npv-title"><a href="#/album/${t.album}">${esc(t.title)}</a></div>
        <div class="npv-artist">${artistLink(t.artist)}</div>
      </div>
      <button class="icon-btn like-btn${liked ? ' on' : ''}" data-act="like" data-id="${t.id}" aria-pressed="${liked}" aria-label="${liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}">${icon(liked ? 'check-circle' : 'heart')}</button>
    </div>
    ${ar ? `<div class="npv-card">
      <div class="npv-card-head"><span>About the artist</span><a class="npv-card-link" href="#/artist/${ar.id}">View</a></div>
      <div class="npv-artist-box">
        ${img(artistArt(ar), '', 52, ar.id, ar.name)}
        <div>
          <div class="npv-artist-name"><a href="#/artist/${ar.id}">${esc(ar.name)}</a></div>
          <div class="npv-artist-bio">${esc(ar.bio || 'Artist in JATHUFY catalogue.')}</div>
        </div>
      </div>
      <div><button class="pill outline sm" data-act="follow" data-id="${ar.id}" aria-pressed="${followed}">${followed ? 'Following' : 'Follow'}</button></div>
    </div>` : ''}
    <div class="npv-card">
      <div class="npv-card-head"><span>Next in queue</span><a class="npv-card-link" href="#/queue">Open queue</a></div>
      ${nextTrack ? `<div class="npv-next-row" data-act="play-queue-index" data-q="${S.qi + 1}">
        ${img(trackArt(nextTrack), '', 44, nextTrack.id, nextTrack.title)}
        <div class="npv-next-meta">
          <div class="npv-next-title">${esc(nextTrack.title)}</div>
          <div class="npv-next-sub">${esc(AR[nextTrack.artist]?.name || '')}</div>
        </div>
      </div>` : `<p class="muted" style="font-size:13px">End of queue. Add tracks from any list.</p>`}
    </div>
  `;
}

function markPlaying() {
  const t = cur(), playing = t && !audio.paused;
  $$('[data-track]').forEach(r => {
    const on = t && r.dataset.track === t.id && (r.classList.contains('row') ? (r.dataset.q == null || +r.dataset.q === S.qi) : true);
    r.classList.toggle('current', !!on);
    r.classList.toggle('is-playing', !!(on && playing));
  });
}
function updateMedia() {
  const t = cur();
  if (!('mediaSession' in navigator) || !t) return;
  try {
    const artSrc = trackArt(t, true);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: AR[t.artist]?.name || 'Artist',
      album: AL[t.album]?.title || '',
      artwork: artSrc.startsWith('http') ? [{ src: artSrc, sizes: '600x600', type: 'image/jpeg' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => toggle());
    navigator.mediaSession.setActionHandler('pause', () => toggle());
    navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
    navigator.mediaSession.setActionHandler('previoustrack', prev);
  } catch { /* unsupported */ }
}

/* ---------- mutations ---------- */
function toggleLike(id) {
  const i = S.liked.indexOf(id);
  if (i >= 0) { S.liked.splice(i, 1); toast('Removed from Liked Songs'); }
  else { S.liked.unshift(id); toast('Added to Liked Songs'); }
  save(); renderPlayer(); renderLibrary(); renderView(false);
}
async function createPlaylist(initial) {
  const name = await modal({ title: 'Create playlist', input: `My Playlist #${S.playlists.length + 1}`, confirm: 'Create' });
  if (!name) return null;
  const p = { id: 'u' + Date.now().toString(36), name, tracks: initial ? [initial] : [] };
  S.playlists.unshift(p);
  save(); renderLibrary();
  toast(`Created "${name}"`);
  if (!initial) location.hash = '#/playlist/' + p.id;
  else renderView(false);
  return p;
}
function toggleInPlaylist(pid, tid) {
  const p = S.playlists.find(x => x.id === pid);
  if (!p) return;
  const i = p.tracks.indexOf(tid);
  if (i >= 0) { p.tracks.splice(i, 1); toast(`Removed from ${p.name}`); }
  else { p.tracks.push(tid); toast(`Added to ${p.name}`); }
  save(); renderLibrary(); renderView(false);
}
function playlistPicker(anchor, tid) {
  const items = [{ label: 'New playlist', icon: 'plus', fn: () => createPlaylist(tid) }];
  if (S.playlists.length) items.push({ sep: 1 });
  S.playlists.forEach(p => items.push({ label: p.name, check: p.tracks.includes(tid), fn: () => toggleInPlaylist(p.id, tid) }));
  openMenu(anchor, items);
}
function trackMenu(anchor, tid, ctx) {
  const t = TR[tid];
  if (!t) return;
  const items = [
    ...(t.external && t.spotifyUrl ? [{ label: 'Open song link', icon: 'external', fn: () => window.open(t.spotifyUrl, '_blank', 'noopener,noreferrer') }] : []),
    { label: 'Add to queue', icon: 'queue', fn: () => addToQueue(tid, false) },
    { label: 'Play next', icon: 'next', fn: () => addToQueue(tid, true) },
    { label: isLiked(tid) ? 'Remove from Liked Songs' : 'Save to Liked Songs', icon: isLiked(tid) ? 'check-circle' : 'heart', fn: () => toggleLike(tid) },
    { label: 'Add to playlist…', icon: 'plus', fn: () => setTimeout(() => playlistPicker(anchor, tid), 0) }
  ];
  if (ctx && ctx.startsWith('pl:') && S.playlists.some(p => p.id === ctx.slice(3))) {
    items.push({ label: 'Remove from this playlist', icon: 'trash', fn: () => toggleInPlaylist(ctx.slice(3), tid) });
  }
  if (t.uploaded) {
    items.push({ label: 'Delete uploaded song', icon: 'trash', danger: true, fn: () => deleteUploadedTrack(tid) });
  }
  items.push(
    { sep: 1 },
    { label: 'Go to artist', icon: 'user', fn: () => location.hash = '#/artist/' + t.artist },
    { label: 'Go to album', icon: 'music', fn: () => location.hash = '#/album/' + t.album },
    { label: 'Copy link', icon: 'edit', fn: () => copyLink('album/' + t.album) }
  );
  openMenu(anchor, items);
}
function copyLink(path) {
  const url = location.href.split('#')[0] + '#/' + path;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied'), () => toast(url));
}

/* ---------- reusable render pieces ---------- */
let ctxIds = [];
function row(t, i, o = {}) {
  if (!t) return '';
  const liked = isLiked(t.id);
  const albumTitle = AL[t.album]?.title || '';
  const durLabel = t.previewUrl ? '0:30' : t.external ? 'Link' : fmt(t.dur);
  return `<div class="row${o.q != null ? ' qrow' : ''}" role="row" tabindex="0" ${o.remove ? 'draggable="true"' : ''} data-track="${t.id}" data-i="${i}" ${o.q != null ? `data-q="${o.q}"` : ''} data-ctx="${esc(o.ctx || '')}">
    <div class="r-idx"><span class="num">${o.hideNum ? '' : i + 1}</span><button class="r-play" data-act="row-play" aria-label="Play ${esc(t.title)}">${icon('play')}</button><span class="eq">${icon('eq')}</span></div>
    <div class="r-main">${img(trackArt(t), 'r-art', 40, t.id, t.title)}<div class="r-text"><div class="r-title">${esc(t.title)}</div><div class="r-artist">${artistLink(t.artist)}</div></div></div>
    <div class="r-album"><a href="#/album/${t.album}">${esc(albumTitle)}</a></div>
    <button class="icon-btn r-like${liked ? ' on' : ''}" data-act="like" data-id="${t.id}" aria-label="${liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}" aria-pressed="${liked}">${icon(liked ? 'check-circle' : 'heart')}</button>
    <div class="r-dur">${durLabel}</div>
    <button class="icon-btn r-more" data-act="track-menu" data-id="${t.id}" data-ctx="${esc(o.ctx || '')}" aria-label="More options for ${esc(t.title)}" aria-haspopup="menu">${icon('more')}</button>
    ${o.remove ? `<button class="queue-move" data-act="queue-move" data-q="${o.q}" data-dir="-1" ${o.q <= S.qi + 1 ? 'disabled' : ''} aria-label="Move ${esc(t.title)} up" title="Move up">↑</button><button class="queue-move" data-act="queue-move" data-q="${o.q}" data-dir="1" ${o.q >= S.queue.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(t.title)} down" title="Move down">↓</button><button class="icon-btn r-rm" data-act="queue-remove" data-q="${o.q}" aria-label="Remove from queue">${icon('x')}</button>` : ''}
  </div>`;
}
const listHead = `<div class="row head" role="row"><div class="r-idx">#</div><div class="r-main">Title</div><div class="r-album">Album</div><div></div><div class="r-dur">${icon('clock')}</div><div></div></div>`;
const trackList = (ids, ctx = '') => {
  ctxIds = ids.slice();
  return `<div class="tracks" role="table">${listHead}${ids.map((id, i) => row(TR[id], i, { ctx })).join('')}</div>`;
};
function card(kind, o) {
  if (!o) return '';
  const round = kind === 'artist';
  const src = kind === 'album' ? albumArt(o) : kind === 'artist' ? artistArt(o) : playlistArt(o);
  const title = kind === 'album' ? o.title : o.name;
  const sub = kind === 'album' ? `${o.year} · ${esc(AR[o.artist]?.name || '')}` : kind === 'artist' ? 'Artist' : esc(o.desc || `By ${S.name}`);
  return `<div class="card${round ? ' round' : ''}"><a class="card-main" href="#/${kind}/${o.id}"><div class="card-art">${img(src, '', 200, o.id, title)}</div><div class="card-title">${esc(title)}</div><div class="card-sub">${sub}</div></a>
    <button class="fab" data-act="play-card" data-kind="${kind}" data-id="${o.id}" aria-label="Play ${esc(title)}">${icon('play')}</button></div>`;
}
const shelf = (title, cards, extra = '') => `<section class="shelf"><div class="shelf-head"><h2>${title}</h2>${extra}</div><div class="grid">${cards}</div></section>`;
function idsFor(kind, id) {
  if (kind === 'playlist') return id === 'liked' ? S.liked : (getPl(id) || { tracks: [] }).tracks;
  if (kind === 'album') return D.tracks.filter(t => t.album === id).map(t => t.id);
  if (kind === 'artist') return D.tracks.filter(t => t.artist === id).map(t => t.id);
  return [];
}
const totalDur = ids => {
  const s = ids.reduce((a, id) => a + (TR[id] ? TR[id].dur : 0), 0);
  return s >= 3600 ? `${Math.floor(s / 3600)} hr ${Math.floor(s % 3600 / 60)} min` : `${Math.floor(s / 60)} min ${s % 60} sec`;
};
const emptyState = (ico, h, p, btn = '') => `<div class="empty">${icon(ico, 'big')}<h3>${h}</h3><p>${p}</p>${btn}</div>`;
const actionBar = (ids, extra = '') => `<div class="actions"><button class="hero-play" data-act="play-ids" ${ids.length ? '' : 'disabled'} aria-label="Play">${icon('play')}</button>
  <button class="icon-btn xl${S.shuffle ? ' on' : ''}" data-act="shuffle-ids" ${ids.length ? '' : 'disabled'} aria-label="Shuffle play">${icon('shuffle')}</button>${extra}</div>`;

/* ---------- views ---------- */
function setHero(h) { $('#main').style.setProperty('--hero', h == null ? 'hsl(150 28% 18%)' : heroColor(h)); }
function renderHomeFilters() {
  const el = $('#home-filters');
  if (!el) return;
  const r = route();
  if (r.name !== 'home') { el.innerHTML = ''; return; }
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'tamil', label: 'Tamil 2026' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'albums', label: 'Albums' },
    { id: 'uploaded', label: 'Uploaded' }
  ];
  el.innerHTML = tabs.map(t => `<button class="hf-btn${S.homeFilter === t.id ? ' on' : ''}" data-act="home-filter" data-f="${t.id}" aria-pressed="${S.homeFilter === t.id}">${t.label}</button>`).join('');
}

function vHome() {
  setHero(150);
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const pls = allPlaylists();
  const tamilPl = getPl('tamil_2026_top100');
  const tiles = [
    { href: '#/liked', title: 'Liked Songs', src: 'images/cover-liked-songs.jpg', kind: 'playlist', id: 'liked' },
    ...(tamilPl ? [{ href: '#/playlist/' + tamilPl.id, title: 'Tamil Hits 2026 • Top 100', src: playlistArt(tamilPl), kind: 'playlist', id: tamilPl.id }] : []),
    ...pls.filter(p => p.id !== 'tamil_2026_top100').slice(0, 4).map(p => ({ href: '#/playlist/' + p.id, title: p.name, src: playlistArt(p), kind: 'playlist', id: p.id })),
    ...D.albums.slice(0, 3).map(a => ({ href: '#/album/' + a.id, title: a.title, src: albumArt(a), kind: 'album', id: a.id }))
  ].slice(0, 8);

  const recent = S.recent.map(id => TR[id]).filter(Boolean);
  let h = `<div class="pad"><h1 class="greet">${greet}</h1>`;
  if (S.homeFilter === 'all') {
    h += `<div class="tiles">${tiles.map(t => `<div class="tile"><a href="${t.href}">${img(t.src, '', 56, t.id, t.title)}<span>${esc(t.title)}</span></a><button class="fab" data-act="play-card" data-kind="${t.kind}" data-id="${t.id}" aria-label="Play ${esc(t.title)}">${icon('play')}</button></div>`).join('')}</div>`;
  }

  if (S.homeFilter === 'all' && recent.length) {
    h += shelf('Recently played', recent.slice(0, 10).map(t => `<div class="card"><a class="card-main" href="#/album/${t.album}"><div class="card-art">${img(trackArt(t), '', 200, t.id, t.title)}</div><div class="card-title">${esc(t.title)}</div><div class="card-sub">${esc(AR[t.artist]?.name || '')}</div></a><button class="fab" data-act="play-ids-direct" data-id="${t.id}" aria-label="Play ${esc(t.title)}">${icon('play')}</button></div>`).join(''), '<a class="show-all" href="#/recent">Show all</a>');
  }

  if (S.homeFilter === 'all' || S.homeFilter === 'tamil') {
    if (tamilTrackIds.length) {
      const displayCount = S.homeFilter === 'tamil' ? 100 : 12;
      h += `<section class="shelf">
        <div class="shelf-head">
          <h2>Tamil Hits 2026 · ${tamilTrackIds.length} Tracks</h2>
          <a class="show-all" href="#/playlist/tamil_2026_top100">Show all ${tamilTrackIds.length}</a>
        </div>
        <div class="tracks">${listHead}${tamilTrackIds.slice(0, displayCount).map((id, i) => row(TR[id], i, { ctx: 'tamil' })).join('')}</div>
      </section>`;
    } else if (tamilStatus === 'loading') {
      h += `<section class="shelf"><div class="shelf-head"><h2>Tamil Hits 2026 · Top 100</h2></div><p class="muted" id="tamil-loading">Loading 100 Tamil 2026 tracks and cover art…</p></section>`;
    } else {
      h += `<section class="shelf"><div class="shelf-head"><h2>Tamil Hits 2026</h2><button class="pill outline sm" data-act="retry-tamil">Retry</button></div><p class="muted">Tamil catalogue is temporarily unreachable. Local demo tracks and audio uploads remain available.</p></section>`;
    }
  }

  if (S.homeFilter === 'all' || S.homeFilter === 'uploaded') {
    if (uploadedTrackIds.length) {
      h += `<section class="shelf">
        <div class="shelf-head"><h2>Your Uploaded Songs · ${uploadedTrackIds.length}</h2><a class="show-all" href="#/playlist/uploaded_songs">Show all</a></div>
        <div class="tracks compact">${uploadedTrackIds.slice(0, 10).map((id, i) => row(TR[id], i, { ctx: 'uploaded' })).join('')}</div>
      </section>`;
    } else if (S.homeFilter === 'uploaded') {
      h += emptyState('upload', 'No uploaded songs yet', 'Upload MP3, WAV, M4A, or OGG files from your device to listen offline inside JATHUFY.', '<button class="pill" data-act="upload-songs">Upload Audio Files</button>');
    }
  }

  if (S.homeFilter === 'all' || S.homeFilter === 'playlists') {
    h += shelf('Made for you', pls.map(p => card('playlist', p)).join(''));
  }
  if (S.homeFilter === 'all' || S.homeFilter === 'albums') {
    h += shelf('Popular albums', D.albums.slice(0, 18).map(a => card('album', a)).join(''));
  }
  if (S.homeFilter === 'all') {
    h += shelf('Popular artists', D.artists.slice(0, 18).map(a => card('artist', a)).join(''));
  }
  return h + `<footer class="foot"><span>JATHUFY · Your Sound. Your World.</span><span>Tamil 2026 previews & local audio player</span></footer></div>`;
}

function vSearch(q) {
  setHero(null);
  q = (q || '').trim().toLowerCase();
  const mobileInput = `<div class="mobile-search-bar">${icon('search')}<input id="q-mobile" type="search" value="${esc(q)}" placeholder="What do you want to play?" aria-label="Search"></div>`;
  if (!q) {
    return `<div class="pad">${mobileInput}<h2 class="sec" style="margin-top:8px">Browse all</h2><div class="genres">${D.genres.map(g => `<a class="genre" style="--h:${g.hue}" href="#/search/${encodeURIComponent(g.name)}"><span>${esc(g.name)}</span><i></i></a>`).join('')}</div></div>`;
  }
  const tracks = D.tracks.filter(t => (t.title + ' ' + (AR[t.artist]?.name || '') + ' ' + (AL[t.album]?.title || '') + ' ' + t.genres.join(' ')).toLowerCase().includes(q)).map(t => t.id);
  const artists = D.artists.filter(a => a.name.toLowerCase().includes(q));
  const albums = D.albums.filter(a => (a.title + ' ' + (AR[a.artist]?.name || '')).toLowerCase().includes(q));
  const pls = allPlaylists().filter(p => p.name.toLowerCase().includes(q));
  if (!tracks.length && !artists.length && !albums.length && !pls.length) {
    return `<div class="pad">${mobileInput}${emptyState('search', `No results found for "${esc(q)}"`, 'Check your spelling, or try another artist, song, or genre.')}</div>`;
  }
  const top = artists[0] ? { k: 'artist', o: artists[0] } : albums[0] ? { k: 'album', o: albums[0] } : tracks[0] ? { k: 'track', o: TR[tracks[0]] } : { k: 'playlist', o: pls[0] };
  const topHtml = top.k === 'track'
    ? `<div class="top"><a href="#/album/${top.o.album}">${img(trackArt(top.o), '', 92, top.o.id, top.o.title)}</a><h3>${esc(top.o.title)}</h3><p>Song · ${artistLink(top.o.artist)}</p><button class="fab" data-act="play-ids-direct" data-id="${top.o.id}" aria-label="Play ${esc(top.o.title)}">${icon('play')}</button></div>`
    : `<div class="top"><a href="#/${top.k}/${top.o.id}" class="${top.k === 'artist' ? 'rnd' : ''}">${img(top.k === 'album' ? albumArt(top.o) : top.k === 'artist' ? artistArt(top.o) : playlistArt(top.o), '', 92, top.o.id, top.o.title || top.o.name)}</a><h3>${esc(top.o.title || top.o.name)}</h3><p>${top.k[0].toUpperCase() + top.k.slice(1)}</p><button class="fab" data-act="play-card" data-kind="${top.k}" data-id="${top.o.id}" aria-label="Play">${icon('play')}</button></div>`;
  ctxIds = tracks.slice(0, 20);
  let h = `<div class="pad">${mobileInput}<div class="top-grid"><section><h2 class="sec">Top result</h2>${topHtml}</section>`;
  h += tracks.length ? `<section><h2 class="sec">Songs</h2><div class="tracks compact">${tracks.slice(0, 8).map((id, i) => row(TR[id], i, { ctx: 'search' })).join('')}</div></section>` : '<section></section>';
  h += '</div>';
  if (artists.length) h += shelf('Artists', artists.slice(0, 12).map(a => card('artist', a)).join(''));
  if (albums.length) h += shelf('Albums', albums.slice(0, 12).map(a => card('album', a)).join(''));
  if (pls.length) h += shelf('Playlists', pls.map(p => card('playlist', p)).join(''));
  return h + '</div>';
}

function libEntries() {
  let e = [];
  if (['all', 'playlists'].includes(S.libFilter)) e.push({ kind: 'playlist', id: 'liked', title: 'Liked Songs', sub: `Playlist · ${plural(S.liked.length, 'song')}`, src: 'images/cover-liked-songs.jpg', pin: true });
  if (['all', 'playlists'].includes(S.libFilter)) e.push(...allPlaylists().map(p => ({ kind: 'playlist', id: p.id, title: p.name, sub: `Playlist · ${p.seed ? 'JATHUFY' : S.name} · ${plural(p.tracks.length, 'song')}`, src: playlistArt(p) })));
  if (['all', 'albums'].includes(S.libFilter)) e.push(...S.savedAlbums.filter(id => AL[id]).map(id => ({ kind: 'album', id, title: AL[id].title, sub: `Album · ${AR[AL[id].artist]?.name || ''}`, src: albumArt(AL[id]) })));
  if (['all', 'artists'].includes(S.libFilter)) e.push(...S.followed.filter(id => AR[id]).map(id => ({ kind: 'artist', id, title: AR[id].name, sub: 'Artist', src: artistArt(AR[id]), round: true })));
  if (S.libSort === 'alpha') e.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || a.title.localeCompare(b.title));
  return e;
}
function renderLibrary() {
  $('#lib-chips').innerHTML = ['all', 'playlists', 'albums', 'artists'].map(f => `<button class="chip${S.libFilter === f ? ' on' : ''}" data-act="lib-filter" data-f="${f}" aria-pressed="${S.libFilter === f}">${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</button>`).join('');
  $('#sort-label').textContent = S.libSort === 'alpha' ? 'Alphabetical' : 'Recents';
  const e = libEntries();
  $('#lib-list').innerHTML = e.length ? e.map(x => `<a class="lib-item${x.round ? ' round' : ''}" href="#/${x.kind}/${x.id}" data-lib="${x.kind}:${x.id}" title="${esc(x.title)}">${img(x.src, '', 48, x.id, x.title)}<div><div class="li-title">${esc(x.title)}</div><div class="li-sub">${esc(x.sub)}</div></div></a>`).join('')
    : '<p class="lib-empty">Nothing here yet. Save albums or follow artists to see them in your library.</p>';
  markNav();
}
function vLibrary() {
  setHero(null);
  const e = libEntries();
  return `<div class="pad"><div class="shelf-head"><h1 class="greet sm">Your Library</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill outline sm" data-act="upload-songs">${icon('upload')} Upload Audio</button><button class="pill" data-act="create-playlist">${icon('plus')} Create playlist</button></div></div>
    <div class="chips pg" role="group" style="padding:0 0 16px">${['all', 'playlists', 'albums', 'artists'].map(f => `<button class="chip${S.libFilter === f ? ' on' : ''}" data-act="lib-filter" data-f="${f}">${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
    <button class="sort-btn" data-act="sort-menu" style="margin-left:auto">${S.libSort === 'alpha' ? 'Alphabetical' : 'Recents'} ${icon('down')}</button></div>
    ${e.length ? `<div class="grid lib-grid">${e.map(x => x.kind === 'playlist' && x.id === 'liked' ? `<div class="card"><a class="card-main" href="#/liked"><div class="card-art">${img(x.src, '', 200, 'liked', 'Liked Songs')}</div><div class="card-title">Liked Songs</div><div class="card-sub">${esc(x.sub)}</div></a><button class="fab" data-act="play-card" data-kind="playlist" data-id="liked" aria-label="Play Liked Songs">${icon('play')}</button></div>`
      : card(x.kind, x.kind === 'playlist' ? getPl(x.id) : x.kind === 'album' ? AL[x.id] : AR[x.id])).join('')}</div>` : emptyState('library', 'Your library is empty', 'Save albums, follow artists, upload audio, or create a playlist.')}</div>`;
}
function hero({ type, title, sub, src, h, round, id }) {
  setHero(h);
  return `<div class="hero"><div class="hero-art${round ? ' rnd' : ''}">${img(src, '', 232, id || title, title)}</div><div class="hero-text"><span class="type">${type}</span><h1>${esc(title)}</h1><div class="hero-sub">${sub}</div></div></div>`;
}
function vPlaylist(id) {
  const liked = id === 'liked', p = liked ? { id, name: 'Liked Songs', tracks: S.liked, cover: 'images/cover-liked-songs.jpg' } : getPl(id);
  if (!p) return notFound();
  const mine = !liked && !p.seed, ids = p.tracks.filter(tid => TR[tid]);
  const fq = playlistFilterQuery.trim().toLowerCase();
  const visibleIds = fq ? ids.filter(tid => { const t = TR[tid]; return (t.title + ' ' + (AR[t.artist]?.name || '') + ' ' + (AL[t.album]?.title || '')).toLowerCase().includes(fq); }) : ids;
  const src = liked ? 'images/cover-liked-songs.jpg' : playlistArt(p, true);
  const subExtra = p.desc ? `<div style="margin-bottom:6px;color:rgba(255,255,255,.72)">${esc(p.desc)}</div>` : '';
  let h = hero({ id: p.id, type: 'Public Playlist', title: p.name, src, h: liked ? 265 : hash(p.name) % 360, sub: `${subExtra}<strong>${esc(liked ? S.name : p.seed ? 'JATHUFY' : S.name)}</strong> · ${plural(ids.length, 'song')}${ids.length ? ', ' + totalDur(ids) : ''}` });
  const uploadExtra = p.uploaded ? `<button class="pill outline sm" data-act="upload-songs">${icon('upload')} Upload more</button>` : '';
  const searchBox = ids.length > 8 ? `<label class="filter-inline">${icon('search')}<input id="pl-filter" type="search" value="${esc(playlistFilterQuery)}" placeholder="Search in playlist" aria-label="Search in playlist"></label>` : '';
  h += `<div class="pad body">${actionBar(ids, `${mine ? `<button class="icon-btn xl" data-act="pl-menu" data-id="${id}" aria-label="Playlist options" aria-haspopup="menu">${icon('more')}</button>` : ''}${uploadExtra}${searchBox}`)}`;
  h += visibleIds.length ? trackList(visibleIds, 'pl:' + id) : emptyState('music', fq ? 'No matching tracks' : liked ? 'Songs you like will appear here' : "Let's find something for your playlist", fq ? 'Try clearing your playlist filter.' : liked ? 'Save songs by tapping the heart icon.' : 'Add songs using the suggestions below.');
  if (mine) {
    const sug = D.tracks.filter(t => !ids.includes(t.id)).slice(0, 12);
    if (sug.length) h += `<section class="shelf"><h2 class="sec">Recommended songs</h2><div class="tracks compact">${sug.map(t => `<div class="row sug" data-track="${t.id}"><div class="r-main">${img(trackArt(t), 'r-art', 40, t.id, t.title)}<div class="r-text"><div class="r-title">${esc(t.title)}</div><div class="r-artist">${esc(AR[t.artist]?.name || '')}</div></div></div><div class="r-album">${esc(AL[t.album]?.title || '')}</div><button class="pill sm" data-act="add-to-pl" data-pl="${id}" data-id="${t.id}">Add</button></div>`).join('')}</div></section>`;
  }
  return h + '</div>';
}
function vAlbum(id) {
  const a = AL[id];
  if (!a) return notFound();
  const ids = idsFor('album', id), saved = S.savedAlbums.includes(id);
  let h = hero({ id: a.id, type: 'Album', title: a.title, src: albumArt(a, true), h: a.hue, sub: `<strong><a href="#/artist/${a.artist}">${esc(AR[a.artist]?.name || '')}</a></strong> · ${a.year} · ${plural(ids.length, 'song')}, ${totalDur(ids)}` });
  h += `<div class="pad body">${actionBar(ids, `<button class="icon-btn xl${saved ? ' on' : ''}" data-act="save-album" data-id="${id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from Your Library' : 'Save to Your Library'}">${icon(saved ? 'check-circle' : 'plus')}</button>`)}${trackList(ids, 'album')}`;
  const more = D.albums.filter(x => x.artist === a.artist && x.id !== id);
  if (more.length) h += shelf(`More by ${esc(AR[a.artist]?.name || '')}`, more.map(x => card('album', x)).join(''));
  return h + `<p class="copy">© ${a.year} ${esc(AR[a.artist]?.name || '')}</p></div>`;
}
function vArtist(id) {
  const a = AR[id];
  if (!a) return notFound();
  const ids = idsFor('artist', id), f = S.followed.includes(id);
  let h = hero({ id: a.id, type: 'Verified Artist', title: a.name, src: artistArt(a, true), h: a.hue, round: true, sub: `${plural(ids.length, 'popular song')} · ${f ? 'Following' : 'Not following'}` });
  h += `<div class="pad body">${actionBar(ids, `<button class="pill outline" data-act="follow" data-id="${id}" aria-pressed="${f}">${f ? 'Following' : 'Follow'}</button>`)}<h2 class="sec">Popular</h2>${trackList(ids, 'artist')}`;
  h += shelf('Discography', D.albums.filter(x => x.artist === id).map(x => card('album', x)).join(''));
  h += `<section class="shelf"><h2 class="sec">About</h2><div class="about" style="--h:${a.hue}"><p>${esc(a.bio)}</p></div></section>`;
  return h + '</div>';
}
function vRecent() {
  setHero(215);
  const ids = S.recent.filter(id => TR[id]);
  return `<div class="pad"><div class="shelf-head"><h1 class="greet sm">Recently played</h1>${ids.length ? '<button class="pill outline" data-act="clear-history">Clear history</button>' : ''}</div>${ids.length ? trackList(ids, 'recent') : emptyState('clock', 'Nothing played yet', 'Songs you play will show up here.', '<a class="pill" href="#/home">Browse music</a>')}</div>`;
}
function vQueue() {
  setHero(265);
  const t = cur();
  if (!t) return `<div class="pad"><h1 class="greet sm">Queue</h1>${emptyState('queue', 'Your queue is empty', 'Play a song or add one with “Add to queue”.', '<a class="pill" href="#/home">Find something to play</a>')}</div>`;
  const upIds = S.queue.slice(S.qi + 1);
  ctxIds = S.queue.slice();
  let h = `<div class="pad"><h1 class="greet sm">Queue</h1><h2 class="sec">Now playing</h2><div class="tracks compact">${row(t, 0, { ctx: 'queue', q: S.qi })}</div>`;
  h += `<div class="shelf-head" style="margin-top:24px"><h2 class="sec" style="margin:0">Next in queue</h2>${upIds.length ? '<button class="pill outline" data-act="queue-clear">Clear queue</button>' : ''}</div>`;
  h += upIds.length ? `<div class="tracks compact">${upIds.map((id, i) => row(TR[id], i, { ctx: 'queue', q: S.qi + 1 + i, remove: true })).join('')}</div>` : '<p class="muted">Nothing queued after this song. Use “Add to queue” on any track.</p>';
  return h + '</div>';
}
function vProfile() {
  setHero(150);
  const counts = {};
  S.recent.forEach(id => { const t = TR[id]; if (t) counts[t.artist] = (counts[t.artist] || 0) + 1; });
  const topA = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  let h = hero({ id: 'profile', type: 'Profile', title: S.name, h: 150, round: true, src: 'images/cover-liked-songs.jpg', sub: `${plural(S.playlists.length, 'public playlist')} · ${plural(S.followed.length, 'following')}` });
  h += `<div class="pad body"><div class="actions"><button class="pill" data-act="edit-name">${icon('edit')} Edit name</button><button class="pill outline" data-act="upload-songs">${icon('upload')} Upload Audio</button></div>
    <div class="stats"><div><b>${S.plays}</b><span>Plays</span></div><div><b>${S.liked.length}</b><span>Liked songs</span></div><div><b>${tamilTrackIds.length}</b><span>Tamil 2026 tracks</span></div><div><b>${topA && AR[topA] ? esc(AR[topA].name) : '—'}</b><span>Top artist</span></div></div>`;
  h += S.playlists.length ? shelf('Public playlists', S.playlists.map(p => card('playlist', p)).join('')) : '';
  h += `<section class="shelf"><h2 class="sec">App & Settings</h2>
    <div class="settings"><div><b>Mobile Installation (PWA)</b><span>Install JATHUFY to your Android or desktop home screen via browser menu. Native binary .apk packaging requires external tools like PWABuilder or Android Studio.</span></div><button class="pill outline sm" data-act="install-help">Install guide</button></div>
    <div class="settings"><div><b>Listening history</b><span>Clear your recently played list.</span></div><button class="pill outline sm" data-act="clear-history">Clear</button></div>
    <div class="settings"><div><b>Reset JATHUFY</b><span>Remove playlists, likes and preferences stored in this browser.</span></div><button class="pill danger sm" data-act="reset-all">Reset</button></div></section></div>`;
  return h;
}
const notFound = () => { setHero(null); return `<div class="pad">${emptyState('search', "Couldn't find that page", 'It may have been deleted.', '<a class="pill" href="#/home">Home</a>')}</div>`; };

/* ---------- 100 Tamil 2026 Tracks loader ---------- */
function registerTamilTrack(item, index) {
  if (!item || !item.previewUrl || !item.title || !item.artist) return null;
  const aid = 'tm_artist_' + hash(item.artist).toString(36);
  if (!AR[aid]) {
    const hue = hash(item.artist) % 360;
    AR[aid] = {
      id: aid,
      name: item.artist,
      hue,
      hue2: (hue + 62) % 360,
      shape: 'rings',
      artworkUrl: item.artworkUrl || '',
      artworkLarge: item.artworkLarge || item.artworkUrl || '',
      bio: 'Tamil music artist featured in Tamil Hits 2026.'
    };
    D.artists.push(AR[aid]);
  }
  const albumTitle = item.album || 'Tamil Singles';
  const alid = 'tm_album_' + hash(albumTitle + item.artist).toString(36);
  if (!AL[alid]) {
    const hue = hash(albumTitle) % 360;
    AL[alid] = {
      id: alid,
      title: albumTitle,
      artist: aid,
      year: item.year || 2026,
      hue,
      hue2: (hue + 45) % 360,
      shape: 'sun',
      artworkUrl: item.artworkUrl || '',
      artworkLarge: item.artworkLarge || item.artworkUrl || ''
    };
    D.albums.push(AL[alid]);
  }
  const id = item.id || ('tm_song_' + index);
  if (!TR[id]) {
    const track = {
      id,
      title: item.title,
      artist: aid,
      album: alid,
      dur: item.dur || 30,
      genres: ['Tamil', String(item.year || 2026)],
      previewUrl: item.previewUrl,
      artworkUrl: item.artworkUrl || '',
      artworkLarge: item.artworkLarge || item.artworkUrl || ''
    };
    TR[id] = track;
    D.tracks.push(track);
  }
  return id;
}

async function loadTamilChart() {
  tamilStatus = 'loading';
  try {
    const response = await fetch('/api/tamil-songs', { cache: 'no-store' });
    if (!response.ok) throw new Error('Tamil API unavailable');
    const data = await response.json();
    const list = data.tracks || [];
    if (!list.length) throw new Error('No Tamil tracks returned');
    tamilTrackIds = list.map(registerTamilTrack).filter(Boolean);
    tamilStatus = tamilTrackIds.length ? 'ready' : 'error';

    // Create/refresh dedicated Tamil Top 100 2026 seed playlist
    if (tamilTrackIds.length) {
      const existing = D.seedPlaylists.find(p => p.id === 'tamil_2026_top100');
      const cover = TR[tamilTrackIds[0]]?.artworkLarge || TR[tamilTrackIds[0]]?.artworkUrl || '';
      if (existing) {
        existing.tracks = tamilTrackIds.slice();
        existing.cover = cover;
      } else {
        D.seedPlaylists.unshift({
          id: 'tamil_2026_top100',
          name: 'Tamil Hits 2026 • Top 100',
          desc: `${tamilTrackIds.length} trending Tamil songs with album artwork and 30-second previews.`,
          tracks: tamilTrackIds.slice(),
          seed: true,
          cover
        });
      }
      renderLibrary();
      if (route().name === 'home' || route().name === 'playlist') renderView(false);
    }
  } catch (err) {
    console.warn('JATHUFY Tamil previews:', err);
    tamilStatus = 'error';
    if (route().name === 'home') renderView(false);
  }
}

/* ---------- router ---------- */
function route() {
  const [, name = 'home', arg] = (location.hash || '#/home').match(/^#\/([^/]*)\/?(.*)$/) || [];
  return { name: name || 'home', arg: decodeURIComponent(arg || '') };
}
const views = {
  home: vHome,
  search: r => vSearch(r.arg),
  library: vLibrary,
  playlist: r => vPlaylist(r.arg),
  album: r => vAlbum(r.arg),
  artist: r => vArtist(r.arg),
  recent: vRecent,
  liked: () => vPlaylist('liked'),
  queue: vQueue,
  profile: vProfile
};
const titles = { home: 'Home', search: 'Search', library: 'Your Library', recent: 'Recently played', liked: 'Liked Songs', queue: 'Queue', profile: S.name };

function renderView(resetScroll = true) {
  const r = route(), fn = views[r.name] || (() => notFound());
  const main = $('#main'), y = main.scrollTop;
  if (resetScroll) playlistFilterQuery = '';
  renderHomeFilters();
  $('#view').innerHTML = fn(r);
  const q = $('#q');
  if (r.name === 'search' && document.activeElement !== q) q.value = r.arg;
  document.title = ((r.name === 'playlist' ? (getPl(r.arg) || {}).name : r.name === 'album' ? (AL[r.arg] || {}).title : r.name === 'artist' ? (AR[r.arg] || {}).name : titles[r.name]) || 'JATHUFY') + ' • JATHUFY';
  main.scrollTop = resetScroll ? 0 : y;
  markNav();
  markPlaying();
  $$('[data-act=goto-queue]').forEach(b => b.classList.toggle('on', r.name === 'queue'));
  if (resetScroll) $('#topbar').classList.remove('solid');
}
function markNav() {
  const r = route();
  $$('[data-route]').forEach(a => {
    const on = a.dataset.route === r.name || (a.dataset.route === 'library' && ['liked'].includes(r.name));
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  $$('.lib-item').forEach(a => a.classList.toggle('active', a.dataset.lib === `${r.name === 'liked' ? 'playlist' : r.name}:${r.name === 'liked' ? 'liked' : r.arg}`));
}
window.addEventListener('hashchange', () => { closeMenu(); closeSheet(); renderView(true); });
$('#main').addEventListener('scroll', e => $('#topbar').classList.toggle('solid', e.target.scrollTop > 80), { passive: true });

/* global search box + mobile search + playlist inline filter */
let qT;
function onSearchInput(v) {
  clearTimeout(qT);
  qT = setTimeout(() => {
    const target = '#/search' + (v.trim() ? '/' + encodeURIComponent(v.trim()) : '');
    if (location.hash !== target) history.replaceState(null, '', target);
    renderView(false);
  }, 140);
}
$('#q').addEventListener('input', e => onSearchInput(e.target.value));
$('#q').addEventListener('focus', () => { if (route().name !== 'search') location.hash = '#/search'; });
document.addEventListener('input', e => {
  if (e.target.id === 'q-mobile') {
    onSearchInput(e.target.value);
    const desk = $('#q');
    if (desk) desk.value = e.target.value;
  } else if (e.target.id === 'pl-filter') {
    playlistFilterQuery = e.target.value;
    const caret = e.target.selectionStart;
    renderView(false);
    const inp = $('#pl-filter');
    if (inp) { inp.focus(); inp.setSelectionRange(caret, caret); }
  }
});

/* ---------- PWA install prompt ---------- */
let deferredInstallPrompt = null;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
function syncInstallButton() {
  const btn = $('#install-btn');
  if (!btn) return;
  btn.hidden = isStandalone || (!deferredInstallPrompt && !isIOS);
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  syncInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  syncInstallButton();
  toast('JATHUFY installed');
});
async function triggerInstall() {
  if (deferredInstallPrompt) {
    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') deferredInstallPrompt = null;
    syncInstallButton();
    return;
  }
  await modal({
    title: 'Install JATHUFY App',
    html: `<p>JATHUFY is a Progressive Web App ready for home-screen installation.</p>
      <p><strong>Android Chrome:</strong> Open the browser menu (⋮) and tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
      <p><strong>iPhone / iPad Safari:</strong> Tap the <strong>Share</strong> button, then tap <strong>Add to Home Screen</strong>.</p>
      <p style="font-size:12px">Note: Packaged <code>.apk</code> binaries cannot be compiled inside a web browser environment and require external packaging tools such as PWABuilder or Android Studio.</p>`,
    confirm: 'Got it',
    cancel: ''
  });
}

/* ---------- sheet (mobile now playing) ---------- */
const sheet = $('#sheet');
function openSheet() { if (!cur()) return; sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); document.body.classList.add('noscroll'); }
function closeSheet() { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); document.body.classList.remove('noscroll'); }

/* ---------- events ---------- */
const isTouch = () => matchMedia('(hover: none)').matches;
function playRow(rowEl) {
  const q = rowEl.dataset.q;
  if (q != null && rowEl.dataset.ctx === 'queue') { S.qi = +q; loadCurrent(true); return; }
  if (rowEl.dataset.ctx === 'search') { playList([rowEl.dataset.track], 0, 'Search Results'); return; }
  if (rowEl.dataset.ctx === 'tamil') { playList(tamilTrackIds, tamilTrackIds.indexOf(rowEl.dataset.track), 'Tamil Hits 2026 • Top 100'); return; }
  if (rowEl.dataset.ctx === 'uploaded') { playList(uploadedTrackIds, uploadedTrackIds.indexOf(rowEl.dataset.track), 'Uploaded Songs'); return; }
  const i = ctxIds.indexOf(rowEl.dataset.track);
  playList(ctxIds, i < 0 ? +rowEl.dataset.i : i);
}
const shuffled = a => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
function currentPageIds() {
  const r = route();
  return r.name === 'liked' ? S.liked
    : r.name === 'playlist' ? idsFor('playlist', r.arg)
    : r.name === 'album' ? idsFor('album', r.arg)
    : r.name === 'artist' ? idsFor('artist', r.arg)
    : [];
}

$('#audio-upload-input').addEventListener('change', e => {
  if (e.target.files?.length) handleAudioUpload(e.target.files);
  e.target.value = '';
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    if (!e.target.closest('#menu')) closeMenu();
    const rw = e.target.closest('.row[data-track]');
    if (rw && !rw.classList.contains('head') && !rw.classList.contains('sug') && !e.target.closest('a,button,input')) {
      if (isTouch()) playRow(rw);
      else { $$('.row.sel').forEach(x => x.classList.remove('sel')); rw.classList.add('sel'); }
    }
    if (e.target.closest('#player .p-left')) {
      if (matchMedia('(max-width: 767px)').matches && !e.target.closest('button')) { e.preventDefault(); openSheet(); }
      else if (e.target.closest('#p-art') && cur()) { S.npvOpen = true; document.body.classList.remove('npv-closed'); save(); renderPlayer(); }
    }
    return;
  }
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case 'toggle': toggle(); break;
    case 'next': next(false); break;
    case 'prev': prev(); break;
    case 'shuffle': S.shuffle = !S.shuffle; save(); renderPlayer(); break;
    case 'repeat': S.repeat = { off: 'all', all: 'one', one: 'off' }[S.repeat]; save(); renderPlayer(); toast({ all: 'Repeat all', one: 'Repeat one', off: 'Repeat off' }[S.repeat]); break;
    case 'mute': audio.muted || audio.volume === 0 ? setVolume(S.volume || 0.7) : setVolume(0, false); break;
    case 'like': toggleLike(id); break;
    case 'like-current': if (cur()) toggleLike(cur().id); break;
    case 'row-play': playRow(el.closest('.row')); break;
    case 'track-menu': e.stopPropagation(); trackMenu(el, id, el.dataset.ctx); break;
    case 'play-ids': { const ids = currentPageIds(); playList(ids, 0, document.title.replace(/ • JATHUFY$/, '')); break; }
    case 'shuffle-ids': { const ids = currentPageIds(); S.shuffle = true; playList(shuffled(ids), 0, document.title.replace(/ • JATHUFY$/, '')); renderPlayer(); break; }
    case 'play-ids-direct': playList([id], 0, TR[id]?.title || 'Now Playing'); break;
    case 'play-queue-index': { S.qi = +el.dataset.q; loadCurrent(true); break; }
    case 'play-card': {
      const ids = idsFor(el.dataset.kind, id);
      const label = el.dataset.kind === 'playlist' ? (id === 'liked' ? 'Liked Songs' : getPl(id)?.name) : el.dataset.kind === 'album' ? AL[id]?.title : AR[id]?.name;
      if (ids.length) playList(ids, 0, label || 'Now Playing');
      else toast('Nothing to play yet');
      break;
    }
    case 'goto-queue': location.hash = route().name === 'queue' ? '#/home' : '#/queue'; break;
    case 'toggle-npv': S.npvOpen = !S.npvOpen; document.body.classList.toggle('npv-closed', !S.npvOpen); save(); renderPlayer(); break;
    case 'toggle-side': S.sideCollapsed = !S.sideCollapsed; document.body.classList.toggle('side-collapsed', S.sideCollapsed); save(); break;
    case 'queue-remove': { const i = +el.dataset.q; S.queue.splice(i, 1); if (i < S.qi) S.qi--; if (S.qi >= S.queue.length) S.qi = S.queue.length - 1; save(); renderNpv(); renderView(false); break; }
    case 'queue-move': { const i = +el.dataset.q; moveQueue(i, i + +el.dataset.dir); break; }
    case 'queue-clear': S.queue = S.queue.slice(0, S.qi + 1); save(); renderNpv(); renderView(false); toast('Queue cleared'); break;
    case 'create-playlist': createPlaylist(); break;
    case 'create-menu': e.stopPropagation(); openMenu(el, [
      { label: 'Create a new playlist', icon: 'plus', fn: () => createPlaylist() },
      { label: 'Upload audio files', icon: 'upload', fn: () => $('#audio-upload-input').click() }
    ], { alignLeft: true }); break;
    case 'upload-songs': $('#audio-upload-input').click(); break;
    case 'install-app':
    case 'install-help': triggerInstall(); break;
    case 'retry-tamil': loadTamilChart(); renderView(false); break;
    case 'add-to-pl': toggleInPlaylist(el.dataset.pl, id); break;
    case 'save-album': { const i = S.savedAlbums.indexOf(id); i >= 0 ? S.savedAlbums.splice(i, 1) : S.savedAlbums.unshift(id); save(); toast(i >= 0 ? 'Removed from Your Library' : 'Saved to Your Library'); renderLibrary(); renderView(false); break; }
    case 'follow': { const i = S.followed.indexOf(id); i >= 0 ? S.followed.splice(i, 1) : S.followed.unshift(id); save(); toast(i >= 0 ? 'Unfollowed' : 'Following ' + (AR[id]?.name || 'artist')); renderLibrary(); renderPlayer(); renderView(false); break; }
    case 'lib-filter': S.libFilter = el.dataset.f; save(); renderLibrary(); if (route().name === 'library') renderView(false); break;
    case 'home-filter': S.homeFilter = el.dataset.f; save(); renderView(true); break;
    case 'sort-menu': e.stopPropagation(); openMenu(el, [
      { label: 'Recents', check: S.libSort === 'recent', fn: () => { S.libSort = 'recent'; save(); renderLibrary(); route().name === 'library' && renderView(false); } },
      { label: 'Alphabetical', check: S.libSort === 'alpha', fn: () => { S.libSort = 'alpha'; save(); renderLibrary(); route().name === 'library' && renderView(false); } }
    ], { alignLeft: true }); break;
    case 'pl-menu': e.stopPropagation(); openMenu(el, [
      { label: 'Rename', icon: 'edit', fn: async () => { const p = S.playlists.find(x => x.id === id), n = await modal({ title: 'Rename playlist', input: p.name }); if (n) { p.name = n; save(); renderLibrary(); renderView(false); } } },
      { label: 'Delete', icon: 'trash', danger: true, fn: async () => { const p = S.playlists.find(x => x.id === id); if (await modal({ title: 'Delete playlist?', text: `"${p.name}" will be removed from Your Library.`, confirm: 'Delete', danger: true })) { S.playlists = S.playlists.filter(x => x.id !== id); save(); renderLibrary(); toast('Playlist deleted'); location.hash = '#/library'; } } }
    ]); break;
    case 'profile-menu': e.stopPropagation(); openMenu(el, [
      { label: 'Profile', icon: 'user', fn: () => location.hash = '#/profile' },
      { label: 'Recently played', icon: 'clock', fn: () => location.hash = '#/recent' },
      { label: 'Liked Songs', icon: 'heart', fn: () => location.hash = '#/liked' },
      { sep: 1 },
      { label: 'Upload Audio', icon: 'upload', fn: () => $('#audio-upload-input').click() },
      { label: 'Install App Guide', icon: 'download', fn: () => triggerInstall() }
    ]); break;
    case 'sheet-more': if (cur()) trackMenu(el, cur().id, ''); break;
    case 'close-sheet': closeSheet(); break;
    case 'hist-back': history.back(); break;
    case 'hist-fwd': history.forward(); break;
    case 'clear-history': S.recent = []; save(); renderView(false); toast('History cleared'); break;
    case 'edit-name': { const n = await modal({ title: 'Profile details', input: S.name }); if (n) { S.name = n; save(); updateAvatars(); renderLibrary(); renderView(false); } break; }
    case 'reset-all': if (await modal({ title: 'Reset JATHUFY?', text: 'This clears playlists, likes, history and preferences from this browser.', confirm: 'Reset', danger: true })) { audio.pause(); try { localStorage.removeItem(KEY); } catch {} S = { ...defaults }; audio.removeAttribute('src'); setVolume(S.volume); renderPlayer(); renderLibrary(); location.hash = '#/home'; renderView(true); toast('JATHUFY was reset'); } break;
  }
});

let queueDrag = null;
document.addEventListener('dragstart', e => {
  const row = e.target.closest('.row[data-q]');
  if (!row || +row.dataset.q <= S.qi) return e.preventDefault();
  queueDrag = +row.dataset.q;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(queueDrag));
});
document.addEventListener('dragover', e => {
  const row = e.target.closest('.row[data-q]');
  if (queueDrag == null || !row || +row.dataset.q <= S.qi) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  $$('.row.drag-over').forEach(x => x.classList.remove('drag-over'));
  row.classList.add('drag-over');
});
document.addEventListener('drop', e => {
  const row = e.target.closest('.row[data-q]');
  if (queueDrag == null || !row) return;
  e.preventDefault();
  const target = +row.dataset.q, from = queueDrag;
  queueDrag = null;
  $$('.row.dragging,.row.drag-over').forEach(x => x.classList.remove('dragging', 'drag-over'));
  moveQueue(from, target);
});
document.addEventListener('dragend', () => {
  queueDrag = null;
  $$('.row.dragging,.row.drag-over').forEach(x => x.classList.remove('dragging', 'drag-over'));
});
document.addEventListener('dblclick', e => {
  const rw = e.target.closest('.row[data-track]');
  if (rw && !rw.classList.contains('head') && !rw.classList.contains('sug') && !e.target.closest('a,button,input')) playRow(rw);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeMenu(); closeSheet(); }
  const t = e.target, typing = t.matches && t.matches('input:not([type=range]),textarea,select,[contenteditable]');
  if (typing) return;
  if (e.key === 'Enter' && t.classList && t.classList.contains('row') && !t.classList.contains('head') && !t.classList.contains('sug')) { playRow(t); return; }
  if (e.code === 'Space' && !t.closest('button,a,[role=menuitem]')) { e.preventDefault(); toggle(); }
  else if (e.code === 'ArrowRight' && e.shiftKey) next(false);
  else if (e.code === 'ArrowLeft' && e.shiftKey) prev();
  else if (e.key === 'm' || e.key === 'M') $('[data-act=mute]').click();
});
window.addEventListener('resize', closeMenu);

function updateAvatars() {
  const letter = (S.name || 'L')[0].toUpperCase();
  if ($('#avatar-btn')) $('#avatar-btn').textContent = letter;
  if ($('#avatar-btn-m')) $('#avatar-btn-m').textContent = letter;
}

/* ---------- init ---------- */
updateAvatars();
document.body.classList.toggle('npv-closed', !S.npvOpen);
document.body.classList.toggle('side-collapsed', !!S.sideCollapsed);
setVolume(S.volume || 0.7);
S.queue = S.queue.filter(id => TR[id]);
if (S.qi >= S.queue.length) S.qi = S.queue.length - 1;
if (S.qi >= 0 && cur() && !cur().external) { audio.src = cur().file || cur().previewUrl || ''; }
renderPlayer();
renderLibrary();
syncInstallButton();
if (!location.hash) history.replaceState(null, '', '#/home');
renderView(true);
loadUploadedTracks();
loadTamilChart();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
})();
