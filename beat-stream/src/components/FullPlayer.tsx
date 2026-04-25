"use client";
import { useEffect, useState } from "react";
import {
  ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1,
  Heart, ListMusic, Mic2, Download, Share2, Volume2, VolumeX, MoreHorizontal,
  Moon, Settings2, Check
} from "lucide-react";
import Link from "next/link";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { useSettings } from "@/contexts/SettingsContext";
import { artistsName, fmtTime, pickImage, pickDownloadUrl } from "@/lib/utils";
import { downloadAudio } from "@/lib/audioCache";
import { downloads } from "@/lib/storage";
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
  const [downloading, setDownloading] = useState(false);

  const song = player.currentSong;

  useEffect(() => {
    if (!player.expanded) {
      setShowSleep(false);
      setShowQuality(false);
    }
  }, [player.expanded]);

  if (!player.expanded || !song) return null;

  const liked = isLiked(song.id);
  const isDownloaded = downloadIds.includes(song.id);
  const RepeatIcon = player.repeat === "one" ? Repeat1 : Repeat;

  async function handleDownload() {
    if (!song) return;
    if (isDownloaded) {
      toast("Already downloaded", "info");
      return;
    }
    const url = pickDownloadUrl(song, settings.downloadQuality);
    if (!url) { toast("No download URL available", "error"); return; }
    setDownloading(true);
    try {
      const blob = await downloadAudio(url, song.id);
      downloads.add({ songId: song.id, quality: settings.downloadQuality, cachedAt: Date.now(), size: blob.size });
      refreshDownloads();
      toast("Downloaded for offline", "success");
    } catch {
      toast("Download failed", "error");
    } finally {
      setDownloading(false);
    }
  }

  function handleShare() {
    if (!song) return;
    const shareData = {
      title: song.name,
      text: `${song.name} — ${artistsName(song)}`,
      url: song.url || window.location.href,
    };
    if (navigator.share) navigator.share(shareData).catch(() => {});
    else {
      navigator.clipboard.writeText(shareData.url || "");
      toast("Link copied to clipboard", "success");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col slide-up">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url(${pickImage(song.image, "high")})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(80px) saturate(1.5)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

      <div className="relative flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between p-4 md:p-6">
          <button onClick={() => player.setExpanded(false)} className="p-2 hover:bg-white/10 rounded-full">
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="text-center">
            <div className="text-xs text-secondary uppercase">Playing from</div>
            <div className="text-sm font-semibold">{song.album?.name || "Queue"}</div>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-full">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 md:px-8 lg:px-16 pb-6">
          {/* Album art */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            {player.showLyrics ? (
              <LyricsPanel song={song} />
            ) : player.showQueue ? (
              <QueuePanel />
            ) : (
              <img
                src={pickImage(song.image, "high")}
                alt=""
                className="w-full max-w-md aspect-square rounded-xl object-cover shadow-2xl"
              />
            )}
          </div>

          {/* Controls */}
          <div className="lg:w-96 flex flex-col justify-end gap-4">
            <div>
              <div className="flex items-center justify-between gap-4 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="text-2xl md:text-3xl font-bold truncate">{song.name}</div>
                  <div className="text-secondary mt-1">
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
                      {song.album.name}
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => {
                    const added = toggleLike(song.id);
                    toast(added ? "Added to Liked Songs" : "Removed from Liked Songs", added ? "success" : "info");
                  }}
                  className="p-2"
                >
                  <Heart className={`w-7 h-7 ${liked ? "fill-red-500 text-red-500" : "text-secondary hover:text-white"}`} />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={player.progress}
                onChange={(e) => player.seek(parseFloat(e.target.value))}
                className="range range-accent w-full"
                style={{ ["--val" as string]: `${player.progress}%` }}
              />
              <div className="flex justify-between text-xs text-secondary mt-1">
                <span>{fmtTime(player.currentTime)}</span>
                <span>{fmtTime(player.duration)}</span>
              </div>
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={player.toggleShuffle}
                className={`p-2 ${player.shuffle ? "text-accent" : "text-secondary hover:text-white"}`}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button onClick={player.prev} className="p-2 text-white hover:scale-110 transition">
                <SkipBack className="w-7 h-7 fill-white" />
              </button>
              <button
                onClick={player.togglePlay}
                className="bg-white text-black rounded-full p-4 hover:scale-105 transition"
              >
                {player.isPlaying ? <Pause className="w-7 h-7 fill-black" /> : <Play className="w-7 h-7 fill-black ml-0.5" />}
              </button>
              <button onClick={player.next} className="p-2 text-white hover:scale-110 transition">
                <SkipForward className="w-7 h-7 fill-white" />
              </button>
              <button
                onClick={player.toggleRepeat}
                className={`p-2 ${player.repeat !== "off" ? "text-accent" : "text-secondary hover:text-white"}`}
              >
                <RepeatIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Bottom action row */}
            <div className="flex items-center justify-between text-secondary">
              <button
                onClick={() => player.setShowLyrics(!player.showLyrics)}
                className={`p-2 ${player.showLyrics ? "text-accent" : "hover:text-white"}`}
                title="Lyrics"
              >
                <Mic2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => player.setShowQueue(!player.showQueue)}
                className={`p-2 ${player.showQueue ? "text-accent" : "hover:text-white"}`}
                title="Queue"
              >
                <ListMusic className="w-5 h-5" />
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className={`p-2 ${isDownloaded ? "text-accent" : "hover:text-white"}`}
                title="Download"
              >
                {isDownloaded ? <Check className="w-5 h-5" /> : <Download className={`w-5 h-5 ${downloading ? "animate-pulse" : ""}`} />}
              </button>
              <button onClick={handleShare} className="p-2 hover:text-white" title="Share">
                <Share2 className="w-5 h-5" />
              </button>
              <div className="relative">
                <button onClick={() => { setShowQuality(!showQuality); setShowSleep(false); }} className="p-2 hover:text-white" title="Quality">
                  <Settings2 className="w-5 h-5" />
                </button>
                {showQuality && (
                  <div className="absolute right-0 bottom-full mb-2 bg-card rounded-lg shadow-xl border border-white/10 p-2 min-w-[140px]">
                    {(["12kbps", "48kbps", "96kbps", "160kbps", "320kbps"] as Quality[]).map((q) => (
                      <button
                        key={q}
                        onClick={() => { update({ quality: q }); setShowQuality(false); toast(`Quality set to ${q}`, "success"); }}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-card-hover ${settings.quality === q ? "text-accent" : "text-white"}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowSleep(!showSleep); setShowQuality(false); }} className={`p-2 ${player.sleepTimer ? "text-accent" : "hover:text-white"}`} title="Sleep">
                  <Moon className="w-5 h-5" />
                </button>
                {showSleep && (
                  <div className="absolute right-0 bottom-full mb-2 bg-card rounded-lg shadow-xl border border-white/10 p-2 min-w-[160px]">
                    {[15, 30, 45, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => { player.setSleepTimer(m); setShowSleep(false); toast(`Sleep timer: ${m} min`, "success"); }}
                        className="w-full text-left px-3 py-2 rounded text-sm hover:bg-card-hover"
                      >
                        {m} minutes
                      </button>
                    ))}
                    <button
                      onClick={() => { player.setSleepTimer(0, true); setShowSleep(false); toast("Sleep at end of song", "success"); }}
                      className="w-full text-left px-3 py-2 rounded text-sm hover:bg-card-hover"
                    >
                      End of song
                    </button>
                    {player.sleepTimer != null && (
                      <button
                        onClick={() => { player.setSleepTimer(null); setShowSleep(false); toast("Sleep timer cancelled", "info"); }}
                        className="w-full text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-card-hover"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Volume on desktop */}
            <div className="hidden lg:flex items-center gap-2 text-secondary">
              <button onClick={player.toggleMute}>
                {player.isMuted || player.volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={player.isMuted ? 0 : player.volume}
                onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                className="range range-accent flex-1"
                style={{ ["--val" as string]: `${(player.isMuted ? 0 : player.volume) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
