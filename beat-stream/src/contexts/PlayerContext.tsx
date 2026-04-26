"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Song, Quality } from "@/lib/types";
import { api } from "@/lib/api";
import { pickDownloadUrl, pickImage, artistsName } from "@/lib/utils";
import { history, recent, counts, songCache, store, STORAGE_KEYS, blockedSongs, blockedArtists, listenTime } from "@/lib/storage";
import { audioCache } from "@/lib/audioCache";
import { Equalizer } from "@/lib/equalizer";
import { prefetch } from "@/lib/prefetch";
import { cached, TTL } from "@/lib/cache";
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
  repeat: Repeat;
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
  toggleRepeat: () => void;
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

  const [state, setState] = useState<PlayerState>({
    currentSong: null, queue: [], queueIndex: -1, queueSource: "",
    isPlaying: false, volume: 1, progress: 0, currentTime: 0, duration: 0, buffered: 0,
    shuffle: false, repeat: "off",
    isBuffering: false, isMuted: false,
    expanded: false, showQueue: false, showLyrics: false, showCarMode: false,
  });
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);

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
      setState((s) => ({ ...s, volume: a.volume, isMuted: a.muted || a.volume === 0 }));
    };
    const onTime = () => {
      const cur = a.currentTime;
      const dur = a.duration || 0;
      const buf = a.buffered.length ? a.buffered.end(a.buffered.length - 1) : 0;
      // Track listening time
      const now = performance.now();
      if (lastTickRef.current && !a.paused) {
        const elapsed = (now - lastTickRef.current) / 1000;
        if (elapsed < 2) listenTime.add(elapsed);
      }
      lastTickRef.current = now;
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
    };
    const onPause = () => {
      setState((s) => ({ ...s, isPlaying: false }));
      // Start silent loop on iOS to keep session alive
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) startSilent();
    };
    const onWaiting = () => setState((s) => ({ ...s, isBuffering: true }));
    const onPlaying = () => setState((s) => ({ ...s, isBuffering: false }));
    const onEnded = () => handleEnded();

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("ended", onEnded);
    a.addEventListener("volumechange", onVolume);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("volumechange", onVolume);
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
      // Get fresh URLs for the next song too (cached, fast on revisit)
      let full = nextSong;
      if (!full.downloadUrl?.length) {
        const data = await cached(`song:${nextSong.id}`, TTL.song, () => api.getSong(nextSong.id));
        full = (Array.isArray(data) ? data[0] : data) || nextSong;
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
  const ensureFullSong = useCallback(async (song: Song, forceRefresh = false): Promise<Song> => {
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
      await a.play();
      history.push(full.id);
      counts.inc(full.id);
      recent.push(full);
      songCache.put(full);
      setState((s) => {
        const q = s.queue.slice();
        const idx = q.findIndex((x) => x.id === full.id);
        if (idx >= 0) q[idx] = full;
        const here = idx >= 0 ? idx : s.queueIndex;
        // 1) Buffer the very-next track into the hidden audio element (gapless)
        warmNext(q[here + 1]);
        // 2) Prefetch metadata + images for the next 2 songs
        for (let i = 1; i <= 2; i++) {
          const nxt = q[here + i];
          if (nxt) {
            prefetch.song(nxt.id);
            prefetch.image(pickImage(nxt.image, "med"));
            prefetch.image(pickImage(nxt.image, "high"));
            if (nxt.album?.id) prefetch.album(nxt.album.id);
            if (nxt.artists?.primary?.[0]?.id) prefetch.artist(nxt.artists.primary[0].id);
          }
        }
        return { ...s, currentSong: full, queue: q, isBuffering: false };
      });
      updateMediaSession(full);
    } catch {
      setState((s) => ({ ...s, isBuffering: false, isPlaying: false }));
    }
  }, [ensureFullSong, settings.quality, settings.equalizer, settings.normalize, isAllowed]);

  const playSong = useCallback(async (song: Song) => {
    setState((s) => ({ ...s, queue: [song], queueIndex: 0, queueSource: "" }));
    await loadAndPlay(song);
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
      const artistName = song.artists?.primary?.[0]?.name || "";
      if (!artistName) return;
      const res = await api.searchSongs(artistName, 0, 20);
      const filtered = res.results.filter((s) => s.id !== song.id && isAllowed(s));
      if (filtered.length) {
        setState((s) => ({ ...s, queue: [...s.queue, ...filtered], queueIndex: s.queue.length, queueSource: `Similar to ${artistName}` }));
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
    setState((s) => ({ ...s, volume: v, isMuted: v === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setState((s) => ({ ...s, isMuted: a.muted }));
  }, []);

  const toggleShuffle = useCallback(() => setState((s) => ({ ...s, shuffle: !s.shuffle })), []);
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
      seek, seekTo, setVolume, toggleMute, toggleShuffle, toggleRepeat,
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
