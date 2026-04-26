"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1,
  Heart, ListMusic, Mic2, Download, Share2, Volume2, VolumeX, MoreHorizontal,
  Moon, Settings2, Check, Car, Gauge, Sparkles, Image as ImageIcon, Repeat2
} from "lucide-react";
import Link from "next/link";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { useSettings } from "@/contexts/SettingsContext";
import { artistsName, decodeHtml, fmtTime, pickImage, pickDownloadUrl } from "@/lib/utils";
import { downloadAudio } from "@/lib/audioCache";
import { downloads, counts } from "@/lib/storage";
import { extractDominantColor } from "@/lib/colorExtract";
import { QueuePanel } from "./QueuePanel";
import { LyricsPanel } from "./LyricsPanel";
import { Seekbar } from "./Seekbar";
import { Visualizer } from "./Visualizer";
import { shareStoryImage } from "@/lib/storyShare";
import type { Quality } from "@/lib/types";

export function FullPlayer() {
  const player = usePlayer();
  const { isLiked, toggleLike, refreshDownloads, downloadIds } = useLibrary();
  const { toast } = useToast();
  const { settings, update } = useSettings();
  const [showSleep, setShowSleep] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bgColor, setBgColor] = useState("#1f1f1f");
  const [glowColor, setGlowColor] = useState("rgba(0,0,0,0.4)");
  const [sleepCountdown, setSleepCountdown] = useState<string>("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragOffset = useRef(0);

  const song = player.currentSong;

  useEffect(() => {
    if (!song) return;
    const url = pickImage(song.image, "high");
    extractDominantColor(url).then((hex) => {
      setBgColor(hex);
      // Brighter glow color
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      setGlowColor(`rgba(${Math.min(255, r * 1.6)}, ${Math.min(255, g * 1.6)}, ${Math.min(255, b * 1.6)}, 0.5)`);
    });
  }, [song?.id]);

  useEffect(() => {
    if (!player.expanded) {
      setShowSleep(false); setShowQuality(false); setShowInfo(false);
    }
  }, [player.expanded]);

  useEffect(() => {
    if (!player.sleepEndsAt) { setSleepCountdown(""); return; }
    function tick() {
      const left = Math.max(0, (player.sleepEndsAt || 0) - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      setSleepCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [player.sleepEndsAt]);

  if (!player.expanded || !song) return null;

  const liked = isLiked(song.id);
  const isDownloaded = downloadIds.includes(song.id);
  const RepeatIcon = player.repeat === "one" ? Repeat1 : Repeat;
  const playCount = typeof window !== "undefined" ? counts.get(song.id) : 0;
  const remaining = Math.max(0, (player.duration || 0) - player.currentTime);

  async function handleDownload() {
    if (!song) return;
    if (isDownloaded) { toast("Already downloaded", "info"); return; }
    const url = pickDownloadUrl(song, settings.downloadQuality);
    if (!url) { toast("No download URL available", "error"); return; }
    setDownloading(true);
    try {
      const blob = await downloadAudio(url, song.id);
      downloads.add({ songId: song.id, quality: settings.downloadQuality, cachedAt: Date.now(), size: blob.size });
      refreshDownloads();
      toast("Downloaded for offline", "success");
    } catch { toast("Download failed", "error"); }
    finally { setDownloading(false); }
  }

  function handleShare() {
    if (!song) return;
    const data = { title: song.name, text: `${song.name} — ${artistsName(song)}`, url: song.url || window.location.href };
    if (navigator.share) navigator.share(data).catch(() => {});
    else { navigator.clipboard.writeText(`${song.name} — ${artistsName(song)}`); toast("Copied to clipboard!", "success"); }
  }

  function onTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest("button, input, a, .no-drag")) return;
    dragStartY.current = e.touches[0].clientY;
    dragOffset.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragStartY.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      dragOffset.current = dy;
      if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  }
  function onTouchEnd() {
    if (sheetRef.current) sheetRef.current.style.transform = "";
    if (dragOffset.current > 120) player.setExpanded(false);
    dragStartY.current = 0;
    dragOffset.current = 0;
  }

  return (
    <div
      ref={sheetRef}
      className="fixed inset-0 z-50 flex flex-col slide-up touch-pan-y overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${bgColor} 0%, #0a0a0a 80%)`,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: `url(${pickImage(song.image, "high")})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(120px) saturate(1.5)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 pointer-events-none" />

      <div className="relative flex flex-col h-full overflow-y-auto">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>
        <header className="flex items-center justify-between px-4 md:px-6 py-2">
          <button onClick={() => player.setExpanded(false)} className="p-2 hover:bg-white/10 rounded-full" aria-label="Minimize">
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="text-center">
            <div className="text-[10px] text-white/70 uppercase tracking-widest font-semibold">Playing from</div>
            <div className="text-sm font-semibold line-clamp-1 max-w-[200px]">{player.queueSource || song.album?.name || "Queue"}</div>
          </div>
          <button onClick={() => setShowInfo((v) => !v)} className="p-2 hover:bg-white/10 rounded-full" aria-label="Info">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 md:px-8 lg:px-16 pb-6">
          <div className="flex-1 flex items-center justify-center min-h-0 py-4">
            {player.showQueue ? (
              <QueuePanel />
            ) : showInfo ? (
              <InfoPanel song={song} playCount={playCount} quality={settings.quality} onClose={() => setShowInfo(false)} />
            ) : (
              // Album art stays visible at all times so lyrics never feel like
              // they swallow the player. The compact lyrics card sits just
              // beneath the art when toggled on.
              <div className="relative max-w-md w-full flex flex-col items-center gap-4">
                <img
                  src={pickImage(song.image, "high")}
                  alt=""
                  className={`w-full aspect-square object-cover art-glow ${settings.vinylRotation ? "rounded-full spin-slow" : ""} ${!player.isPlaying ? "spin-paused" : ""}`}
                  style={{ ["--glow-color" as string]: glowColor }}
                />
                {player.showLyrics && <LyricsPanel song={song} />}
              </div>
            )}
          </div>

          <div className="lg:w-[26rem] flex flex-col justify-end gap-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-2xl md:text-3xl font-extrabold tracking-tight truncate">{decodeHtml(song.name)}</div>
                <div className="text-white/70 mt-1.5 line-clamp-1">
                  {song.artists?.primary?.map((a, i) => (
                    <span key={a.id}>
                      <Link href={`/artist/${a.id}`} className="hover:text-white hover:underline" onClick={() => player.setExpanded(false)}>
                        {a.name}
                      </Link>
                      {i < (song.artists?.primary?.length || 0) - 1 && ", "}
                    </span>
                  ))}
                </div>
                {song.album?.id && (
                  <Link href={`/album/${song.album.id}`} onClick={() => player.setExpanded(false)} className="text-sm text-white/50 hover:text-white hover:underline">
                    {decodeHtml(song.album.name)}
                  </Link>
                )}
              </div>
              <button
                onClick={() => {
                  const added = toggleLike(song.id);
                  toast(added ? "Added to Liked Songs" : "Removed from Liked Songs", added ? "success" : "info");
                }}
                className="p-2 no-drag"
                aria-label="Like"
              >
                <Heart className={`w-7 h-7 ${liked ? "fill-accent text-accent scale-bounce" : "text-white/70 hover:text-white"}`} />
              </button>
            </div>

            <div className="no-drag">
              {showVisualizer && (
                <div className="mb-2 text-accent">
                  <Visualizer height={48} />
                </div>
              )}
              <Seekbar
                progress={player.progress}
                buffered={player.duration ? player.buffered / player.duration : 0}
                duration={player.duration}
                onSeek={player.seek}
              />
              <div className="flex justify-between text-[11px] text-white/60 tabular-nums mt-1">
                <span>{fmtTime(player.currentTime)}</span>
                <span>-{fmtTime(remaining)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between no-drag">
              <button
                onClick={player.toggleShuffle}
                onDoubleClick={player.toggleSmartShuffle}
                className={`p-2 relative ${player.smartShuffle ? "text-accent" : player.shuffle ? "text-accent" : "text-white/70 hover:text-white"}`}
                aria-label={player.smartShuffle ? "Smart Shuffle" : "Shuffle"}
                title={player.smartShuffle ? "Smart Shuffle (double-click to toggle)" : player.shuffle ? "Shuffle (double-click for Smart)" : "Shuffle"}
              >
                {player.smartShuffle ? <Sparkles className="w-5 h-5" /> : <Shuffle className="w-5 h-5" />}
                {(player.shuffle || player.smartShuffle) && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />}
              </button>
              <button onClick={player.prev} className="p-2 text-white hover:scale-110 transition" aria-label="Previous">
                <SkipBack className="w-7 h-7 fill-white" />
              </button>
              <button onClick={player.togglePlay} className="bg-white text-black rounded-full w-16 h-16 hover:scale-105 transition shadow-2xl flex items-center justify-center" aria-label="Play/Pause">
                {player.isPlaying ? <Pause className="w-7 h-7 fill-black" /> : <Play className="w-7 h-7 fill-black ml-1" />}
              </button>
              <button onClick={player.next} className="p-2 text-white hover:scale-110 transition" aria-label="Next">
                <SkipForward className="w-7 h-7 fill-white" />
              </button>
              <button onClick={player.toggleRepeat} className={`p-2 relative ${player.repeat !== "off" ? "text-accent" : "text-white/70 hover:text-white"}`} aria-label="Repeat">
                <RepeatIcon className="w-5 h-5" />
                {player.repeat !== "off" && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-white/70 no-drag">
              <button onClick={() => player.setShowCarMode(true)} className="p-2 hover:text-white" aria-label="Car Mode" title="Car Mode">
                <Car className="w-5 h-5" />
              </button>
              <button onClick={() => player.setShowLyrics(!player.showLyrics)} className={`p-2 ${player.showLyrics ? "text-accent" : "hover:text-white"}`} title="Lyrics" aria-label="Lyrics">
                <Mic2 className="w-5 h-5" />
              </button>
              <button onClick={() => player.setShowQueue(!player.showQueue)} className={`p-2 ${player.showQueue ? "text-accent" : "hover:text-white"}`} title="Queue" aria-label="Queue">
                <ListMusic className="w-5 h-5" />
              </button>
              <button onClick={handleDownload} disabled={downloading} className={`p-2 ${isDownloaded ? "text-accent" : "hover:text-white"}`} title="Download" aria-label="Download">
                {isDownloaded ? <Check className="w-5 h-5" /> : <Download className={`w-5 h-5 ${downloading ? "animate-pulse" : ""}`} />}
              </button>
              <button onClick={handleShare} className="p-2 hover:text-white" title="Share" aria-label="Share">
                <Share2 className="w-5 h-5" />
              </button>
              <div className="relative">
                <button onClick={() => { setShowQuality(!showQuality); setShowSleep(false); }} className="p-2 hover:text-white" title="Quality" aria-label="Quality">
                  <Settings2 className="w-5 h-5" />
                </button>
                {showQuality && (
                  <div className="absolute right-0 bottom-full mb-2 glass-strong rounded-xl shadow-2xl p-1.5 min-w-[160px] z-10">
                    {(["12kbps", "48kbps", "96kbps", "160kbps", "320kbps"] as Quality[]).map((q) => (
                      <button key={q}
                        onClick={() => { update({ quality: q }); setShowQuality(false); toast(`Quality: ${q}`, "success"); }}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10 flex items-center gap-2 ${settings.quality === q ? "text-accent" : "text-white"}`}>
                        {settings.quality === q && <Check className="w-3 h-3" />} {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowSpeed(!showSpeed); setShowSleep(false); setShowQuality(false); }} className={`p-2 ${player.playbackRate !== 1 ? "text-accent" : "hover:text-white"}`} title="Playback speed" aria-label="Speed">
                  <Gauge className="w-5 h-5" />
                  {player.playbackRate !== 1 && <span className="block text-[9px] font-bold tabular-nums text-accent text-center">{player.playbackRate}x</span>}
                </button>
                {showSpeed && (
                  <div className="absolute right-0 bottom-full mb-2 glass-strong rounded-xl shadow-2xl p-1.5 min-w-[100px] z-10">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                      <button key={r}
                        onClick={() => { player.setPlaybackRate(r); setShowSpeed(false); toast(`Speed: ${r}x`, "success"); }}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10 flex items-center gap-2 ${player.playbackRate === r ? "text-accent" : "text-white"}`}>
                        {player.playbackRate === r && <Check className="w-3 h-3" />} {r}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={async () => { if (!song) return; toast("Generating share image…", "info"); try { await shareStoryImage(song); } catch { toast("Share failed", "error"); } }}
                className="p-2 hover:text-white" title="Share as story" aria-label="Share story"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowVisualizer((v) => !v)}
                className={`p-2 ${showVisualizer ? "text-accent" : "hover:text-white"}`} title="Visualizer" aria-label="Visualizer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="10" width="3" height="10"/><rect x="7" y="6" width="3" height="14"/><rect x="12" y="2" width="3" height="18"/><rect x="17" y="8" width="3" height="12"/></svg>
              </button>
              <div className="relative">
                <button onClick={() => { setShowSleep(!showSleep); setShowQuality(false); }} className={`p-2 relative ${player.sleepTimer != null ? "text-accent" : "hover:text-white"}`} title="Sleep" aria-label="Sleep">
                  <Moon className="w-5 h-5" />
                  {sleepCountdown && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-accent text-black px-1 rounded">{sleepCountdown}</span>}
                </button>
                {showSleep && (
                  <div className="absolute right-0 bottom-full mb-2 glass-strong rounded-xl shadow-2xl p-1.5 min-w-[180px] z-10">
                    {[5, 10, 15, 30, 45, 60, 120].map((m) => (
                      <button key={m} onClick={() => { player.setSleepTimer(m); setShowSleep(false); toast(`Music will stop in ${m} min`, "info"); }}
                        className="w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10">
                        {m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} minutes`}
                      </button>
                    ))}
                    <button onClick={() => { player.setSleepTimer(0, true); setShowSleep(false); toast("Stopping at end of song", "info"); }}
                      className="w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10">
                      End of current track
                    </button>
                    {player.sleepTimer != null && (
                      <button onClick={() => { player.setSleepTimer(null); setShowSleep(false); toast("Sleep timer cancelled", "info"); }}
                        className="w-full text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-white/10">
                        Cancel timer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-white/70 no-drag" title="Use your device's volume buttons too — they control system media volume">
              <button onClick={player.toggleMute} aria-label="Mute">
                {player.isMuted || player.volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={player.isMuted ? 0 : player.volume}
                onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                className="range range-accent flex-1"
                style={{ ["--val" as string]: `${(player.isMuted ? 0 : player.volume) * 100}%` }}
                aria-label="Volume"
              />
              <span className="text-[10px] text-white/40 tabular-nums w-8 text-right">{Math.round((player.isMuted ? 0 : player.volume) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ song, playCount, quality, onClose }: { song: any; playCount: number; quality: string; onClose: () => void }) {
  return (
    <div className="w-full max-w-2xl glass-strong rounded-2xl p-6 max-h-full overflow-y-auto no-drag">
      <h3 className="text-xl font-bold mb-4">Song Info</h3>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-secondary">Year</dt><dd>{song.year || "—"}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-secondary">Language</dt><dd className="capitalize">{song.language || "—"}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-secondary">Album</dt><dd>{song.album?.name || "—"}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-secondary">Plays</dt><dd>{playCount}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-secondary">Quality</dt><dd>{quality}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-secondary">Label</dt><dd>{song.label || "—"}</dd></div>
        {song.artists?.primary?.length > 0 && (
          <div>
            <dt className="text-secondary mb-2">Artists</dt>
            <dd className="flex flex-wrap gap-1.5">
              {song.artists.primary.map((a: any) => (
                <span key={a.id} className="bg-white/10 px-2.5 py-1 rounded-full text-xs">{a.name}</span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <button onClick={onClose} className="mt-6 w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold">Close</button>
    </div>
  );
}
