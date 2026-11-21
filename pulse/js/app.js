/* JATHUFY — Your Sound. Your World. Independent music discovery player. */
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
const KEY = 'jathufy.v1';
const defaults = { name: 'Listener', liked: ['t1', 't4'], playlists: [], savedAlbums: ['al1'], followed: ['ar2'],
  recent: [], plays: 0, volume: 0.7, shuffle: false, repeat: 'off', queue: [], qi: -1, libFilter: 'all', libSort: 'recent' };
let S = load();
function load() { try { const raw = localStorage.getItem(KEY) || localStorage.getItem('pulse.v1') || '{}'; const value = { ...defaults, ...JSON.parse(raw) }; try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} return value; } catch { return { ...defaults }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ } }
const allPlaylists = () => [...D.seedPlaylists, ...S.playlists];
const getPl = id => allPlaylists().find(p => p.id === id);
const isLiked = id => S.liked.includes(id);

/* ---------- generated artwork (original SVG, no external images) ---------- */
const artCache = {};
function svgArt(h1, h2, shape, round) {
  const k = [h1, h2, shape, round].join();
  if (artCache[k]) return artCache[k];
  const a = `hsl(${h1} 70% 45%)`, b = `hsl(${h2} 75% 22%)`, c = `hsl(${h1} 90% 75% / .55)`;
  let g = '';
  if (shape === 'sun') g = `<circle cx="150" cy="130" r="70" fill="${c}"/><path d="M0 190h300v110H0z" fill="hsl(${h2} 70% 14% / .7)"/><path d="M0 205h300M0 225h300M0 248h300" stroke="${c}" stroke-width="3"/>`;
  else if (shape === 'rings') g = [40, 80, 120, 160].map(r => `<circle cx="150" cy="150" r="${r}" fill="none" stroke="${c}" stroke-width="6"/>`).join('');
  else if (shape === 'tri') g = `<path d="M150 40 260 240H40z" fill="${c}"/><path d="M150 100 210 215H90z" fill="hsl(${h2} 70% 18% / .75)"/>`;
  else g = Array.from({ length: 16 }, (_, i) => `<rect x="${(i % 4) * 75 + 8}" y="${Math.floor(i / 4) * 75 + 8}" width="59" height="59" rx="${i % 3 ? 10 : 30}" fill="${c}" opacity="${(0.25 + (i * 37 % 60) / 100).toFixed(2)}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/>${g}</svg>`;
  return (artCache[k] = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg));
}
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const albumArt = a => svgArt(a.hue, a.hue2, a.shape);
const artistArt = a => svgArt(a.hue, a.hue2, a.shape);
const trackArt = t => albumArt(AL[t.album]);
function playlistArt(p) {
  if (p.tracks.length) return trackArt(TR[p.tracks[0]]);
  const h = hash(p.name) % 360; return svgArt(h, (h + 60) % 360, ['sun', 'rings', 'tri', 'grid'][hash(p.name) % 4]);
}
const heroColor = h => `hsl(${h} 45% 30%)`;
const img = (src, cls = '', size = 48) => `<img class="${cls}" src="${src}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
const artistLink = id => `<a href="#/artist/${id}">${esc(AR[id].name)}</a>`;

/* ---------- toast / menu / modal ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

const menuEl = $('#menu');
let menuReturnFocus = null;
function openMenu(anchor, items, opts = {}) {
  menuReturnFocus = document.activeElement;
  menuEl.innerHTML = items.map((it, i) => it.sep ? '<div class="sep" role="separator"></div>'
    : `<button role="menuitem" class="${it.danger ? 'danger' : ''}" data-mi="${i}">${it.icon ? icon(it.icon) : '<span class="i-sp"></span>'}<span>${esc(it.label)}</span>${it.check ? icon('check', 'tick') : ''}</button>`).join('');
  menuEl.hidden = false;
  const r = anchor.getBoundingClientRect(), mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
  let x = opts.alignLeft ? r.left : r.right - mw, y = r.bottom + 6;
  if (x + mw > innerWidth - 8) x = innerWidth - mw - 8; if (x < 8) x = 8;
  if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6);
  menuEl.style.left = x + 'px'; menuEl.style.top = y + 'px';
  menuEl._items = items;
  const first = $('button', menuEl); if (first) first.focus();
}
function closeMenu() { if (!menuEl.hidden) { menuEl.hidden = true; if (menuReturnFocus && menuReturnFocus.focus) menuReturnFocus.focus(); } }
menuEl.addEventListener('click', e => {
  const b = e.target.closest('[data-mi]'); if (!b) return;
  const it = menuEl._items[+b.dataset.mi]; menuEl.hidden = true; menuReturnFocus = null; it.fn && it.fn(b);
});
menuEl.addEventListener('keydown', e => {
  const bs = $$('button', menuEl), i = bs.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
});

const modalEl = $('#modal');
function modal({ title, text = '', input = null, confirm = 'Save', danger = false }) {
  return new Promise(res => {
    const prev = document.activeElement;
    modalEl.innerHTML = `<form class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}${input !== null ? `<input name="v" maxlength="60" value="${esc(input)}" aria-label="${esc(title)}" autocomplete="off">` : ''}
      <div class="dlg-actions"><button type="button" class="link-btn" data-c>Cancel</button><button type="submit" class="pill ${danger ? 'danger' : ''}">${esc(confirm)}</button></div></form>`;
    modalEl.hidden = false;
    const f = $('form', modalEl), inp = $('input', f);
    (inp || $('[type=submit]', f)).focus(); inp && inp.select();
    const done = v => { modalEl.hidden = true; modalEl.innerHTML = ''; prev && prev.focus && prev.focus(); res(v); };
    f.addEventListener('submit', e => { e.preventDefault(); const v = inp ? inp.value.trim() : true; done(inp && !v ? null : v); });
    $('[data-c]', f).onclick = () => done(null);
    modalEl.onclick = e => { if (e.target === modalEl) done(null); };
    modalEl.onkeydown = e => { if (e.key === 'Escape') done(null); };
  });
}

/* ---------- audio engine ---------- */
const audio = new Audio(); audio.preload = 'auto'; audio.volume = S.volume;
let seeking = false;
const cur = () => (S.qi >= 0 ? TR[S.queue[S.qi]] : null);
function loadCurrent(autoplay) {
  const t = cur(); if (!t) return;
  if (t.previewUrl) {
    audio.src = t.previewUrl;
    if (autoplay) { audio.play().catch(err => { if (err && err.name !== 'AbortError' && err.name !== 'NotAllowedError') trackError(); }); S.recent = [t.id, ...S.recent.filter(x => x !== t.id)].slice(0, 50); S.plays++; }
    save(); renderPlayer(); markPlaying(); updateMedia();
    if (route().name === 'queue' || route().name === 'recent') renderView(false);
    return;
  }
  if (t.external) {
    audio.pause(); audio.removeAttribute('src'); audio.load();
    if (autoplay) { window.open(t.spotifyUrl, '_blank', 'noopener,noreferrer'); S.recent = [t.id, ...S.recent.filter(x => x !== t.id)].slice(0, 50); S.plays++; toast('Opening track link'); }
    save(); renderPlayer(); markPlaying(); updateMedia();
    if (route().name === 'queue' || route().name === 'recent') renderView(false);
    return;
  }
  audio.src = t.file;
  if (autoplay) {
    audio.play().catch(err => { if (err && err.name !== 'AbortError' && err.name !== 'NotAllowedError') trackError(); });
    S.recent = [t.id, ...S.recent.filter(x => x !== t.id)].slice(0, 50); S.plays++;
  }
  save(); renderPlayer(); markPlaying(); updateMedia();
  if (route().name === 'queue' || route().name === 'recent') renderView(false);
}
function trackError() { toast("Couldn't play this track. Skipping…"); if (S.queue.length > 1) setTimeout(() => next(true), 600); }
audio.addEventListener('error', () => { if (audio.src) trackError(); });
function playList(ids, i = 0) { if (!ids.length) return; S.queue = ids.slice(); S.qi = i; loadCurrent(true); }
function toggle() {
  if (!cur()) { if (S.queue.length) { S.qi = 0; loadCurrent(true); } else playList(D.tracks.map(t => t.id), 0); return; }
  if (!audio.src) loadCurrent(true); else if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
function next(auto) {
  const n = S.queue.length; if (!n) return;
  if (auto && S.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  let i;
  if (S.shuffle && n > 1) { do { i = Math.floor(Math.random() * n); } while (i === S.qi); }
  else { i = S.qi + 1; if (i >= n) { if (S.repeat === 'all' || !auto) i = 0; else { audio.pause(); audio.currentTime = 0; renderPlayer(); return; } } }
  S.qi = i; loadCurrent(true);
}
function prev() {
  if (!S.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  S.qi = S.qi > 0 ? S.qi - 1 : (S.repeat === 'all' || S.queue.length > 1 ? S.queue.length - 1 : 0); loadCurrent(true);
}
function addToQueue(id, playNext) {
  if (!cur()) { playList([id], 0); return; }
  if (playNext) S.queue.splice(S.qi + 1, 0, id); else S.queue.push(id);
  save(); toast(playNext ? 'Playing next' : 'Added to queue');
  if (route().name === 'queue') renderView(false);
}
function moveQueue(from, to) {
  if (from <= S.qi || from >= S.queue.length || to <= S.qi || to >= S.queue.length || from === to) return;
  const [item] = S.queue.splice(from, 1);
  S.queue.splice(to, 0, item);
  save(); renderView(false);
}
audio.addEventListener('ended', () => next(true));
audio.addEventListener('play', () => { renderPlayer(); markPlaying(); });
audio.addEventListener('pause', () => { renderPlayer(); markPlaying(); });
audio.addEventListener('timeupdate', () => { if (!seeking) updateProgress(); });
audio.addEventListener('loadedmetadata', updateProgress);
function dur() { return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (cur() ? cur().dur : 0); }
function setFill(el, pct) { el.style.setProperty('--p', pct + '%'); }
function updateProgress() {
  const d = dur(), c = audio.currentTime || 0, pct = d ? (c / d) * 100 : 0;
  $$('.seek').forEach(s => { if (!seeking) s.value = pct * 10; setFill(s, pct); s.setAttribute('aria-valuetext', `${fmt(c)} of ${fmt(d)}`); });
  $$('.t-cur').forEach(e => e.textContent = fmt(c)); $$('.t-dur').forEach(e => e.textContent = fmt(d));
  $('#mini-bar').style.width = pct + '%';
}
$$('.seek').forEach(s => {
  s.addEventListener('input', () => { seeking = true; const p = s.value / 10; $$('.seek').forEach(x => { x.value = s.value; setFill(x, p); }); $$('.t-cur').forEach(e => e.textContent = fmt(dur() * p / 100)); });
  s.addEventListener('change', () => { if (cur() && !audio.src) loadCurrent(false); audio.currentTime = dur() * s.value / 1000; seeking = false; });
});
function setVolume(v, persist = true) {
  v = Math.min(1, Math.max(0, v)); audio.volume = v; audio.muted = v === 0;
  if (v > 0) S.volume = v; else if (!persist) S.volume = S.volume || 0.5;
  $$('.vol').forEach(x => { x.value = Math.round(v * 100); setFill(x, v * 100); });
  const n = v === 0 ? 'mute' : v < 0.45 ? 'volume-low' : 'volume';
  $$('[data-act=mute]').forEach(b => { b.innerHTML = icon(n); b.setAttribute('aria-label', v === 0 ? 'Unmute' : 'Mute'); });
  save();
}
$$('.vol').forEach(v => v.addEventListener('input', () => setVolume(v.value / 100)));

/* ---------- player UI ---------- */
function renderPlayer() {
  const t = cur(), playing = t && !audio.paused;
  $('#p-title').textContent = t ? t.title : 'Nothing playing';
  const pa = $('#p-artist'); pa.textContent = t ? AR[t.artist].name : 'Pick a song to start'; pa.href = t ? '#/artist/' + t.artist : '#/home';
  const pArt = $('#p-art'); if (t) { pArt.src = trackArt(t); pArt.style.visibility = 'visible'; } else pArt.style.visibility = 'hidden';
  $('#s-title').textContent = t ? t.title : 'Nothing playing';
  const sa = $('#s-artist'); sa.textContent = t ? AR[t.artist].name : ''; sa.href = pa.href;
  if (t) $('#s-art').src = trackArt(t);
  $$('[data-act=toggle]').forEach(b => { b.innerHTML = icon(playing ? 'pause' : 'play'); b.setAttribute('aria-label', playing ? 'Pause' : 'Play'); });
  $$('[data-act=shuffle]').forEach(b => { b.classList.toggle('on', S.shuffle); b.setAttribute('aria-pressed', S.shuffle); });
  $$('[data-act=repeat]').forEach(b => { b.classList.toggle('on', S.repeat !== 'off'); b.innerHTML = icon(S.repeat === 'one' ? 'repeat1' : 'repeat'); b.setAttribute('aria-label', 'Repeat: ' + S.repeat); });
  $$('[data-act=like-current]').forEach(b => { const l = t && isLiked(t.id); b.classList.toggle('on', !!l); b.innerHTML = icon(l ? 'heart-fill' : 'heart'); b.setAttribute('aria-pressed', !!l); b.setAttribute('aria-label', l ? 'Remove from Liked Songs' : 'Save to Liked Songs'); b.disabled = !t; });
  $('#player').classList.toggle('empty', !t);
  document.body.classList.toggle('has-track', !!t);
  $$('[data-act=goto-queue]').forEach(b => b.classList.toggle('on', route().name === 'queue'));
  updateProgress();
}
function markPlaying() {
  const t = cur(), playing = t && !audio.paused;
  $$('[data-track]').forEach(r => { const on = t && r.dataset.track === t.id && (r.classList.contains('row') ? (r.dataset.q == null || +r.dataset.q === S.qi) : true); r.classList.toggle('current', !!on); r.classList.toggle('is-playing', !!(on && playing)); });
}
function updateMedia() {
  const t = cur(); if (!('mediaSession' in navigator) || !t) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: AR[t.artist].name, album: AL[t.album].title });
    navigator.mediaSession.setActionHandler('play', () => toggle()); navigator.mediaSession.setActionHandler('pause', () => toggle());
    navigator.mediaSession.setActionHandler('nexttrack', () => next(false)); navigator.mediaSession.setActionHandler('previoustrack', prev);
  } catch { /* unsupported */ }
}

/* ---------- mutations ---------- */
function toggleLike(id) {
  const i = S.liked.indexOf(id);
  if (i >= 0) { S.liked.splice(i, 1); toast('Removed from Liked Songs'); } else { S.liked.unshift(id); toast('Added to Liked Songs'); }
  save(); renderPlayer(); renderLibrary(); renderView(false);
}
async function createPlaylist(initial) {
  const name = await modal({ title: 'Create playlist', input: `My Playlist #${S.playlists.length + 1}`, confirm: 'Create' });
  if (!name) return null;
  const p = { id: 'u' + Date.now().toString(36), name, tracks: initial ? [initial] : [] };
  S.playlists.unshift(p); save(); renderLibrary(); toast(`Created "${name}"`);
  if (!initial) location.hash = '#/playlist/' + p.id; else renderView(false);
  return p;
}
function toggleInPlaylist(pid, tid) {
  const p = S.playlists.find(x => x.id === pid); if (!p) return;
  const i = p.tracks.indexOf(tid);
  if (i >= 0) { p.tracks.splice(i, 1); toast(`Removed from ${p.name}`); } else { p.tracks.push(tid); toast(`Added to ${p.name}`); }
  save(); renderLibrary(); renderView(false);
}
function playlistPicker(anchor, tid) {
  const items = [{ label: 'New playlist', icon: 'plus', fn: () => createPlaylist(tid) }];
  if (S.playlists.length) items.push({ sep: 1 });
  S.playlists.forEach(p => items.push({ label: p.name, check: p.tracks.includes(tid), fn: () => toggleInPlaylist(p.id, tid) }));
  openMenu(anchor, items);
}
function trackMenu(anchor, tid, ctx) {
  const t = TR[tid], items = [
    ...(t.external && t.spotifyUrl ? [{ label: 'Open song link', icon: 'external', fn: () => window.open(t.spotifyUrl, '_blank', 'noopener,noreferrer') }] : []),
    { label: 'Add to queue', icon: 'queue', fn: () => addToQueue(tid, false) },
    { label: 'Play next', icon: 'next', fn: () => addToQueue(tid, true) },
    { label: isLiked(tid) ? 'Remove from Liked Songs' : 'Save to Liked Songs', icon: isLiked(tid) ? 'heart-fill' : 'heart', fn: () => toggleLike(tid) },
    { label: 'Add to playlist…', icon: 'plus', fn: () => setTimeout(() => playlistPicker(anchor, tid), 0) }
  ];
  if (ctx && ctx.startsWith('pl:') && S.playlists.some(p => p.id === ctx.slice(3))) items.push({ label: 'Remove from this playlist', icon: 'trash', fn: () => toggleInPlaylist(ctx.slice(3), tid) });
  items.push({ sep: 1 }, { label: 'Go to artist', icon: 'user', fn: () => location.hash = '#/artist/' + t.artist }, { label: 'Go to album', icon: 'music', fn: () => location.hash = '#/album/' + t.album },
    { label: 'Copy link', icon: 'edit', fn: () => copyLink('album/' + t.album) });
  openMenu(anchor, items);
}
function copyLink(path) {
  const url = location.href.split('#')[0] + '#/' + path;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied'), () => toast(url));
}

/* ---------- reusable render pieces ---------- */
let ctxIds = []; // ids of the list currently displayed (used for playing rows)
function row(t, i, o = {}) {
  const liked = isLiked(t.id);
  return `<div class="row${o.q != null ? ' qrow' : ''}" role="row" tabindex="0" ${o.remove ? 'draggable="true"' : ''} data-track="${t.id}" data-i="${i}" ${o.q != null ? `data-q="${o.q}"` : ''} data-ctx="${esc(o.ctx || '')}">
    <div class="r-idx"><span class="num">${o.hideNum ? '' : i + 1}</span><button class="r-play" data-act="row-play" aria-label="Play ${esc(t.title)}">${icon('play')}</button><span class="eq">${icon('eq')}</span></div>
    <div class="r-main">${img(trackArt(t), 'r-art', 40)}<div class="r-text"><div class="r-title">${esc(t.title)}</div><div class="r-artist">${artistLink(t.artist)}</div></div></div>
    <div class="r-album"><a href="#/album/${t.album}">${esc(AL[t.album].title)}</a></div>
    <button class="icon-btn r-like${liked ? ' on' : ''}" data-act="like" data-id="${t.id}" aria-label="${liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}" aria-pressed="${liked}">${icon(liked ? 'heart-fill' : 'heart')}</button>
    <div class="r-dur">${t.previewUrl ? 'Preview' : t.external ? 'Link' : fmt(t.dur)}</div>
    <button class="icon-btn r-more" data-act="track-menu" data-id="${t.id}" data-ctx="${esc(o.ctx || '')}" aria-label="More options for ${esc(t.title)}" aria-haspopup="menu">${icon('more')}</button>
    ${o.remove ? `<button class="queue-move" data-act="queue-move" data-q="${o.q}" data-dir="-1" ${o.q <= S.qi + 1 ? 'disabled' : ''} aria-label="Move ${esc(t.title)} up" title="Move up">↑</button><button class="queue-move" data-act="queue-move" data-q="${o.q}" data-dir="1" ${o.q >= S.queue.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(t.title)} down" title="Move down">↓</button><button class="icon-btn r-rm" data-act="queue-remove" data-q="${o.q}" aria-label="Remove from queue">${icon('x')}</button>` : ''}
  </div>`;
}
const listHead = `<div class="row head" role="row"><div class="r-idx">#</div><div class="r-main">Title</div><div class="r-album">Album</div><div></div><div class="r-dur">${icon('clock')}</div><div></div></div>`;
const trackList = (ids, ctx = '') => { ctxIds = ids.slice(); return `<div class="tracks" role="table">${listHead}${ids.map((id, i) => row(TR[id], i, { ctx })).join('')}</div>`; };
function card(kind, o) {
  const round = kind === 'artist';
  const src = kind === 'album' ? albumArt(o) : kind === 'artist' ? artistArt(o) : playlistArt(o);
  const title = kind === 'album' ? o.title : o.name;
  const sub = kind === 'album' ? `${o.year} • ${esc(AR[o.artist].name)}` : kind === 'artist' ? 'Artist' : esc(o.desc || `By ${S.name}`);
  return `<div class="card${round ? ' round' : ''}"><a class="card-main" href="#/${kind}/${o.id}"><div class="card-art">${img(src, '', 200)}</div><div class="card-title">${esc(title)}</div><div class="card-sub">${sub}</div></a>
    <button class="fab" data-act="play-card" data-kind="${kind}" data-id="${o.id}" aria-label="Play ${esc(title)}">${icon('play')}</button></div>`;
}
const shelf = (title, cards, extra = '') => `<section class="shelf"><div class="shelf-head"><h2>${title}</h2>${extra}</div><div class="grid">${cards}</div></section>`;
function idsFor(kind, id) {
  if (kind === 'playlist') return id === 'liked' ? S.liked : (getPl(id) || { tracks: [] }).tracks;
  if (kind === 'album') return D.tracks.filter(t => t.album === id).map(t => t.id);
  if (kind === 'artist') return D.tracks.filter(t => t.artist === id).map(t => t.id);
  return [];
}
const totalDur = ids => { const s = ids.reduce((a, id) => a + TR[id].dur, 0); return s >= 3600 ? `${Math.floor(s / 3600)} hr ${Math.floor(s % 3600 / 60)} min` : `${Math.floor(s / 60)} min ${s % 60} sec`; };
const emptyState = (ico, h, p, btn = '') => `<div class="empty">${icon(ico, 'big')}<h3>${h}</h3><p>${p}</p>${btn}</div>`;
const actionBar = (ids, extra = '') => `<div class="actions"><button class="hero-play" data-act="play-ids" ${ids.length ? '' : 'disabled'} aria-label="Play">${icon('play')}</button>
  <button class="icon-btn xl${S.shuffle ? ' on' : ''}" data-act="shuffle-ids" ${ids.length ? '' : 'disabled'} aria-label="Shuffle play">${icon('shuffle')}</button>${extra}</div>`;

/* ---------- views ---------- */
function setHero(h) { $('#main').style.setProperty('--hero', h == null ? 'hsl(150 30% 22%)' : heroColor(h)); }
function vHome() {
  setHero(150);
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const pls = allPlaylists();
  const tiles = [{ href: '#/liked', title: 'Liked Songs', src: svgArt(265, 200, 'grid'), kind: 'playlist', id: 'liked' }, ...pls.slice(0, 5).map(p => ({ href: '#/playlist/' + p.id, title: p.name, src: playlistArt(p), kind: 'playlist', id: p.id })),
    ...D.albums.slice(0, 2).map(a => ({ href: '#/album/' + a.id, title: a.title, src: albumArt(a), kind: 'album', id: a.id }))];
  const recent = S.recent.map(id => TR[id]);
  let h = `<div class="pad"><h1 class="greet">${greet}</h1><div class="tiles">${tiles.map(t => `<div class="tile"><a href="${t.href}">${img(t.src, '', 64)}<span>${esc(t.title)}</span></a><button class="fab" data-act="play-card" data-kind="${t.kind}" data-id="${t.id}" aria-label="Play ${esc(t.title)}">${icon('play')}</button></div>`).join('')}</div>`;
  if (recent.length) h += shelf('Recently played', recent.slice(0, 12).map(t => card('album', AL[t.album]).replace(/data-act="play-card" data-kind="album" data-id="[^"]+"/, `data-act="play-ids-direct" data-id="${t.id}"`).replace(/class="card-title">[^<]*/, `class="card-title">${esc(t.title)}`)).join(''), '<a class="show-all" href="#/recent">Show all</a>');
  if (tamilTrackIds.length) h += `<section class="shelf"><div class="shelf-head"><h2>Popular Tamil • Preview</h2><span class="show-all">30-second previews</span></div><div class="tracks compact">${tamilTrackIds.slice(0, 30).map((id, i) => row(TR[id], i, { ctx: 'search' })).join('')}</div><p class="muted" style="font-size:12px">Previews play inside JATHUFY without third-party player branding. Current chart matches are preferred; search results are used only as a fallback.</p></section>`;
  else h += `<section class="shelf"><div class="shelf-head"><h2>Popular Tamil • Preview</h2></div><p class="muted" id="tamil-loading">Loading current Tamil chart previews…</p></section>`;
  h += shelf('Made for you', pls.map(p => card('playlist', p)).join(''));
  h += shelf('Popular albums', D.albums.map(a => card('album', a)).join(''));
  h += shelf('Popular artists', D.artists.map(a => card('artist', a)).join(''));
  return h + '<footer class="foot">JATHUFY • Your Sound. Your World. Founded by Jathush (JMC Innovator). Tamil chart previews play directly in JATHUFY; local demo tracks remain available.</footer></div>'; 
}
function vSearch(q) {
  setHero(null); q = (q || '').trim().toLowerCase();
  if (!q) return `<div class="pad"><h2 class="sec">Browse all</h2><div class="genres">${D.genres.map(g => `<a class="genre" style="--h:${g.hue}" href="#/search/${encodeURIComponent(g.name)}"><span>${esc(g.name)}</span><i></i></a>`).join('')}</div></div>`;
  const tracks = D.tracks.filter(t => (t.title + ' ' + AR[t.artist].name + ' ' + AL[t.album].title + ' ' + t.genres.join(' ')).toLowerCase().includes(q)).map(t => t.id);
  const artists = D.artists.filter(a => a.name.toLowerCase().includes(q));
  const albums = D.albums.filter(a => (a.title + ' ' + AR[a.artist].name).toLowerCase().includes(q));
  const pls = allPlaylists().filter(p => p.name.toLowerCase().includes(q));
  if (!tracks.length && !artists.length && !albums.length && !pls.length) return `<div class="pad">${emptyState('search', `No results found for "${esc(q)}"`, 'Please make sure your words are spelled correctly, or use fewer or different keywords.')}</div>`;
  const top = artists[0] ? { k: 'artist', o: artists[0] } : albums[0] ? { k: 'album', o: albums[0] } : tracks[0] ? { k: 'track', o: TR[tracks[0]] } : { k: 'playlist', o: pls[0] };
  const topHtml = top.k === 'track' ? `<div class="top"><a href="#/album/${top.o.album}">${img(trackArt(top.o), '', 92)}</a><h3>${esc(top.o.title)}</h3><p>Song • ${artistLink(top.o.artist)}</p><button class="fab" data-act="play-ids-direct" data-id="${top.o.id}" aria-label="Play ${esc(top.o.title)}">${icon('play')}</button></div>`
    : `<div class="top"><a href="#/${top.k}/${top.o.id}" class="${top.k === 'artist' ? 'rnd' : ''}">${img(top.k === 'album' ? albumArt(top.o) : top.k === 'artist' ? artistArt(top.o) : playlistArt(top.o), '', 92)}</a><h3>${esc(top.o.title || top.o.name)}</h3><p>${top.k[0].toUpperCase() + top.k.slice(1)}</p><button class="fab" data-act="play-card" data-kind="${top.k}" data-id="${top.o.id}" aria-label="Play">${icon('play')}</button></div>`;
  ctxIds = tracks.slice(0, 6);
  let h = `<div class="pad"><div class="top-grid"><section><h2 class="sec">Top result</h2>${topHtml}</section>`;
  h += tracks.length ? `<section><h2 class="sec">Songs</h2><div class="tracks compact">${tracks.slice(0, 6).map((id, i) => row(TR[id], i, { ctx: 'search', hideNum: false })).join('')}</div></section>` : '<section></section>';
  h += '</div>';
  if (artists.length) h += shelf('Artists', artists.map(a => card('artist', a)).join(''));
  if (albums.length) h += shelf('Albums', albums.map(a => card('album', a)).join(''));
  if (pls.length) h += shelf('Playlists', pls.map(p => card('playlist', p)).join(''));
  return h + '</div>';
}
function libEntries() {
  let e = [];
  if (['all', 'playlists'].includes(S.libFilter)) e.push({ kind: 'playlist', id: 'liked', title: 'Liked Songs', sub: `Playlist • ${plural(S.liked.length, 'song')}`, src: svgArt(265, 200, 'grid'), pin: true });
  if (['all', 'playlists'].includes(S.libFilter)) e.push(...allPlaylists().map(p => ({ kind: 'playlist', id: p.id, title: p.name, sub: `Playlist • ${p.seed ? 'JATHUFY' : S.name}`, src: playlistArt(p) })));
  if (['all', 'albums'].includes(S.libFilter)) e.push(...S.savedAlbums.filter(id => AL[id]).map(id => ({ kind: 'album', id, title: AL[id].title, sub: `Album • ${AR[AL[id].artist].name}`, src: albumArt(AL[id]) })));
  if (['all', 'artists'].includes(S.libFilter)) e.push(...S.followed.filter(id => AR[id]).map(id => ({ kind: 'artist', id, title: AR[id].name, sub: 'Artist', src: artistArt(AR[id]), round: true })));
  if (S.libSort === 'alpha') e.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || a.title.localeCompare(b.title));
  return e;
}
function renderLibrary() {
  $('#lib-chips').innerHTML = ['all', 'playlists', 'albums', 'artists'].map(f => `<button class="chip${S.libFilter === f ? ' on' : ''}" data-act="lib-filter" data-f="${f}" aria-pressed="${S.libFilter === f}">${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</button>`).join('');
  $('#sort-label').textContent = S.libSort === 'alpha' ? 'Alphabetical' : 'Recents';
  const e = libEntries();
  $('#lib-list').innerHTML = e.length ? e.map(x => `<a class="lib-item${x.round ? ' round' : ''}" href="#/${x.kind}/${x.id}" data-lib="${x.kind}:${x.id}" title="${esc(x.title)}">${img(x.src, '', 48)}<div><div class="li-title">${esc(x.title)}</div><div class="li-sub">${esc(x.sub)}</div></div></a>`).join('')
    : '<p class="lib-empty">Nothing here yet. Save albums or follow artists to see them in your library.</p>';
  markNav();
}
function vLibrary() {
  setHero(null);
  const e = libEntries();
  return `<div class="pad"><div class="shelf-head"><h1 class="greet sm">Your Library</h1><button class="pill" data-act="create-playlist">${icon('plus')} Create playlist</button></div>
    <div class="chips pg" role="group">${['all', 'playlists', 'albums', 'artists'].map(f => `<button class="chip${S.libFilter === f ? ' on' : ''}" data-act="lib-filter" data-f="${f}">${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
    <button class="sort-btn" data-act="sort-menu">${S.libSort === 'alpha' ? 'Alphabetical' : 'Recents'} ${icon('down')}</button></div>
    ${e.length ? `<div class="grid lib-grid">${e.map(x => x.kind === 'playlist' && x.id === 'liked' ? `<div class="card"><a class="card-main" href="#/liked"><div class="card-art">${img(x.src, '', 200)}</div><div class="card-title">Liked Songs</div><div class="card-sub">${esc(x.sub)}</div></a><button class="fab" data-act="play-card" data-kind="playlist" data-id="liked" aria-label="Play Liked Songs">${icon('play')}</button></div>`
      : card(x.kind, x.kind === 'playlist' ? getPl(x.id) : x.kind === 'album' ? AL[x.id] : AR[x.id])).join('')}</div>` : emptyState('library', 'Your library is empty', 'Save albums, follow artists or create a playlist.')}</div>`;
}
function hero({ type, title, sub, src, h, round }) {
  setHero(h);
  return `<div class="hero"><div class="hero-art${round ? ' rnd' : ''}">${img(src, '', 232)}</div><div class="hero-text"><span class="type">${type}</span><h1>${esc(title)}</h1><div class="hero-sub">${sub}</div></div></div>`;
}
function vPlaylist(id) {
  const liked = id === 'liked', p = liked ? { id, name: 'Liked Songs', tracks: S.liked } : getPl(id);
  if (!p) return notFound();
  const mine = !liked && !p.seed, ids = p.tracks;
  const src = liked ? svgArt(265, 200, 'grid') : playlistArt(p);
  let h = hero({ type: 'Playlist', title: p.name, src, h: liked ? 265 : hash(p.name) % 360, sub: `<strong>${esc(liked ? S.name : p.seed ? 'JATHUFY' : S.name)}</strong> • ${plural(ids.length, 'song')}${ids.length ? ', ' + totalDur(ids) : ''}` });
  h += `<div class="pad body">${actionBar(ids, mine ? `<button class="icon-btn xl" data-act="pl-menu" data-id="${id}" aria-label="Playlist options" aria-haspopup="menu">${icon('more')}</button>` : '')}`;
  h += ids.length ? trackList(ids, 'pl:' + id) : emptyState('music', liked ? 'Songs you like will appear here' : "Let's find something for your playlist", liked ? 'Save songs by tapping the heart icon.' : 'Add songs using the suggestions below.');
  if (mine) {
    const sug = D.tracks.filter(t => !ids.includes(t.id));
    if (sug.length) h += `<section class="shelf"><h2 class="sec">Recommended songs</h2><div class="tracks compact">${sug.map(t => `<div class="row sug" data-track="${t.id}"><div class="r-main">${img(trackArt(t), 'r-art', 40)}<div class="r-text"><div class="r-title">${esc(t.title)}</div><div class="r-artist">${esc(AR[t.artist].name)}</div></div></div><div class="r-album">${esc(AL[t.album].title)}</div><button class="pill sm" data-act="add-to-pl" data-pl="${id}" data-id="${t.id}">Add</button></div>`).join('')}</div></section>`;
  }
  return h + '</div>';
}
function vAlbum(id) {
  const a = AL[id]; if (!a) return notFound();
  const ids = idsFor('album', id), saved = S.savedAlbums.includes(id);
  let h = hero({ type: 'Album', title: a.title, src: albumArt(a), h: a.hue, sub: `<strong><a href="#/artist/${a.artist}">${esc(AR[a.artist].name)}</a></strong> • ${a.year} • ${plural(ids.length, 'song')}, ${totalDur(ids)}` });
  h += `<div class="pad body">${actionBar(ids, `<button class="icon-btn xl${saved ? ' on' : ''}" data-act="save-album" data-id="${id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from Your Library' : 'Save to Your Library'}">${icon(saved ? 'check' : 'plus', 'ring')}</button>`)}${trackList(ids, 'album')}`;
  const more = D.albums.filter(x => x.artist === a.artist && x.id !== id);
  if (more.length) h += shelf(`More by ${esc(AR[a.artist].name)}`, more.map(x => card('album', x)).join(''));
  return h + `<p class="copy">© ${a.year} ${esc(AR[a.artist].name)}</p></div>`;
}
function vArtist(id) {
  const a = AR[id]; if (!a) return notFound();
  const ids = idsFor('artist', id), f = S.followed.includes(id);
  let h = hero({ type: 'Verified artist', title: a.name, src: artistArt(a), h: a.hue, round: true, sub: `${plural(ids.length, 'popular song')} • ${S.followed.includes(id) ? 'Following' : 'Not following'}` });
  h += `<div class="pad body">${actionBar(ids, `<button class="pill outline" data-act="follow" data-id="${id}" aria-pressed="${f}">${f ? 'Following' : 'Follow'}</button>`)}<h2 class="sec">Popular</h2>${trackList(ids, 'artist')}`;
  h += shelf('Discography', D.albums.filter(x => x.artist === id).map(x => card('album', x)).join(''));
  h += `<section class="shelf"><h2 class="sec">About</h2><div class="about" style="--h:${a.hue}"><p>${esc(a.bio)}</p></div></section>`;
  return h + '</div>';
}
function vRecent() {
  setHero(215);
  const ids = S.recent.slice();
  return `<div class="pad"><div class="shelf-head"><h1 class="greet sm">Recently played</h1>${ids.length ? '<button class="pill outline" data-act="clear-history">Clear history</button>' : ''}</div>${ids.length ? trackList(ids, 'recent') : emptyState('clock', 'Nothing played yet', 'Songs you play will show up here.', '<a class="pill" href="#/home">Browse music</a>')}</div>`;
}
function vQueue() {
  setHero(265);
  const t = cur();
  if (!t) return `<div class="pad"><h1 class="greet sm">Queue</h1>${emptyState('queue', 'Your queue is empty', 'Play a song or add one with “Add to queue”.', '<a class="pill" href="#/home">Find something to play</a>')}</div>`;
  const upIds = S.queue.slice(S.qi + 1);
  ctxIds = S.queue.slice();
  let h = `<div class="pad"><h1 class="greet sm">Queue</h1><h2 class="sec">Now playing</h2><div class="tracks compact">${row(t, 0, { ctx: 'queue', q: S.qi, hideNum: false })}</div>`;
  h += `<div class="shelf-head"><h2 class="sec">Next in queue</h2>${upIds.length ? '<button class="pill outline" data-act="queue-clear">Clear queue</button>' : ''}</div>`;
  h += upIds.length ? `<div class="tracks compact">${upIds.map((id, i) => row(TR[id], i, { ctx: 'queue', q: S.qi + 1 + i, remove: true })).join('')}</div>` : '<p class="muted">Nothing queued after this song. Use “Add to queue” on any track.</p>';
  return h + '</div>';
}
function vProfile() {
  setHero(150);
  const counts = {}; S.recent.forEach(id => counts[TR[id].artist] = (counts[TR[id].artist] || 0) + 1);
  const topA = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  let h = hero({ type: 'Profile', title: S.name, h: 150, round: true, src: svgArt(150, 190, 'rings'), sub: `${plural(S.playlists.length, 'public playlist')} • ${plural(S.followed.length, 'following')}` });
  h += `<div class="pad body"><div class="actions"><button class="pill" data-act="edit-name">${icon('edit')} Edit name</button></div>
    <div class="stats"><div><b>${S.plays}</b><span>Plays</span></div><div><b>${S.liked.length}</b><span>Liked songs</span></div><div><b>${S.recent.length}</b><span>Tracks in history</span></div><div><b>${topA ? esc(AR[topA].name) : '—'}</b><span>Top artist</span></div></div>`;
  h += S.playlists.length ? shelf('Public playlists', S.playlists.map(p => card('playlist', p)).join('')) : '';
  h += `<section class="shelf"><h2 class="sec">Settings</h2><div class="settings"><div><b>Listening history</b><span>Clear your recently played list.</span></div><button class="pill outline" data-act="clear-history">Clear</button></div>
    <div class="settings"><div><b>Reset JATHUFY</b><span>Remove playlists, likes and preferences stored in this browser.</span></div><button class="pill danger" data-act="reset-all">Reset</button></div></section></div>`;
  return h;
}
const notFound = () => { setHero(null); return `<div class="pad">${emptyState('search', "Couldn't find that page", 'It may have been deleted.', '<a class="pill" href="#/home">Home</a>')}</div>`; };

/* ---------- Tamil chart previews (public catalogue metadata + licensed 30s preview URLs) ---------- */
let tamilTrackIds = [];
const tamilArtists = /anirudh|a\. ?r\. ?rahman|ar rahman|santhosh narayanan|sid sriram|dhee|sai abh|yuvan|g\. ?v\. ?prakash|hiphop tamizha|harris jayaraj|pradeep kumar|vijay antony|sean roldan|srinivas|jonita gandhi|shweta mohan|benny dayal|aathi/i;
function addTamilPreview(item, index) {
  if (!item.previewUrl || !item.trackName || !item.artistName) return null;
  const aid = 'tm_artist_' + hash(item.artistName).toString(36);
  if (!AR[aid]) { const hue = hash(item.artistName) % 360; AR[aid] = { id: aid, name: item.artistName, hue, hue2: (hue + 62) % 360, shape: 'rings', bio: 'Tamil music artist' }; D.artists.push(AR[aid]); }
  const albumTitle = item.collectionName || 'Tamil Singles';
  const alid = 'tm_album_' + hash(albumTitle + item.artistName).toString(36);
  if (!AL[alid]) { const hue = hash(albumTitle) % 360; AL[alid] = { id: alid, title: albumTitle, artist: aid, year: item.releaseDate ? Number(item.releaseDate.slice(0,4)) : new Date().getFullYear(), hue, hue2: (hue + 45) % 360, shape: 'sun' }; D.albums.push(AL[alid]); }
  const id = 'tm_song_' + String(item.trackId || index);
  if (!TR[id]) { const track = { id, title: item.trackName, artist: aid, album: alid, dur: Math.round((item.trackTimeMillis || 30000) / 1000), genres: ['Tamil'], previewUrl: item.previewUrl, artworkUrl: item.artworkUrl100 || '' }; TR[id] = track; D.tracks.push(track); }
  return id;
}
async function loadTamilChart() {
  try {
    const chartUrl = 'https://rss.applemarketingtools.com/api/v2/in/songs/100/most-played.json';
    const response = await fetch(chartUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Chart unavailable');
    const chart = await response.json();
    const results = chart.feed?.results || [];
    const likelyTamil = results.filter(x => (x.genres || []).some(g => /tamil/i.test(g.name || '')) || tamilArtists.test(x.artistName || ''));
    let songs = [];
    const candidates = likelyTamil.length ? likelyTamil : results.filter(x => tamilArtists.test(x.artistName || '')).slice(0, 25);
    if (candidates.length) {
      const ids = candidates.map(x => String(x.id || '').split('/').pop()).filter(x => /^\d+$/.test(x));
      const lookup = await fetch('https://itunes.apple.com/lookup?id=' + ids.join(',') + '&entity=song&country=IN');
      if (lookup.ok) { const data = await lookup.json(); songs = (data.results || []).filter(x => x.wrapperType === 'track' && x.kind === 'song' && x.previewUrl); }
    }
    if (!songs.length) {
      const fallback = await fetch('https://itunes.apple.com/search?term=tamil+hits+2025+2026&entity=song&limit=50&country=IN');
      if (fallback.ok) { const data = await fallback.json(); songs = (data.results || []).filter(x => x.previewUrl && (tamilArtists.test(x.artistName || '') || /tamil/i.test(x.primaryGenreName || ''))); }
    }
    if (!songs.length) throw new Error('No playable Tamil previews returned');
    tamilTrackIds = songs.map(addTamilPreview).filter(Boolean);
    if (!tamilTrackIds.length) throw new Error('No playable previews in chart results');
    if (route().name === 'home') renderView(false);
  } catch (err) {
    console.warn('JATHUFY Tamil previews:', err);
    const el = $('#tamil-loading');
    if (el) el.textContent = 'Tamil chart previews are temporarily unavailable. Please try again when online.';
  }
}

/* ---------- router ---------- */
function route() {
  const [, name = 'home', arg] = (location.hash || '#/home').match(/^#\/([^/]*)\/?(.*)$/) || [];
  return { name: name || 'home', arg: decodeURIComponent(arg || '') };
}
const views = { home: vHome, search: r => vSearch(r.arg), library: vLibrary, playlist: r => vPlaylist(r.arg), album: r => vAlbum(r.arg), artist: r => vArtist(r.arg), recent: vRecent, liked: () => vPlaylist('liked'), queue: vQueue, profile: vProfile };
const titles = { home: 'Home', search: 'Search', library: 'Your Library', recent: 'Recently played', liked: 'Liked Songs', queue: 'Queue', profile: S.name };
function renderView(resetScroll = true) {
  const r = route(), fn = views[r.name] || (() => notFound());
  const main = $('#main'), y = main.scrollTop;
  $('#view').innerHTML = fn(r);
  $('#searchbox').classList.toggle('show', r.name === 'search');
  const q = $('#q'); if (r.name === 'search' && document.activeElement !== q) q.value = r.arg;
  document.title = (r.name === 'playlist' ? (getPl(r.arg) || {}).name : r.name === 'album' ? (AL[r.arg] || {}).title : r.name === 'artist' ? (AR[r.arg] || {}).name : titles[r.name]) + ' • JATHUFY';
  main.scrollTop = resetScroll ? 0 : y;
  markNav(); markPlaying(); $$('[data-act=goto-queue]').forEach(b => b.classList.toggle('on', r.name === 'queue'));
  if (resetScroll) { $('#topbar').classList.remove('solid'); }
}
function markNav() {
  const r = route();
  $$('[data-route]').forEach(a => { const on = a.dataset.route === r.name || (a.dataset.route === 'library' && ['liked'].includes(r.name)); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  $$('.lib-item').forEach(a => a.classList.toggle('active', a.dataset.lib === `${r.name === 'liked' ? 'playlist' : r.name}:${r.name === 'liked' ? 'liked' : r.arg}`));
}
window.addEventListener('hashchange', () => { closeMenu(); closeSheet(); renderView(true); });
$('#main').addEventListener('scroll', e => $('#topbar').classList.toggle('solid', e.target.scrollTop > 120), { passive: true });

/* search box */
let qT;
$('#q').addEventListener('input', e => {
  clearTimeout(qT); const v = e.target.value;
  qT = setTimeout(() => { history.replaceState(null, '', '#/search' + (v.trim() ? '/' + encodeURIComponent(v.trim()) : '')); renderView(false); }, 160);
});

/* ---------- sheet (mobile now playing) ---------- */
const sheet = $('#sheet');
function openSheet() { if (!cur()) return; sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); document.body.classList.add('noscroll'); }
function closeSheet() { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); document.body.classList.remove('noscroll'); }

/* ---------- events ---------- */
const isTouch = () => matchMedia('(hover: none)').matches;
function playRow(rowEl) {
  const q = rowEl.dataset.q;
  if (q != null && rowEl.dataset.ctx === 'queue') { S.qi = +q; loadCurrent(true); return; }
  if (rowEl.dataset.ctx === 'search') { playList([rowEl.dataset.track], 0); return; }
  const i = ctxIds.indexOf(rowEl.dataset.track); playList(ctxIds, i < 0 ? +rowEl.dataset.i : +rowEl.dataset.i);
}
const shuffled = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function currentPageIds() { const r = route(); return r.name === 'liked' ? S.liked : r.name === 'playlist' ? idsFor('playlist', r.arg) : r.name === 'album' ? idsFor('album', r.arg) : r.name === 'artist' ? idsFor('artist', r.arg) : []; }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    if (!e.target.closest('#menu')) closeMenu();
    const rw = e.target.closest('.row[data-track]');
    if (rw && !rw.classList.contains('head') && !rw.classList.contains('sug') && !e.target.closest('a,button,input')) {
      if (isTouch()) playRow(rw); else { $$('.row.sel').forEach(x => x.classList.remove('sel')); rw.classList.add('sel'); }
    }
    if (e.target.closest('#player .p-left') && matchMedia('(max-width: 767px)').matches && !e.target.closest('button')) { e.preventDefault(); openSheet(); }
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
    case 'play-ids': { const ids = currentPageIds(); playList(ids, 0); break; }
    case 'shuffle-ids': { const ids = currentPageIds(); S.shuffle = true; playList(shuffled(ids), 0); renderPlayer(); break; }
    case 'play-ids-direct': playList([id], 0); break;
    case 'play-card': { const ids = idsFor(el.dataset.kind, id); if (ids.length) playList(ids, 0); else toast('Nothing to play yet'); break; }
    case 'goto-queue': location.hash = route().name === 'queue' ? '#/home' : '#/queue'; break;
    case 'queue-remove': { const i = +el.dataset.q; S.queue.splice(i, 1); if (i < S.qi) S.qi--; if (S.qi >= S.queue.length) S.qi = S.queue.length - 1; save(); renderView(false); break; }
    case 'queue-move': { const i = +el.dataset.q; moveQueue(i, i + +el.dataset.dir); break; }
    case 'queue-clear': S.queue = S.queue.slice(0, S.qi + 1); save(); renderView(false); toast('Queue cleared'); break;
    case 'create-playlist': createPlaylist(); break;
    case 'add-to-pl': toggleInPlaylist(el.dataset.pl, id); break;
    case 'save-album': { const i = S.savedAlbums.indexOf(id); i >= 0 ? S.savedAlbums.splice(i, 1) : S.savedAlbums.unshift(id); save(); toast(i >= 0 ? 'Removed from Your Library' : 'Saved to Your Library'); renderLibrary(); renderView(false); break; }
    case 'follow': { const i = S.followed.indexOf(id); i >= 0 ? S.followed.splice(i, 1) : S.followed.unshift(id); save(); toast(i >= 0 ? 'Unfollowed' : 'Following ' + AR[id].name); renderLibrary(); renderView(false); break; }
    case 'lib-filter': S.libFilter = el.dataset.f; save(); renderLibrary(); if (route().name === 'library') renderView(false); break;
    case 'sort-menu': e.stopPropagation(); openMenu(el, [{ label: 'Recents', check: S.libSort === 'recent', fn: () => { S.libSort = 'recent'; save(); renderLibrary(); route().name === 'library' && renderView(false); } }, { label: 'Alphabetical', check: S.libSort === 'alpha', fn: () => { S.libSort = 'alpha'; save(); renderLibrary(); route().name === 'library' && renderView(false); } }], { alignLeft: true }); break;
    case 'pl-menu': e.stopPropagation(); openMenu(el, [
      { label: 'Rename', icon: 'edit', fn: async () => { const p = S.playlists.find(x => x.id === id), n = await modal({ title: 'Rename playlist', input: p.name }); if (n) { p.name = n; save(); renderLibrary(); renderView(false); } } },
      { label: 'Delete', icon: 'trash', danger: true, fn: async () => { const p = S.playlists.find(x => x.id === id); if (await modal({ title: 'Delete playlist?', text: `"${p.name}" will be removed from Your Library.`, confirm: 'Delete', danger: true })) { S.playlists = S.playlists.filter(x => x.id !== id); save(); renderLibrary(); toast('Playlist deleted'); location.hash = '#/library'; } } }]); break;
    case 'profile-menu': e.stopPropagation(); openMenu(el, [{ label: 'Profile', icon: 'user', fn: () => location.hash = '#/profile' }, { label: 'Recently played', icon: 'clock', fn: () => location.hash = '#/recent' }, { label: 'Liked Songs', icon: 'heart', fn: () => location.hash = '#/liked' }]); break;
    case 'sheet-more': if (cur()) trackMenu(el, cur().id, ''); break;
    case 'close-sheet': closeSheet(); break;
    case 'hist-back': history.back(); break;
    case 'hist-fwd': history.forward(); break;
    case 'clear-history': S.recent = []; save(); renderView(false); toast('History cleared'); break;
    case 'edit-name': { const n = await modal({ title: 'Profile details', input: S.name }); if (n) { S.name = n; save(); $('#avatar-btn').textContent = n[0].toUpperCase(); renderLibrary(); renderView(false); } break; }
    case 'reset-all': if (await modal({ title: 'Reset JATHUFY?', text: 'This clears playlists, likes, history and preferences from this browser.', confirm: 'Reset', danger: true })) { audio.pause(); try { localStorage.removeItem(KEY); } catch { /* ignore */ } S = { ...defaults }; audio.removeAttribute('src'); setVolume(S.volume); renderPlayer(); renderLibrary(); location.hash = '#/home'; renderView(true); toast('JATHUFY was reset'); } break;
  }
});
let queueDrag = null;
document.addEventListener('dragstart', e => {
  const row = e.target.closest('.row[data-q]');
  if (!row || +row.dataset.q <= S.qi) return e.preventDefault();
  queueDrag = +row.dataset.q; row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(queueDrag));
});
document.addEventListener('dragover', e => {
  const row = e.target.closest('.row[data-q]');
  if (queueDrag == null || !row || +row.dataset.q <= S.qi) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  $$('.row.drag-over').forEach(x => x.classList.remove('drag-over')); row.classList.add('drag-over');
});
document.addEventListener('drop', e => {
  const row = e.target.closest('.row[data-q]');
  if (queueDrag == null || !row) return;
  e.preventDefault(); const target = +row.dataset.q;
  const from = queueDrag; queueDrag = null;
  $$('.row.dragging,.row.drag-over').forEach(x => x.classList.remove('dragging','drag-over'));
  moveQueue(from, target);
});
document.addEventListener('dragend', () => { queueDrag = null; $$('.row.dragging,.row.drag-over').forEach(x => x.classList.remove('dragging','drag-over')); });
document.addEventListener('dblclick', e => { const rw = e.target.closest('.row[data-track]'); if (rw && !rw.classList.contains('head') && !rw.classList.contains('sug') && !e.target.closest('a,button,input')) playRow(rw); });
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

/* ---------- init ---------- */
$('#avatar-btn').textContent = (S.name || 'L')[0].toUpperCase();
setVolume(S.volume || 0.7);
S.queue = S.queue.filter(id => TR[id]); if (S.qi >= S.queue.length) S.qi = S.queue.length - 1;
if (S.qi >= 0 && cur() && !cur().external) { audio.src = cur().file; }
renderPlayer(); renderLibrary();
if (!location.hash) history.replaceState(null, '', '#/home');
renderView(true);
loadTamilChart();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {})); }
})();
