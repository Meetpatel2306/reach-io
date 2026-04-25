"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Song, Quality } from "@/lib/types";
import { api } from "@/lib/api";
import { pickDownloadUrl, pickImage, artistsName, shuffle as shuf } from "@/lib/utils";
import { history, recent, counts, songCache, store, STORAGE_KEYS } from "@/lib/storage";
import { audioCache } from "@/lib/audioCache";
import { useSettings } from "./SettingsContext";

type Repeat = "off" | "all" | "one";

interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  isBuffering: boolean;
  isMuted: boolean;
  expanded: boolean;
  showQueue: boolean;
  showLyrics: boolean;
}

interface Ctx extends PlayerState {
  audioEl: HTMLAudioElement | null;
  playSong: (song: Song) => Promise<void>;
  playList: (songs: Song[], startIndex?: number) => Promise<void>;
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
  sleepTimer: number | null;
  setSleepTimer: (mins: number | null, endOfSong?: boolean) => void;
}

const PlayerCtx = createContext<Ctx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    volume: 1,
    progress: 0,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: "off",
    isBuffering: false,
    isMuted: false,
    expanded: false,
    showQueue: false,
    showLyrics: false,
  });
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const sleepTimeoutRef = useRef<number | null>(null);
  const endOfSongRef = useRef(false);

  // Init audio element
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio();
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    audioRef.current = a;
    a.volume = state.volume;

    const onTime = () => {
      const cur = a.currentTime;
      const dur = a.duration || 0;
      setState((s) => ({ ...s, currentTime: cur, duration: dur, progress: dur ? (cur / dur) * 100 : 0 }));
    };
    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));
    const onWaiting = () => setState((s) => ({ ...s, isBuffering: true }));
    const onPlaying = () => setState((s) => ({ ...s, isBuffering: false }));
    const onEnded = () => handleEnded();

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("ended", onEnded);
      a.pause();
      a.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore on mount
  useEffect(() => {
    const last = store.read<Song | null>(STORAGE_KEYS.current, null);
    const queueData = store.read<{ songs: Song[]; currentIndex: number }>(STORAGE_KEYS.queue, { songs: [], currentIndex: -1 });
    if (last) setState((s) => ({ ...s, currentSong: last, queue: queueData.songs.length ? queueData.songs : [last], queueIndex: queueData.currentIndex >= 0 ? queueData.currentIndex : 0 }));
  }, []);

  // Persist queue/current
  useEffect(() => {
    if (state.currentSong) store.write(STORAGE_KEYS.current, state.currentSong);
    store.write(STORAGE_KEYS.queue, { songs: state.queue, currentIndex: state.queueIndex });
  }, [state.currentSong, state.queue, state.queueIndex]);

  const ensureFullSong = useCallback(async (song: Song): Promise<Song> => {
    if (song.downloadUrl?.length) return song;
    const cached = songCache.get(song.id);
    if (cached?.downloadUrl?.length) return cached;
    try {
      const data = await api.getSong(song.id);
      const full = Array.isArray(data) ? data[0] : data;
      if (full) {
        songCache.put(full);
        return full;
      }
    } catch {}
    return song;
  }, []);

  const loadAndPlay = useCallback(async (song: Song) => {
    const a = audioRef.current;
    if (!a) return;
    setState((s) => ({ ...s, isBuffering: true, currentSong: song }));
    const full = await ensureFullSong(song);

    // Prefer cached blob (offline)
    let src: string | null = null;
    try {
      const blob = await audioCache.get(full.id);
      if (blob) src = URL.createObjectURL(blob);
    } catch {}

    if (!src) {
      src = pickDownloadUrl(full, settings.quality);
    }
    if (!src) {
      setState((s) => ({ ...s, isBuffering: false }));
      return;
    }

    a.src = src;
    try {
      await a.play();
      history.push(full.id);
      counts.inc(full.id);
      recent.push(full);
      songCache.put(full);
      // Replace queue entry with full song
      setState((s) => {
        const q = s.queue.slice();
        const idx = q.findIndex((x) => x.id === full.id);
        if (idx >= 0) q[idx] = full;
        return { ...s, currentSong: full, queue: q, isBuffering: false };
      });
      updateMediaSession(full);
    } catch (e) {
      setState((s) => ({ ...s, isBuffering: false, isPlaying: false }));
    }
  }, [ensureFullSong, settings.quality]);

  const playSong = useCallback(async (song: Song) => {
    setState((s) => ({ ...s, queue: [song], queueIndex: 0 }));
    await loadAndPlay(song);
  }, [loadAndPlay]);

  const playList = useCallback(async (songs: Song[], startIndex = 0) => {
    if (!songs.length) return;
    songCache.putMany(songs);
    setState((s) => ({ ...s, queue: songs, queueIndex: startIndex }));
    await loadAndPlay(songs[startIndex]);
  }, [loadAndPlay]);

  const addToQueue = useCallback((song: Song) => {
    setState((s) => {
      const q = [...s.queue, song];
      return { ...s, queue: q, queueIndex: s.queueIndex < 0 ? 0 : s.queueIndex };
    });
  }, []);

  const playNext = useCallback((song: Song) => {
    setState((s) => {
      const q = s.queue.slice();
      const insertAt = s.queueIndex + 1;
      q.splice(insertAt, 0, song);
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

  const goTo = useCallback((idx: number) => {
    setState((s) => {
      if (idx < 0 || idx >= s.queue.length) return s;
      const song = s.queue[idx];
      loadAndPlay(song);
      return { ...s, queueIndex: idx };
    });
  }, [loadAndPlay]);

  const next = useCallback(() => {
    setState((s) => {
      if (!s.queue.length) return s;
      let nextIdx: number;
      if (s.repeat === "one") nextIdx = s.queueIndex;
      else if (s.shuffle) {
        nextIdx = Math.floor(Math.random() * s.queue.length);
      } else {
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
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    setState((s) => {
      if (!s.queue.length) return s;
      const prevIdx = s.queueIndex - 1;
      if (prevIdx < 0) return s;
      const song = s.queue[prevIdx];
      loadAndPlay(song);
      return { ...s, queueIndex: prevIdx };
    });
  }, [loadAndPlay]);

  const handleEnded = useCallback(() => {
    if (endOfSongRef.current) {
      endOfSongRef.current = false;
      const a = audioRef.current;
      if (a) a.pause();
      return;
    }
    setState((s) => {
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
      // Autoplay similar
      if (settings.autoplay && s.currentSong) {
        autoplaySimilar(s.currentSong);
      }
      return s;
    });
  }, [loadAndPlay, settings.autoplay]);

  const autoplaySimilar = useCallback(async (song: Song) => {
    try {
      const artistName = song.artists?.primary?.[0]?.name || "";
      if (!artistName) return;
      const res = await api.searchSongs(artistName, 0, 10);
      const filtered = res.results.filter((s) => s.id !== song.id);
      if (filtered.length) {
        setState((s) => ({ ...s, queue: [...s.queue, ...filtered], queueIndex: s.queue.length }));
        loadAndPlay(filtered[0]);
      }
    } catch {}
  }, [loadAndPlay]);

  const seek = useCallback((percent: number) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = (percent / 100) * a.duration;
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = seconds;
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
      if (index === s.queueIndex) return s; // don't remove currently playing
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

  const setSleepTimer = useCallback((mins: number | null, endOfSong = false) => {
    if (sleepTimeoutRef.current) {
      window.clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
    setSleepTimerState(mins);
    endOfSongRef.current = endOfSong;
    if (endOfSong) return;
    if (mins == null) return;
    sleepTimeoutRef.current = window.setTimeout(() => {
      const a = audioRef.current;
      if (a) a.pause();
      setSleepTimerState(null);
    }, mins * 60_000);
  }, []);

  // Media Session API
  function updateMediaSession(song: Song) {
    if (!("mediaSession" in navigator)) return;
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
  }

  return (
    <PlayerCtx.Provider value={{
      ...state,
      audioEl: audioRef.current,
      playSong, playList, addToQueue, playNext, togglePlay, next, prev,
      seek, seekTo, setVolume, toggleMute, toggleShuffle, toggleRepeat,
      removeFromQueue, clearQueue, reorderQueue,
      setExpanded, setShowQueue, setShowLyrics,
      sleepTimer, setSleepTimer,
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
