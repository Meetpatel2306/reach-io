"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1,
  Heart, ListMusic, Mic2, Download, Share2, Volume2, VolumeX, MoreHorizontal,
  Moon, Settings2, Check, Car, Info
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
import type { Quality } from "@/lib/types";

export function FullPlayer() {
  const player = usePlayer();
  const { isLiked, toggleLike, refreshDownloads, downloadIds } = useLibrary();
  const { toast } = useToast();
  const { settings, update } = useSettings();
  const [showSleep, setShowSleep] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bgColor, setBgColor] = useState("#1f1f1f");
  const [sleepCountdown, setSleepCountdown] = useState<string>("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragOffset = useRef(0);

  const song = player.currentSong;

  useEffect(() => {
    if (!song) return;
    extractDominantColor(pickImage(song.image, "high")).then(setBgColor);
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
      className="fixed inset-0 z-50 flex flex-col slide-up touch-pan-y"
      style={{ background: `linear-gradient(180deg, ${bgColor} 0%, #0a0a0a 75%)`, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{ backgroundImage: `url(${pickImage(song.image, "high")})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(80px) saturate(1.4)" }}
      />

      <div className="relative flex flex-col h-full overflow-y-auto">
        <header className="flex items-center justify-between px-4 md:px-6 py-3">
          <button onClick={() => player.setExpanded(false)} className="p-2 hover:bg-white/10 rounded-full" aria-label="Minimize">
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="text-center">
            <div className="text-[10px] text-secondary uppercase tracking-widest">Playing from</div>
            <div className="text-sm font-semibold line-clamp-1 max-w-[200px]">{player.queueSource || song.album?.name || "Queue"}</div>
          </div>
          <button onClick={() => setShowInfo((v) => !v)} className="p-2 hover:bg-white/10 rounded-full" aria-label="Info">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 md:px-8 lg:px-16 pb-6">
          <div className="flex-1 flex items-center justify-center min-h-0">
            {player.showLyrics ? (
              <LyricsPanel song={song} />
            ) : player.showQueue ? (
              <QueuePanel />
            ) : showInfo ? (
              <InfoPanel song={song} playCount={playCount} quality={settings.quality} onClose={() => setShowInfo(false)} />
            ) : (
              <div className="relative max-w-md w-full">
                <img
                  src={pickImage(song.image, "high")}
                  alt=""
                  className={`w-full aspect-square object-cover shadow-2xl ${settings.vinylRotation ? "rounded-full spin-slow" : "rounded-xl"} ${!player.isPlaying ? "spin-paused" : ""}`}
                />
              </div>
            )}
          </div>

          <div className="lg:w-[26rem] flex flex-col justify-end gap-4">
            <div className="flex items-center justify-between gap-4 mb-1">
              <div className="flex-1 min-w-0">
                <div className="text-2xl md:text-3xl font-bold truncate">{decodeHtml(song.name)}</div>
                <div className="text-secondary mt-1 line-clamp-1">
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
                  <Link href={`/album/${song.album.id}`} onClick={() => player.setExpanded(false)} className="text-sm text-secondary hover:text-white hover:underline">
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
                <Heart className={`w-7 h-7 ${liked ? "fill-accent text-accent scale-bounce" : "text-secondary hover:text-white"}`} />
              </button>
            </div>

            <div className="no-drag">
              <input
                type="range" min={0} max={100} step={0.1}
                value={player.progress}
                onChange={(e) => player.seek(parseFloat(e.target.value))}
                className="range range-accent w-full"
                style={{ ["--val" as string]: `${player.progress}%` }}
                aria-label="Seek"
              />
              <div className="flex justify-between text-xs text-secondary mt-1">
                <span>{fmtTime(player.currentTime)}</span>
                <span>-{fmtTime(remaining)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between no-drag">
              <button onClick={player.toggleShuffle} className={`p-2 ${player.shuffle ? "text-accent" : "text-secondary hover:text-white"}`} aria-label="Shuffle">
                <Shuffle className="w-5 h-5" />
                {player.shuffle && <span className="block w-1 h-1 rounded-full bg-accent mx-auto mt-0.5" />}
              </button>
              <button onClick={player.prev} className="p-2 text-white hover:scale-110 transition" aria-label="Previous">
                <SkipBack className="w-7 h-7 fill-white" />
              </button>
              <button onClick={player.togglePlay} className="bg-white text-black rounded-full p-4 hover:scale-105 transition shadow-2xl" aria-label="Play/Pause">
                {player.isPlaying ? <Pause className="w-7 h-7 fill-black" /> : <Play className="w-7 h-7 fill-black ml-0.5" />}
              </button>
              <button onClick={player.next} className="p-2 text-white hover:scale-110 transition" aria-label="Next">
                <SkipForward className="w-7 h-7 fill-white" />
              </button>
              <button onClick={player.toggleRepeat} className={`p-2 relative ${player.repeat !== "off" ? "text-accent" : "text-secondary hover:text-white"}`} aria-label="Repeat">
                <RepeatIcon className="w-5 h-5" />
                {player.repeat !== "off" && <span className="block w-1 h-1 rounded-full bg-accent mx-auto mt-0.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-secondary no-drag">
              <button onClick={() => player.setShowCarMode(true)} className="p-2 hover:text-white" title="Car Mode" aria-label="Car Mode">
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
                  <div className="absolute right-0 bottom-full mb-2 bg-card rounded-lg shadow-xl border border-white/10 p-2 min-w-[160px] z-10">
                    {(["12kbps", "48kbps", "96kbps", "160kbps", "320kbps"] as Quality[]).map((q) => (
                      <button
                        key={q}
                        onClick={() => { update({ quality: q }); setShowQuality(false); toast(`Quality: ${q}`, "success"); }}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-card-hover flex items-center gap-2 ${settings.quality === q ? "text-accent" : "text-white"}`}
                      >
                        {settings.quality === q && <Check className="w-3 h-3" />} {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowSleep(!showSleep); setShowQuality(false); }} className={`p-2 ${player.sleepTimer != null ? "text-accent" : "hover:text-white"} relative`} title="Sleep" aria-label="Sleep">
                  <Moon className="w-5 h-5" />
                  {sleepCountdown && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-accent text-black px-1 rounded">{sleepCountdown}</span>}
                </button>
                {showSleep && (
                  <div className="absolute right-0 bottom-full mb-2 bg-card rounded-lg shadow-xl border border-white/10 p-2 min-w-[180px] z-10">
                    {[5, 10, 15, 30, 45, 60, 120].map((m) => (
                      <button
                        key={m}
                        onClick={() => { player.setSleepTimer(m); setShowSleep(false); toast(`Music will stop in ${m} min`, "info"); }}
                        className="w-full text-left px-3 py-2 rounded text-sm hover:bg-card-hover"
                      >
                        {m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} minutes`}
                      </button>
                    ))}
                    <button
                      onClick={() => { player.setSleepTimer(0, true); setShowSleep(false); toast("Stopping at end of song", "info"); }}
                      className="w-full text-left px-3 py-2 rounded text-sm hover:bg-card-hover"
                    >
                      End of current track
                    </button>
                    {player.sleepTimer != null && (
                      <button
                        onClick={() => { player.setSleepTimer(null); setShowSleep(false); toast("Sleep timer cancelled", "info"); }}
                        className="w-full text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-card-hover"
                      >
                        Cancel timer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-secondary no-drag">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ song, playCount, quality, onClose }: { song: any; playCount: number; quality: string; onClose: () => void }) {
  return (
    <div className="w-full max-w-2xl bg-black/50 rounded-2xl p-6 max-h-full overflow-y-auto no-drag">
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
            <dt className="text-secondary mb-1">Artists</dt>
            <dd className="flex flex-wrap gap-1">
              {song.artists.primary.map((a: any) => (
                <span key={a.id} className="bg-white/10 px-2 py-0.5 rounded text-xs">{a.name}</span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <button onClick={onClose} className="mt-6 w-full py-2 bg-white/10 hover:bg-white/20 rounded text-sm">Close</button>
    </div>
  );
}
