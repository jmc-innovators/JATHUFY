# JATHUFY — a Spotify-inspired web player

Dependency-free (HTML + CSS + vanilla JS). Original name, logo, artwork and music — no Spotify code, assets or branding.

## Run locally
```bash
cd jathufy
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```
Any static server works. (Opening `index.html` via `file://` also works for most features, but a server is recommended for audio.)

## Deploy
It is a static site: upload the folder as-is to Netlify, Vercel (static), GitHub Pages, Cloudflare Pages or any S3/CDN bucket. No build step.

## Regenerate the sample audio
`python3 tools/make_audio.py` synthesizes 8 original 30-second WAV tracks into `audio/` (no samples, fully royalty-free).

## Structure
- `index.html` — shell, SVG icon sprite, player, mobile sheet
- `css/styles.css` — design tokens, desktop / tablet (≤1023px) / mobile (≤767px) layouts
- `js/data.js` — catalog (artists, albums, tracks, seed playlists, genres)
- `js/app.js` — state + persistence, hash router, views, audio engine, menus/modals
- `audio/`, `tools/make_audio.py`

## Install and offline use
- HTTPS deployment enables installation as a Progressive Web App (PWA) on supported browsers.
- The service worker caches the app shell and all 8 bundled demo tracks for offline playback after the first successful load.
- On Android Chrome, use the browser menu and choose **Install app** / **Add to Home screen** when offered.

## Features
- Pages: Home, Search (browse genres + live results), Your Library, Playlist, Album, Artist, Recently played, Liked Songs, Queue, Profile
- Player: play/pause, next/previous (restart if >3s in), seek, volume + mute, shuffle, repeat (off/all/one), queue, artwork, progress, keyboard shortcuts (Space, Shift+←/→, M), Media Session (OS media keys)
- Playlists: create, rename, delete, add/remove tracks (from track menus or recommendations)
- Like/unlike songs, save albums, follow artists, play next / add to queue, remove from queue / clear queue
- Library filter + sort; profile name editing, clear history, reset
- Persistence in `localStorage`: likes, playlists, saved albums, follows, history, volume, shuffle/repeat, queue position, name
- Responsive: full sidebar → icon rail (tablet) → bottom tab bar + mini player + full-screen Now Playing sheet (mobile)
- Accessible: labelled buttons, `aria-pressed`, focus rings, keyboard-navigable rows and menus, reduced-motion support

## Limitations
- **Reference inspection was not completed.** REA could not open open.spotify.com in this environment (its browser launch failed and the sandbox has no route to the site), so the visual design follows the publicly known layout and my own judgment — no side-by-side screenshot comparison with the live site was done. Colors, sizes and spacing are approximations.
- No real Spotify catalog, accounts, DRM or streaming; the catalog is 8 tracks / 4 artists / 4 albums, each track 30 seconds.
- Artwork is generated SVG; fonts are a system stack (Spotify's typeface is proprietary).
- Data lives in one browser's localStorage (no sync, no real login). No real Spotify catalog, accounts, DRM or streaming; the catalog remains 8 original sample tracks / 4 artists / 4 albums. Offline caching requires the first load to complete while online and a secure HTTPS origin (or localhost).
- Tested in headless Chromium only (29 scripted interaction checks passed); not tested on Safari/Firefox or real touch devices.

## Real song catalogue
The JATHUFY Global Hits playlist contains 110 real song metadata entries. Selecting a catalogue song opens its Spotify search/listening page. These are not locally bundled audio files; copyrighted recordings remain hosted by their rights holders. The eight original demo tracks remain playable in the built-in player.


## Tamil preview catalogue

On the Home page, JATHUFY attempts to load the current India Top Songs feed, filters for Tamil genres and known Tamil performers, and resolves official 30-second promotional preview clips through the public iTunes Search API. If chart matching returns no playable Tamil previews, it falls back to a Tamil music catalogue search. The preview audio plays in JATHUFY's own player UI; no third-party player or brand is embedded. Availability depends on the catalogue API, territory, track rights and network access. These are short previews, not full-track streaming, and they are not bundled in the ZIP.
