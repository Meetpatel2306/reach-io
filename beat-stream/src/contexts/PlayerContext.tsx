"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Song, Quality } from "@/lib/types";
import { api } from "@/lib/api";
import { pickDownloadUrl, pickImage, artistsName } from "@/lib/utils";
import { history, recent, counts, songCache, store, STORAGE_KEYS, blockedSongs, blockedArtists, listenTime, skipStats, hidden as hiddenStore } from "@/lib/storage";
import { checkAchievements } from "@/lib/achievements";
import { audioCache } from "@/lib/audioCache";
import { Equalizer } from "@/lib/equalizer";
import { prefetch } from "@/lib/prefetch";
import { cached, TTL } from "@/lib/cache";
import { buildRelatedQueue } from "@/lib/related";
import { smartShuffle } from "@/lib/recommend";
import { hydrateYtSong, ytSearchSongs, resolveYtStreamUrl } from "@/lib/youtubeMusic";
import { resolveItunesStream } from "@/lib/itunes";
import { useSettings } from "./SettingsContext";

type Repeat = "off" | "all" | "one";

interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  queueSource: string;
  isPlaying: boolean;
  volume: number;
  progress: number;
  currentTime: number;
  duration: number;
  buffered: number;
  shuffle: boolean;
  smartShuffle: boolean;
  repeat: Repeat;
  playbackRate: number;
  loopStart: number | null;
  loopEnd: number | null;
  isBuffering: boolean;
  isMuted: boolean;
  expanded: boolean;
  showQueue: boolean;
  showLyrics: boolean;
  showCarMode: boolean;
}

interface Ctx extends PlayerState {
  playSong: (song: Song) => Promise<void>;
  playList: (songs: Song[], startIndex?: number, source?: string) => Promise<void>;
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (percent: number) => void;
  seekTo: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleSmartShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackRate: (r: number) => void;
  setLoop: (start: number | null, end: number | null) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (from: number, to: number) => void;
  setExpanded: (v: boolean) => void;
  setShowQueue: (v: boolean) => void;
  setShowLyrics: (v: boolean) => void;
  setShowCarMode: (v: boolean) => void;
  sleepTimer: number | null;
  sleepEndsAt: number | null;
  setSleepTimer: (mins: number | null, endOfSong?: boolean) => void;
}

const PlayerCtx = createContext<Ctx | null>(null);

// 1-sec silent MP3 (base64) used to keep iOS media session alive
const SILENT_MP3 = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/80DEKwAAA0gAAAAAVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/80DEVgAAA0gAAAAAVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Second audio element for the *next* song. We start downloading it as soon
  // as the current song begins, so by the time the current track ends the
  // next one is already buffered → near-zero gap.
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const preloadedSongIdRef = useRef<string | null>(null);
  const silentRef = useRef<HTMLAudioElement | null>(null);
  const eqRef = useRef<Equalizer>(new Equalizer());
  const lastBlobUrlRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(0);
  const sleepTimeoutRef = useRef<number | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const endOfSongRef = useRef(false);
  // Track whether we've already retried this song with a fresh URL, so we
  // don't loop forever if the actual audio file really is short.
  const retriedRef = useRef<Set<string>>(new Set());
  // Watchdog state: detect "stuck" playback where audio never advances
  const lastProgressRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const watchdogRef = useRef<number | null>(null);

  // Hydrate volume/mute from localStorage so the in-app slider matches what's
  // actually playing on the very first frame after a reload, and so user
  // changes carry over between sessions.
  const initialVolume = (() => {
    if (typeof window === "undefined") return 1;
    const v = store.read<number | null>(STORAGE_KEYS.volume, null);
    return typeof v === "number" && v >= 0 && v <= 1 ? v : 1;
  })();
  const initialMuted = (() => {
    if (typeof window === "undefined") return false;
    return store.read<boolean>(STORAGE_KEYS.muted, false);
  })();

  const [state, setState] = useState<PlayerState>({
    currentSong: null, queue: [], queueIndex: -1, queueSource: "",
    isPlaying: false, volume: initialVolume, progress: 0, currentTime: 0, duration: 0, buffered: 0,
    shuffle: false, smartShuffle: false, repeat: "off",
    isBuffering: false, isMuted: initialMuted,
    expanded: false, showQueue: false, showLyrics: false, showCarMode: false,
    playbackRate: 1, loopStart: null, loopEnd: null,
  });
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  // Mirror of state for use inside long-lived event handlers (the audio
  // element listeners are attached once on mount; reading `state` from their
  // closures would always see the initial value).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // Init
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = document.createElement("audio");
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.setAttribute("playsinline", "true");
    a.setAttribute("webkit-playsinline", "true");
    audioRef.current = a;
    a.volume = state.volume;
    a.muted = state.isMuted;

    const pre = document.createElement("audio");
    pre.preload = "auto";
    pre.crossOrigin = "anonymous";
    pre.setAttribute("playsinline", "true");
    pre.setAttribute("webkit-playsinline", "true");
    pre.volume = 0; // Silent — we only want the bytes downloaded
    preloadRef.current = pre;

    const sa = document.createElement("audio");
    sa.src = SILENT_MP3;
    sa.loop = true;
    sa.setAttribute("playsinline", "true");
    sa.setAttribute("webkit-playsinline", "true");
    silentRef.current = sa;

    const onVolume = () => {
      // Mirror the audio element's volume back into state so that:
      //   • Bluetooth headset volume buttons update our UI slider
      //   • OS media keys / accessibility tools that adjust audio.volume sync
      //   • Mute toggled from system controls reflects in our mute icon
      // (Hardware volume rocker on phones controls OS media volume, which is
      // applied separately by the OS — that's why the app slider doesn't move
      // for it, but the actual loudness still changes correctly.)
      store.write(STORAGE_KEYS.volume, a.volume);
      store.write(STORAGE_KEYS.muted, a.muted || a.volume === 0);
      setState((s) => ({ ...s, volume: a.volume, isMuted: a.muted || a.volume === 0 }));
    };
    const onTime = () => {
      const cur = a.currentTime;
      const dur = a.duration || 0;
      const buf = a.buffered.length ? a.buffered.end(a.buffered.length - 1) : 0;
      // Watchdog: track last forward progress; if we ever stall for >8s while
      // notionally playing, recover. Reset on every real progress tick.
      if (!a.paused && cur > lastProgressRef.current + 0.05) {
        lastProgressRef.current = cur;
        lastProgressAtRef.current = performance.now();
      }
      // Track listening time
      const now = performance.now();
      if (lastTickRef.current && !a.paused) {
        const elapsed = (now - lastTickRef.current) / 1000;
        if (elapsed < 2) listenTime.add(elapsed);
      }
      lastTickRef.current = now;
      // A-B loop enforcement: if user has set loopStart/loopEnd, snap back
      // to start when we cross end.
      const ls = stateRef.current.loopStart;
      const le = stateRef.current.loopEnd;
      if (ls != null && le != null && cur >= le) {
        try { a.currentTime = ls; } catch {}
      }
      setState((s) => ({ ...s, currentTime: cur, duration: dur, buffered: buf, progress: dur ? (cur / dur) * 100 : 0 }));
      // Update media session position
      if ("mediaSession" in navigator && (navigator as any).mediaSession.setPositionState) {
        try {
          (navigator as any).mediaSession.setPositionState({ duration: dur || 0, playbackRate: 1, position: cur || 0 });
        } catch {}
      }
    };
    const onPlay = () => {
      setState((s) => ({ ...s, isPlaying: true }));
      stopSilent();
      try { eqRef.current.resume(); } catch {}
      // Keep lock-screen / OS media widget icon in sync with actual state.
      try { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing"; } catch {}
    };
    const onPause = () => {
      setState((s) => ({ ...s, isPlaying: false }));
      // Start silent loop on iOS to keep session alive
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) startSilent();
      try { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused"; } catch {}
    };
    const onWaiting = () => setState((s) => ({ ...s, isBuffering: true }));
    const onPlaying = () => setState((s) => ({ ...s, isBuffering: false }));
    const onEnded = () => handleEnded();

    // Recover when the audio element errors (network drop, codec issue, etc.)
    const onError = async () => {
      const err = a.error;
      console.warn("[player] audio error", err?.code, err?.message);
      const cur = stateRef.current.currentSong;
      if (!cur) return;
      // Only auto-recover once per song to avoid infinite loops
      if (retriedRef.current.has(`err:${cur.id}`)) {
        // Already tried — skip to next track
        setState((s) => advanceQueue(s));
        return;
      }
      retriedRef.current.add(`err:${cur.id}`);
      try {
        const fresh = await ensureFullSong(cur, true);
        const url = pickDownloadUrl(fresh, settings.quality);
        if (url) {
          const wasAt = a.currentTime;
          a.src = url;
          a.load();
          // Resume from where we stopped
          a.addEventListener("loadedmetadata", () => {
            try { a.currentTime = Math.min(wasAt, (a.duration || 0) - 1); } catch {}
            a.play().catch(() => {});
          }, { once: true });
        }
      } catch {}
    };
    // `stalled` fires when the network has stopped supplying data even though
    // we still need more. Just nudge the audio context and retry play.
    const onStalled = () => {
      try { eqRef.current.resume(); } catch {}
      if (!a.paused) a.play().catch(() => {});
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("ended", onEnded);
    a.addEventListener("volumechange", onVolume);
    a.addEventListener("error", onError);
    a.addEventListener("stalled", onStalled);

    // Watchdog: every 4s, if the element is "playing" but currentTime hasn't
    // moved forward in 8s, refresh URL and try to resume from where we stopped.
    watchdogRef.current = window.setInterval(async () => {
      if (a.paused || a.ended) return;
      const now = performance.now();
      if (lastProgressAtRef.current && now - lastProgressAtRef.current > 8000) {
        const cur = stateRef.current.currentSong;
        if (!cur || retriedRef.current.has(`stuck:${cur.id}`)) return;
        retriedRef.current.add(`stuck:${cur.id}`);
        const wasAt = a.currentTime;
        try {
          const fresh = await ensureFullSong(cur, true);
          const url = pickDownloadUrl(fresh, settings.quality);
          if (url) {
            a.src = url;
            a.load();
            a.addEventListener("loadedmetadata", () => {
              try { a.currentTime = Math.min(wasAt, (a.duration || 0) - 1); } catch {}
              a.play().catch(() => {});
            }, { once: true });
          }
        } catch {}
        lastProgressAtRef.current = now;
      }
    }, 4000);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("volumechange", onVolume);
      a.removeEventListener("error", onError);
      a.removeEventListener("stalled", onStalled);
      if (watchdogRef.current) window.clearInterval(watchdogRef.current);
      a.pause(); a.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore on mount
  useEffect(() => {
    const last = store.read<Song | null>(STORAGE_KEYS.current, null);
    const queueData = store.read<{ songs: Song[]; currentIndex: number; source?: string }>(STORAGE_KEYS.queue, { songs: [], currentIndex: -1 });
    if (last) setState((s) => ({
      ...s,
      currentSong: last,
      queue: queueData.songs.length ? queueData.songs : [last],
      queueIndex: queueData.currentIndex >= 0 ? queueData.currentIndex : 0,
      queueSource: queueData.source || "",
    }));
  }, []);

  useEffect(() => {
    if (state.currentSong) store.write(STORAGE_KEYS.current, state.currentSong);
    store.write(STORAGE_KEYS.queue, { songs: state.queue, currentIndex: state.queueIndex, source: state.queueSource });
  }, [state.currentSong, state.queue, state.queueIndex, state.queueSource]);

  // Apply EQ + enhancements when settings change
  useEffect(() => {
    if (!eqRef.current.attached) return;
    eqRef.current.setGains(settings.equalizer.gains, settings.equalizer.enabled);
    eqRef.current.setNormalize(settings.normalize);
    eqRef.current.setEnhancement(settings.enhancement);
  }, [settings.equalizer.gains, settings.equalizer.enabled, settings.normalize, settings.enhancement]);

  function startSilent() {
    const sa = silentRef.current;
    if (!sa) return;
    sa.play().catch(() => {});
  }
  function stopSilent() {
    const sa = silentRef.current;
    if (!sa) return;
    sa.pause();
    try { sa.currentTime = 0; } catch {}
  }

  // Preload the next song's audio bytes into the hidden second <audio> element
  // so playback of the next track starts instantly when the current ends.
  async function warmNext(nextSong: Song | undefined) {
    const pre = preloadRef.current;
    if (!pre || !nextSong) return;
    if (preloadedSongIdRef.current === nextSong.id) return;
    try {
      // Get fresh URLs for the next song too (cached, fast on revisit). For
      // YouTube songs, we resolve via Piped instead of api.getSong (which is
      // saavn-only).
      let full = nextSong;
      if (!full.downloadUrl?.length) {
        if (nextSong.source === "youtube" && nextSong.ytId) {
          const YT_TTL = 4 * 60 * 60 * 1000;
          full = await cached(`yt-stream:${nextSong.ytId}`, YT_TTL, () => hydrateYtSong(nextSong)) || nextSong;
        } else {
          const data = await cached(`song:${nextSong.id}`, TTL.song, () => api.getSong(nextSong.id));
          full = (Array.isArray(data) ? data[0] : data) || nextSong;
        }
      }
      const url = pickDownloadUrl(full, settings.quality);
      if (!url) return;
      pre.src = url;
      pre.load(); // Triggers the browser to start fetching
      preloadedSongIdRef.current = nextSong.id;
    } catch {}
  }

  // ALWAYS refetch song details via /api/songs/{id} so we get fresh, non-truncated
  // download URLs. JioSaavn rotates audio CDN URLs and the ones embedded in
  // search results sometimes return preview-length audio. The cache layer makes
  // this fast (7-day TTL, instant from localStorage on repeat plays).
  //
  // YouTube/Piped songs go through a separate path: their googlevideo audio
  // URLs expire (~6h) so we resolve fresh via Piped's /streams endpoint,
  // cached at a short TTL.
  const ensureFullSong = useCallback(async (song: Song, forceRefresh = false): Promise<Song> => {
    // YouTube-sourced song with a known video id → resolve via Piped
    if (song.source === "youtube" && song.ytId) {
      const YT_TTL = 4 * 60 * 60 * 1000;
      try {
        const key = `yt-stream:${song.ytId}`;
        const fetcher = () => hydrateYtSong(song);
        const hydrated = forceRefresh ? await fetcher() : await cached(key, YT_TTL, fetcher);
        if (hydrated.downloadUrl?.length) { songCache.put(hydrated); return hydrated; }
      } catch {}
      return song;
    }
    // iTunes-sourced song (metadata only) → search YouTube for matching audio
    if (song.id?.startsWith("itunes:")) {
      const YT_TTL = 4 * 60 * 60 * 1000;
      try {
        const url = forceRefresh
          ? await resolveItunesStream(song)
          : await cached(`it-stream:${song.id}`, YT_TTL, () => resolveItunesStream(song));
        if (url) {
          const full: Song = { ...song, downloadUrl: [{ quality: "160kbps", url }] };
          songCache.put(full);
          return full;
        }
      } catch {}
      return song;
    }
    try {
      const fetcher = () => api.getSong(song.id);
      if (forceRefresh) {
        const data = await fetcher();
        const full = Array.isArray(data) ? data[0] : data;
        if (full?.downloadUrl?.length) {
          songCache.put(full);
          return full;
        }
      }
      const data = await cached(`song:${song.id}`, TTL.song, fetcher);
      const full = Array.isArray(data) ? data[0] : data;
      if (full?.downloadUrl?.length) {
        songCache.put(full);
        return full;
      }
    } catch {}
    // Fallback: use whatever URLs the original song object carries
    if (song.downloadUrl?.length) return song;
    const cachedSong = songCache.get(song.id);
    if (cachedSong?.downloadUrl?.length) return cachedSong;
    return song;
  }, []);

  const isAllowed = useCallback((song: Song): boolean => {
    if (blockedSongs.list().includes(song.id)) return false;
    if (hiddenStore.list().includes(song.id)) return false;
    if (skipStats.shouldAutoSkip(song.id)) return false;
    const artistIds = (song.artists?.primary || []).map((a) => a.id);
    if (artistIds.some((id) => blockedArtists.list().includes(id))) return false;
    return true;
  }, []);

  const loadAndPlay = useCallback(async (song: Song) => {
    const a = audioRef.current;
    if (!a) return;
    if (!isAllowed(song)) return;

    setState((s) => ({ ...s, isBuffering: true, currentSong: song }));
    // Trim retry-tracking memory periodically
    if (retriedRef.current.size > 50) retriedRef.current.clear();
    // Reset watchdog markers for the new song
    lastProgressRef.current = 0;
    lastProgressAtRef.current = performance.now();
    const full = await ensureFullSong(song);

    // Free prior blob URL
    if (lastBlobUrlRef.current) {
      try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {}
      lastBlobUrlRef.current = null;
    }

    let src: string | null = null;
    try {
      const blob = await audioCache.get(full.id);
      if (blob) {
        src = URL.createObjectURL(blob);
        lastBlobUrlRef.current = src;
      }
    } catch {}

    if (!src) src = pickDownloadUrl(full, settings.quality);
    if (!src) {
      setState((s) => ({ ...s, isBuffering: false }));
      return;
    }

    // If the next-song preloader already has this URL warmed, the browser's
    // HTTP cache will serve it instantly — no fresh round-trip needed.
    a.src = src;
    a.preload = "auto";
    try {
      // Attach EQ + enhancement chain on first user-initiated play
      if (!eqRef.current.attached) {
        eqRef.current.attach(a, settings.equalizer.gains, settings.equalizer.enabled, settings.normalize, settings.enhancement);
      }
      eqRef.current.resume();
      stopSilent();
      // Record skip stat for the *previous* song (if any)
      const prev = stateRef.current.currentSong;
      if (prev && prev.id !== full.id) {
        const dur = a.duration || 0;
        const ratio = dur > 0 ? Math.min(1, a.currentTime / dur) : 1;
        skipStats.recordPlay(prev.id, ratio);
      }
      await a.play();
      history.push(full.id);
      counts.inc(full.id);
      recent.push(full);
      songCache.put(full);
      // Achievement check (toast handled separately in app via window event)
      try {
        const newOnes = checkAchievements();
        if (newOnes.length && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("bs-achievement", { detail: newOnes[0] }));
        }
      } catch {}
      setState((s) => {
        const q = s.queue.slice();
        const idx = q.findIndex((x) => x.id === full.id);
        if (idx >= 0) q[idx] = full;
        const here = idx >= 0 ? idx : s.queueIndex;
        // 1) Fully buffer the very-next track via the hidden audio element (gapless)
        warmNext(q[here + 1]);
        // 2) For the next 6 songs: warm metadata + image + first audio chunk
        //    (≈1.5MB each, enough to start playback instantly when chosen)
        for (let i = 1; i <= 6; i++) {
          const nxt = q[here + i];
          if (!nxt) break;
          prefetch.song(nxt.id);
          prefetch.image(pickImage(nxt.image, "med"));
          prefetch.image(pickImage(nxt.image, "high"));
          if (nxt.album?.id) prefetch.album(nxt.album.id);
          if (nxt.artists?.primary?.[0]?.id) prefetch.artist(nxt.artists.primary[0].id);
          // Skip i=1 (already fully preloaded by warmNext above)
          if (i >= 2) prefetch.songAndAudioStart(nxt.id, settings.quality);
        }
        return { ...s, currentSong: full, queue: q, isBuffering: false };
      });
      updateMediaSession(full);
    } catch {
      setState((s) => ({ ...s, isBuffering: false, isPlaying: false }));
    }
  }, [ensureFullSong, settings.quality, settings.equalizer, settings.normalize, isAllowed]);

  const playSong = useCallback(async (song: Song) => {
    setState((s) => ({ ...s, queue: [song], queueIndex: 0, queueSource: `${song.name} Radio` }));
    await loadAndPlay(song);
    // After a single-song play, build a "song radio" queue from related tracks
    // so the next track is actually similar instead of a random search result.
    buildRelatedQueue(song, 25).then((related) => {
      if (!related.length) return;
      setState((s) => {
        // Only append if the user hasn't replaced the queue with something else
        if (s.queue.length === 1 && s.queue[0]?.id === song.id) {
          return { ...s, queue: [song, ...related] };
        }
        return s;
      });
    }).catch(() => {});
  }, [loadAndPlay]);

  const playList = useCallback(async (songs: Song[], startIndex = 0, source = "") => {
    if (!songs.length) return;
    songCache.putMany(songs);
    setState((s) => ({ ...s, queue: songs, queueIndex: startIndex, queueSource: source }));
    await loadAndPlay(songs[startIndex]);
  }, [loadAndPlay]);

  const addToQueue = useCallback((song: Song) => {
    setState((s) => ({ ...s, queue: [...s.queue, song], queueIndex: s.queueIndex < 0 ? 0 : s.queueIndex }));
  }, []);

  const playNext = useCallback((song: Song) => {
    setState((s) => {
      const q = s.queue.slice();
      q.splice(s.queueIndex + 1, 0, song);
      return { ...s, queue: q };
    });
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      if (a.src) a.play().catch(() => {});
      else if (state.currentSong) loadAndPlay(state.currentSong);
    } else a.pause();
  }, [state.currentSong, loadAndPlay]);

  const next = useCallback(() => {
    setState((s) => {
      if (!s.queue.length) return s;
      let nextIdx: number;
      if (s.repeat === "one") nextIdx = s.queueIndex;
      else if (s.smartShuffle) {
        // Smart Shuffle: avoid recently-played, prefer liked
        const reordered = smartShuffle(s.queue);
        const cur = s.queue[s.queueIndex]?.id;
        nextIdx = reordered.findIndex((x) => x.id !== cur);
        if (nextIdx < 0) nextIdx = 0;
        // Map back to original index
        nextIdx = s.queue.findIndex((x) => x.id === reordered[nextIdx].id);
      }
      else if (s.shuffle) nextIdx = Math.floor(Math.random() * s.queue.length);
      else {
        nextIdx = s.queueIndex + 1;
        if (nextIdx >= s.queue.length) {
          if (s.repeat === "all") nextIdx = 0;
          else return s;
        }
      }
      const song = s.queue[nextIdx];
      if (song) loadAndPlay(song);
      return { ...s, queueIndex: nextIdx };
    });
  }, [loadAndPlay]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    setState((s) => {
      if (!s.queue.length) return s;
      const prevIdx = s.queueIndex - 1;
      if (prevIdx < 0) {
        if (a) a.currentTime = 0;
        return s;
      }
      const song = s.queue[prevIdx];
      loadAndPlay(song);
      return { ...s, queueIndex: prevIdx };
    });
  }, [loadAndPlay]);

  const handleEnded = useCallback(() => {
    if (endOfSongRef.current) {
      endOfSongRef.current = false;
      audioRef.current?.pause();
      setSleepTimerState(null);
      setSleepEndsAt(null);
      return;
    }
    // Truncation detection: if the song ended but actual playback was much
    // shorter than the metadata duration, the URL was a stale preview. Refetch
    // a fresh download URL and retry once.
    const a = audioRef.current;
    setState((s) => {
      const cur = s.currentSong;
      const expected = typeof cur?.duration === "string" ? parseInt(cur.duration, 10) : (cur?.duration || 0);
      const actual = a?.duration || 0;
      if (cur && expected > 60 && actual > 0 && actual < expected - 20 && !retriedRef.current.has(cur.id)) {
        retriedRef.current.add(cur.id);
        // Refresh URLs and retry the same song
        (async () => {
          const fresh = await ensureFullSong(cur, true);
          if (a && fresh.downloadUrl?.length) {
            const url = pickDownloadUrl(fresh, settings.quality);
            if (url) {
              a.src = url;
              try { await a.play(); } catch {}
            }
          }
        })();
        return s;
      }
      return advanceQueue(s);
    });
  }, [ensureFullSong, settings.quality]);

  function advanceQueue(s: PlayerState): PlayerState {
    if (s.repeat === "one") {
      const a = audioRef.current;
      if (a) { a.currentTime = 0; a.play().catch(() => {}); }
      return s;
    }
    if (s.smartShuffle) {
      const reordered = smartShuffle(s.queue);
      const cur = s.queue[s.queueIndex]?.id;
      const candidate = reordered.find((x) => x.id !== cur) || reordered[0];
      const idx = s.queue.findIndex((x) => x.id === candidate.id);
      if (s.queue[idx]) loadAndPlay(s.queue[idx]);
      return { ...s, queueIndex: idx };
    }
    if (s.shuffle) {
      const idx = Math.floor(Math.random() * s.queue.length);
      if (s.queue[idx]) loadAndPlay(s.queue[idx]);
      return { ...s, queueIndex: idx };
    }
    const nextIdx = s.queueIndex + 1;
    if (nextIdx < s.queue.length) {
      loadAndPlay(s.queue[nextIdx]);
      return { ...s, queueIndex: nextIdx };
    }
    if (s.repeat === "all" && s.queue.length) {
      loadAndPlay(s.queue[0]);
      return { ...s, queueIndex: 0 };
    }
    if (settings.autoplay && s.currentSong) autoplaySimilar(s.currentSong);
    return s;
  }

  const autoplaySimilar = useCallback(async (song: Song) => {
    try {
      const related = await buildRelatedQueue(song, 20);
      const filtered = related.filter((s) => isAllowed(s));
      if (filtered.length) {
        setState((s) => ({ ...s, queue: [...s.queue, ...filtered], queueIndex: s.queue.length, queueSource: `${song.name} Radio` }));
        loadAndPlay(filtered[0]);
      }
    } catch {}
  }, [loadAndPlay, isAllowed]);

  const seek = useCallback((percent: number) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = (percent / 100) * a.duration;
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, seconds));
  }, []);

  const setVolume = useCallback((v: number) => {
    const a = audioRef.current;
    if (a) a.volume = v;
    store.write(STORAGE_KEYS.volume, v);
    store.write(STORAGE_KEYS.muted, v === 0);
    setState((s) => ({ ...s, volume: v, isMuted: v === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    store.write(STORAGE_KEYS.muted, a.muted);
    setState((s) => ({ ...s, isMuted: a.muted }));
  }, []);

  const toggleShuffle = useCallback(() => setState((s) => ({ ...s, shuffle: !s.shuffle, smartShuffle: false })), []);
  const toggleSmartShuffle = useCallback(() => setState((s) => ({ ...s, smartShuffle: !s.smartShuffle, shuffle: false })), []);
  const setPlaybackRate = useCallback((r: number) => {
    const a = audioRef.current;
    if (a) a.playbackRate = r;
    setState((s) => ({ ...s, playbackRate: r }));
  }, []);
  const setLoop = useCallback((start: number | null, end: number | null) => {
    setState((s) => ({ ...s, loopStart: start, loopEnd: end }));
  }, []);
  const toggleRepeat = useCallback(() => setState((s) => {
    const order: Repeat[] = ["off", "all", "one"];
    return { ...s, repeat: order[(order.indexOf(s.repeat) + 1) % 3] };
  }), []);

  const removeFromQueue = useCallback((index: number) => {
    setState((s) => {
      if (index < 0 || index >= s.queue.length) return s;
      if (index === s.queueIndex) return s;
      const q = s.queue.slice();
      q.splice(index, 1);
      let qi = s.queueIndex;
      if (index < s.queueIndex) qi--;
      return { ...s, queue: q, queueIndex: qi };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState((s) => {
      if (!s.currentSong) return { ...s, queue: [], queueIndex: -1 };
      return { ...s, queue: [s.currentSong], queueIndex: 0 };
    });
  }, []);

  const reorderQueue = useCallback((from: number, to: number) => {
    setState((s) => {
      const q = s.queue.slice();
      const [moved] = q.splice(from, 1);
      q.splice(to, 0, moved);
      let qi = s.queueIndex;
      if (from === s.queueIndex) qi = to;
      else if (from < s.queueIndex && to >= s.queueIndex) qi--;
      else if (from > s.queueIndex && to <= s.queueIndex) qi++;
      return { ...s, queue: q, queueIndex: qi };
    });
  }, []);

  const setExpanded = useCallback((v: boolean) => setState((s) => ({ ...s, expanded: v, showLyrics: v ? s.showLyrics : false, showQueue: v ? s.showQueue : false })), []);
  const setShowQueue = useCallback((v: boolean) => setState((s) => ({ ...s, showQueue: v, showLyrics: v ? false : s.showLyrics })), []);
  const setShowLyrics = useCallback((v: boolean) => setState((s) => ({ ...s, showLyrics: v, showQueue: v ? false : s.showQueue })), []);
  const setShowCarMode = useCallback((v: boolean) => setState((s) => ({ ...s, showCarMode: v })), []);

  const setSleepTimer = useCallback((mins: number | null, endOfSong = false) => {
    if (sleepTimeoutRef.current) { window.clearTimeout(sleepTimeoutRef.current); sleepTimeoutRef.current = null; }
    if (fadeIntervalRef.current) { window.clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
    if (mins == null && !endOfSong) {
      setSleepTimerState(null); setSleepEndsAt(null); endOfSongRef.current = false; return;
    }
    if (endOfSong) { endOfSongRef.current = true; setSleepTimerState(0); setSleepEndsAt(null); return; }
    setSleepTimerState(mins);
    setSleepEndsAt(Date.now() + mins! * 60_000);
    sleepTimeoutRef.current = window.setTimeout(() => {
      const a = audioRef.current;
      if (!a) return;
      const startVol = a.volume;
      let step = 0;
      const total = 20;
      fadeIntervalRef.current = window.setInterval(() => {
        step++;
        a.volume = Math.max(0, startVol * (1 - step / total));
        if (step >= total) {
          if (fadeIntervalRef.current) window.clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
          a.pause();
          a.volume = startVol;
          setSleepTimerState(null);
          setSleepEndsAt(null);
        }
      }, 500);
    }, mins! * 60_000 - 10_000);
  }, []);

  function updateMediaSession(song: Song) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name,
        artist: artistsName(song),
        album: song.album?.name || "",
        artwork: [
          { src: pickImage(song.image, "low"), sizes: "96x96", type: "image/jpeg" },
          { src: pickImage(song.image, "med"), sizes: "256x256", type: "image/jpeg" },
          { src: pickImage(song.image, "high"), sizes: "512x512", type: "image/jpeg" },
        ],
      });
      // Reset progress so the lock-screen widget doesn't briefly show the
      // previous song's playhead while the new one is buffering. The
      // timeupdate handler will repopulate this within a frame.
      try {
        (navigator as any).mediaSession.setPositionState?.({ duration: 0, playbackRate: 1, position: 0 });
      } catch {}
      navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
      navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
      navigator.mediaSession.setActionHandler("seekto", (d) => { if (d.seekTime != null) seekTo(d.seekTime); });
      navigator.mediaSession.setActionHandler("seekforward", () => seekTo((audioRef.current?.currentTime || 0) + 10));
      navigator.mediaSession.setActionHandler("seekbackward", () => seekTo((audioRef.current?.currentTime || 0) - 10));
    } catch {}
  }

  return (
    <PlayerCtx.Provider value={{
      ...state,
      playSong, playList, addToQueue, playNext, togglePlay, next, prev,
      seek, seekTo, setVolume, toggleMute, toggleShuffle, toggleSmartShuffle, toggleRepeat,
      setPlaybackRate, setLoop,
      removeFromQueue, clearQueue, reorderQueue,
      setExpanded, setShowQueue, setShowLyrics, setShowCarMode,
      sleepTimer, sleepEndsAt, setSleepTimer,
    }}>
      {children}
    </PlayerCtx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
