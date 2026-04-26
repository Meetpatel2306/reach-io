# BeatStream — Complete Feature Inventory

A 100% frontend Next.js 16 PWA. No backend, no `.env`, all data in
localStorage + IndexedDB. Music streamed directly from JioSaavn (saavn.dev)
with YouTube Music as a catalog filler.

---

## Table of contents

- [Foundation](#foundation)
- [Wave 0 — Initial build](#wave-0--initial-build)
- [Wave 1 — Recommendations + UX core](#wave-1--recommendations--ux-core)
- [Wave 2 — Library & smart features](#wave-2--library--smart-features)
- [Wave 3 — Audio depth & polish](#wave-3--audio-depth--polish)
- [Wave 4 — Engagement & social](#wave-4--engagement--social)
- [Audio chain reference](#audio-chain-reference)
- [Caching & prefetch reference](#caching--prefetch-reference)
- [Known limitations](#known-limitations)

---

## Foundation

| Area | Detail |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind v4 + custom CSS design tokens |
| Icons | lucide-react |
| Storage | localStorage for metadata, IndexedDB (idb-keyval) for audio blobs |
| Music API | saavn.dev primary + 2 mirror fallbacks; YouTube Music fallback for catalog gaps |
| Lyrics | LRCLIB (synced + plain) with JioSaavn fallback |
| Theme | Dark / Light / AMOLED + 9 accent colors |
| PWA | manual SW (v16), iOS install banner, persistent storage, safe-area handling |

---

## Wave 0 — Initial build

### Pages
- **Home** (`/`)
- **Search** (`/search`) — songs, albums, artists, playlists tabs
- **Library** (`/library`) — Liked, saved albums, followed artists, downloads
- **Settings** (`/settings`) — quality, theme, EQ, blocked content
- **Album / Artist / Playlist / User playlist** (dynamic)
- **Queue** (`/queue`)
- **History** (`/history`) — stats dashboard
- **Wrapped** (`/wrapped`) — story-style year-in-review
- **Car Mode** — extra-large player UI

### Player
- HTML5 Audio + Web Audio Equalizer chain (5-band BiquadFilter)
- Mini player with swipe gestures (←→ skip, ↑ expand)
- Full-screen player with album-art glow tinted by dominant color
- Lock-screen controls via Media Session API
- iOS silent-MP3 keep-alive loop so iOS doesn't kill the audio session on pause
- Sleep timer (5/10/15/30/45/60/120 min + end-of-song) with countdown chip
- Quality picker (12k → 320k)
- Vinyl rotation (toggle)
- Negative-time format (Spotify style)

### Search
- Smart search fanout: 3 query variants + global topQuery + YouTube fallback
- Multi-signal ranking (artist match, album match, playCount, duration sanity, junk-filter)
- Voice search via Web Speech API
- Recent + trending + browse-all tiles when empty

### Library
- Liked songs / Saved albums / Followed artists / Downloads
- 4 view modes (grid/list)
- 5 sort options
- Create / delete / rename user playlists
- Drag-reorder songs within playlists

### Settings
- Profile (display name, avatar)
- Playback (quality, download quality, crossfade, gapless, normalize, autoplay)
- Equalizer (15 presets + custom 5-band)
- Sound Enhancement (bass enhancer, stereo widener, compressor, loudness, limiter, 5 presets)
- Display (theme, accent, animations, vinyl, compact, explicit)
- Data & Storage (cache stats, clear/factory reset)
- Blocked content management
- Keyboard shortcuts modal
- API mirror picker

### PWA / Offline
- Service Worker (cache-first static, network-first nav, image cache forever, API stale-while-revalidate)
- IndexedDB audio download for offline playback
- Install prompt for iOS
- Persistent storage request on load

---

## Wave 1 — Recommendations + UX core

### Recommendation engine ([lib/recommend.ts](src/lib/recommend.ts))
Pure-frontend, computed from `counts` + `history` + `songCache`:
- `getClusters(6)` — taste clusters keyed by `primaryArtist + language` → become **Daily Mix 1–6**
- `getOnRepeat()` — songs replayed 3+ times in last 30 days
- `getRepeatRewind()` — songs heavily played 60+ days ago, dormant in last 30
- `getTimeCapsule()` — same week of year in any prior year
- `smartShuffle()` — weighted shuffle avoiding recent-5 + favouring liked
- `getBecauseYouPlayed()` — surfaces a recent song for the explainer card
- `getStreak()` — consecutive days with at least one play
- `getWeeklyRecap()` — last-7-day aggregate stats

### Top Charts ([lib/charts.ts](src/lib/charts.ts))
12 curated charts cached for 6 hours:
- Global Top 50, India Top 50, Hindi/Punjabi/Tamil/Telugu/English Top 50
- Trending India, Viral 50, New Music Friday, K-Pop Top, EDM Top
- Browse via `/charts`, individual chart at `/charts/[id]`

### Decade browsing ([lib/charts.ts](src/lib/charts.ts))
- 60s, 70s, 80s, 90s, 2000s, 2010s, 2020s
- Browse via `/decades`, individual decade at `/decades/[id]`

### Player additions
- **Smart Shuffle** — double-click shuffle icon (sparkle ✨ when active)
- **Playback speed** — 0.5x / 0.75x / 1x / 1.25x / 1.5x / 1.75x / 2x
- **Live audio visualizer** — 32-band FFT bars in accent color (toggle)
- **A-B loop infrastructure** — `setLoop(start, end)` with auto-snap-back
- **Auto-skip prediction** — `skipStats.shouldAutoSkip(id)` blocks songs with ≥70% skip ratio (3+ plays)

### UX
- **Hero with greeting + 🔥 streak chip**
- **Story image share** — generates 1080×1920 PNG with album art + dominant color gradient
- **Pull-to-refresh** infrastructure (`usePullToRefresh` hook)
- **Artist Radio** — one-tap "Start Radio" button on artist page
- **Because you played X** — recommendation explainer card on home
- **Top charts strip** + **decade tiles** on home

---

## Wave 2 — Library & smart features

### Smart Playlists ([lib/smartPlaylistEval.ts](src/lib/smartPlaylistEval.ts) + [components/SmartPlaylistEditor.tsx](src/components/SmartPlaylistEditor.tsx))
Rule-based, auto-updating playlists:
- **Fields:** language, artist, year, plays, liked, duration, rating, tag
- **Operators:** is, isNot, contains, gt, gte, lt, lte
- **Combine:** AND / OR
- **Live preview** — shows match count as you build
- Example: "language is hindi AND year >= 2020 AND rating >= 4 AND plays > 5"

### Local file import ([lib/localFiles.ts](src/lib/localFiles.ts))
- Drag-and-drop or file picker for MP3 / FLAC / M4A / OGG / WAV / AAC
- Audio bytes → IndexedDB (offline-permanent)
- Auto-parses filenames as `Artist - Title`
- Auto-extracts duration via metadata-only audio load
- Shows up in Library as a normal song with `local_<id>`

### Lyric search ([lib/lyricSearch.ts](src/lib/lyricSearch.ts))
- New **Lyrics tab** in Search
- Type any lyric snippet → searches LRCLIB's lyric database
- Returns track + artist + matching snippet
- Tap match to search that song

### Karaoke synced lyrics
- Three-line synced view (previous dim, current bright, next dim) in compact lyrics card
- Tap any line to seek to that timestamp
- Uses LRCLIB's `syncedLyrics` field with binary-search active-line detection

### Star ratings + Tags ([components/StarRating.tsx](src/components/StarRating.tsx) + [components/TagEditor.tsx](src/components/TagEditor.tsx))
- 1–5 star rating per song (in song menu)
- Free-form tags per song with autocomplete from your existing vocabulary
- Both feed into Smart Playlist rules

### Hidden songs (soft block)
- "Hide from mixes" in song menu
- Won't appear in autoplay / radio / smart playlists
- Still plays if you explicitly tap them
- Manage / unhide list in Settings → Hidden Songs

### Library overhaul
- New sort: **Duration**, **Year** (in addition to Recently Added / Alphabetical / Most Played)
- Smart playlists strip with edit/delete
- Local files section
- Drop-zone overlay when dragging audio files onto window
- Import URL modal (Spotify or BeatStream share links)

### Library backup / restore
- Export entire library (settings, playlists, ratings, tags, history, downloads metadata) to JSON
- Restore from JSON file with one click
- Settings → Data & Storage → Backup library

### Library autoload from share URL
- `?import=BASE64_PAYLOAD` on `/library` auto-imports the encoded playlist

---

## Wave 3 — Audio depth & polish

### Sound Enhancement DSP chain ([lib/equalizer.ts](src/lib/equalizer.ts))
Processing chain after the 5-band EQ:
```
EQ → Bass Enhancer (peaking 80Hz) → Stereo Widener (M/S) →
Compressor → Loudness Gain → Brick-wall Limiter → output
```
- **Bass Enhancer** 0–10 dB at 80Hz with high Q for punch
- **Stereo Widener** 0–100% (50% neutral) via Mid/Side processing
- **Compressor** 0–10 (off → ~7:1 ratio)
- **Loudness** 0–12 dB flat gain
- **Brick-wall Limiter** at -1dBFS for safety
- **Quick presets:** Off / Headphones / Phone Speaker / Studio / Bass Head

### A-B loop infrastructure ([PlayerContext.tsx](src/contexts/PlayerContext.tsx))
- `setLoop(startSec, endSec)` — when audio crosses end, automatically snaps to start
- UI button surface pending (infrastructure ready)

### Audio FX — Mono / Balance ([lib/audioFx.ts](src/lib/audioFx.ts))
- Mono mix toggle (collapses stereo for one-earbud listening)
- L/R balance via channel-splitter / merger graph
- Both apply within the existing AudioContext (no second context)

### EQ profile slots ([lib/storage.ts](src/lib/storage.ts) `eqProfiles`)
- Save current EQ as named profile (Headphones / Car / etc.)
- Storage layer ready, picker UI pending

### Real-time output meter ([components/OutputMeter.tsx](src/components/OutputMeter.tsx))
- Vertical RMS + peak-hold bar showing actual signal output level
- Hooks into the EQ chain's outputGain via fresh AnalyserNode
- Color zones: green → yellow (0.7) → red (0.95)
- Solves "is audio actually playing or is it muted by system?"

### Volume UX clarity
- App volume slider is now visible on **all screen sizes** (was desktop-only)
- Output meter beside the slider
- Inline help text explaining hardware vs app volume distinction
- 2-way `volumechange` sync (catches Bluetooth headset volume buttons)
- Persistent volume + mute across sessions

### Playback fixes
- Truncation detection — if `audio.duration` < expected by 20s, refetch fresh URL & retry
- Watchdog — every 4s, if `currentTime` hasn't moved in 8s while playing, refresh URL & resume from same spot
- Error handler — reload on `error` event with position preservation
- Stalled handler — nudge AudioContext + retry play

### QR code generation ([lib/qrcode.ts](src/lib/qrcode.ts) + [components/QRModal.tsx](src/components/QRModal.tsx))
- Zero-dependency QR encoder (versions 1–10, byte mode, EC level L)
- SVG output → copy URL or download SVG
- Available on every song via the 3-dot menu

### Playlist folders ([lib/storage.ts](src/lib/storage.ts) `playlistFolders`)
- `playlistFolders.create / addPlaylist / removePlaylist`
- Storage ready, sidebar grouping UI pending

### Custom seekbar ([components/Seekbar.tsx](src/components/Seekbar.tsx))
- Spotify-style 3-layer bar: rail / buffered (lighter) / played (accent)
- Thumb fades in on hover
- Bar thickens 4 → 6 px on hover
- Click anywhere or drag

---

## Wave 4 — Engagement & social

### Achievements ([lib/achievements.ts](src/lib/achievements.ts) + [components/AchievementsCard.tsx](src/components/AchievementsCard.tsx))
15 unlockable badges, checked after every play, toasted when unlocked:
- 🎵 First Play, 🎶 Ten Songs, 💯 Century, 🌟 Music Lover (1k plays)
- ❤️ Heart On, 💝 Curator (50 likes)
- ⏰ First Hour, 🕙 Ten Hours, 🏆 Audiophile (100 hours)
- 🗺️ Explorer (10 artists), 🔭 Discoverer (50 artists)
- 🤝 Fan Club (5 follows), 📚 Album Collector (10 saves)
- 🦉 Night Owl (1–5am play), 🌅 Early Bird (before 7am)
- Unlocked grid on home page

### Daily listening goal ([components/GoalRing.tsx](src/components/GoalRing.tsx))
- Animated SVG progress ring on home
- Configurable target in Settings → Daily Goal (5–240 min slider)
- Shows current minutes vs goal + remaining

### Listening streak
- Consecutive days with ≥1 play counted from today
- 🔥 chip in home hero greeting

### Weekly recap card
- Plays + unique artists from the last 7 days, on home

### Shareable playlist URLs ([lib/sharePlaylist.ts](src/lib/sharePlaylist.ts))
- `buildShareUrl(playlist)` → URL with full playlist (name + song ids + names + artists) base64-encoded in query
- Receiving client auto-imports via `/library?import=...`
- Truly P2P, no backend needed

### Spotify import ([lib/importSpotify.ts](src/lib/importSpotify.ts))
- Paste any public Spotify playlist URL
- Scrapes the public embed page (no auth)
- For each track: smart-search on Saavn/YT and add the best match
- Reports `matched / total` after import

### Volume two-way sync
- Catches Bluetooth headset volume button presses (when they update audio.volume)
- Mirrors back into UI slider in real time
- App slider value persists across reloads

---

## Audio chain reference

Full processing path from CDN to speakers:

```
JioSaavn CDN → HTML5 <audio> element
  └── MediaElementAudioSource (Web Audio)
        ├── 5-band EQ (60 / 230 / 910 / 3.6k / 14k Hz, ±12dB)
        ├── Bass Enhancer (peaking 80Hz, Q=1.4)
        ├── Stereo Widener (Mid/Side processing, 0-200%)
        ├── Dynamic Compressor (threshold scales with intensity)
        ├── Loudness Gain (+0 to +12 dB)
        ├── Brick-wall Limiter (-1 dBFS)
        ├── (optional) Audio FX — Mono / Balance
        ├── Output Gain (master, used for normalize)
        └── AudioContext.destination → OS → speakers

In parallel from outputGain:
  ├── Visualizer AnalyserNode (FFT for bars)
  └── OutputMeter AnalyserNode (RMS + peak for level)

Hidden 2nd <audio> element (preloadRef):
  └── Pre-buffers next track's bytes (gapless transition)
```

---

## Caching & prefetch reference

### Persistent cache ([lib/cache.ts](src/lib/cache.ts))
- `useCached(key, ttl, fetcher)` — instant from localStorage, refreshes in background
- TTLs: songs 7d, albums 30d, artists 30d, playlists 1d, search 1d, trending 6h, lyrics 30d
- Pages affected: Home, Search, Album, Artist, Playlist, Library, Lyrics

### Prefetch ([lib/prefetch.ts](src/lib/prefetch.ts))
- On card hover/touch → prefetch detail page
- On card scroll-into-view → prefetch image
- On song play → prefetch metadata + image + first 1.5MB audio chunk for **next 6** queue items
- On song play → fully buffer next 1 song into hidden audio element (gapless)

### Service Worker ([public/sw.js](public/sw.js))
- Cache name: `beatstream-v16`
- Static assets: cache-first
- Navigation: network-first, fall back to cached `/`
- JioSaavn API: stale-while-revalidate, 1h
- Saavn images: cache-first forever
- Audio: never cached by SW (handled by IndexedDB explicitly)

---

## Known limitations

| Limitation | Reason |
|---|---|
| Slider can't read system/device volume | Browser security — no JS API exposes it. Output meter visualizes actual loudness instead. |
| Can't change system volume from JS | Same. Use device hardware buttons for system volume. |
| 320 kbps AAC is the audio ceiling | JioSaavn caps there. Spotify/Apple/Tidal lossless require auth + paid tiers. Sound Enhancement chain compensates with DSP. |
| Some songs may show as 1-2 min preview | JioSaavn rotates URLs; old ones go stale. Truncation detection auto-refetches and replays. |
| No real podcast / radio support yet | Endpoint hooks exist (saavn.dev has /podcasts), UI surface not built |
| AirPlay / Chromecast | Not exposed to PWAs by browsers; OS handles via system media controls |
| Spotify playlist import limited | Scrapes embed page; works for public playlists only, may break if Spotify changes embed markup |

---

## Routes (16 total)

| Path | Render | Purpose |
|---|---|---|
| `/` | Static | Home with all recommendation sections |
| `/search` | Static | Multi-source search + lyric search |
| `/library` | Static | Library + smart playlists + local files + import |
| `/settings` | Static | All preferences + backup/restore |
| `/queue` | Static | Drag-reorder queue, save as playlist |
| `/history` | Static | Play history + stats dashboard |
| `/wrapped` | Static | Story-style year-in-review |
| `/charts` | Static | Top Charts browser |
| `/charts/[id]` | Dynamic | Individual chart |
| `/decades` | Static | Decade browser |
| `/decades/[id]` | Dynamic | Decade hits |
| `/album/[id]` | Dynamic | Album with hero + tracklist |
| `/artist/[id]` | Dynamic | Artist hero + popular + albums + similar + Start Radio |
| `/playlist/[id]` | Dynamic | JioSaavn playlist |
| `/playlist/user/[id]` | Dynamic | User-created playlist |

---

## Tech stack

```
Next.js 16.2.4   (App Router, Turbopack)
React 19.2.4
TypeScript 5.9 (strict)
Tailwind CSS v4
lucide-react 1.11
idb-keyval 6.2

External APIs (free, no auth):
  • saavn.dev (primary)
  • saavn-api-eight.vercel.app (mirror)
  • saavn.me (mirror)
  • lrclib.net (lyrics)
  • YouTube Music public search (catalog filler)
```

---

_Last updated: 2026-04-26 · Service Worker version: v16_
