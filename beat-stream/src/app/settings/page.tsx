"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2, Smartphone, Keyboard, Download, Music } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/contexts/ToastContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { history, searches, store, STORAGE_KEYS, downloads, songCache, recent, counts, listenTime } from "@/lib/storage";
import { audioCache } from "@/lib/audioCache";
import type { AccentColor, Quality, Theme } from "@/lib/types";
import { EQ_BANDS, EQ_PRESETS } from "@/lib/equalizer";
import { ShortcutsModal } from "@/components/ShortcutsModal";

const AVATARS = ["🎵","🎧","🎸","🎹","🎤","🎷","🥁","🎻","🎺","🪕","🎼","🎶","🦊","🐱","🐶","🦁"];

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const { likedIds, blockedSongIds, blockedArtistIds, toggleBlockSong, toggleBlockArtist } = useLibrary();
  const [audioSize, setAudioSize] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [stats, setStats] = useState({ totalPlays: 0, totalSec: 0, topArtist: "—", topSong: "—", topLang: "—" });

  useEffect(() => {
    audioCache.size().then(setAudioSize);
    if (typeof window !== "undefined") {
      setInstalled((window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches);
      const cmap = counts.all();
      const cache = songCache.all();
      const totalPlays = Object.values(cmap).reduce((s, n) => s + n, 0);
      let topSongId = "", topSongCount = 0;
      const artistTotals: Record<string, { name: string; total: number }> = {};
      const langCount: Record<string, number> = {};
      Object.entries(cmap).forEach(([id, c]) => {
        const s = cache[id];
        if (!s) return;
        if (c > topSongCount) { topSongCount = c; topSongId = id; }
        const a = s.artists?.primary?.[0];
        if (a) { if (!artistTotals[a.id]) artistTotals[a.id] = { name: a.name, total: 0 }; artistTotals[a.id].total += c; }
        if (s.language) langCount[s.language] = (langCount[s.language] || 0) + c;
      });
      const topArtist = Object.values(artistTotals).sort((a, b) => b.total - a.total)[0]?.name || "—";
      const topLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      setStats({ totalPlays, totalSec: listenTime.get(), topArtist, topSong: cache[topSongId]?.name || "—", topLang });
    }
  }, []);

  function bytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  async function clearCache() {
    await audioCache.clear();
    downloads.clear();
    setAudioSize(0);
    toast("Audio cache cleared", "success");
  }

  function clearAllData() {
    if (!confirm("This will delete ALL your playlists, liked songs, downloads, and settings. This cannot be undone.")) return;
    Object.values(STORAGE_KEYS).forEach((k) => store.remove(k));
    audioCache.clear();
    toast("All data cleared — reloading", "success");
    setTimeout(() => window.location.reload(), 800);
  }

  async function handleInstall() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) { toast("On iOS: tap Share → Add to Home Screen", "info"); return; }
    const evt = (window as any).__bsInstallPrompt;
    if (evt) { try { await evt.prompt(); } catch {} }
    else toast("Install prompt not available", "info");
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-4 text-accent">{title}</h2>
      <div className="space-y-4 bg-card rounded-xl p-5">{children}</div>
    </section>
  );
  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs text-secondary mt-0.5">{hint}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition ${value ? "bg-accent" : "bg-white/20"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? "left-5" : "left-0.5"}`} />
    </button>
  );

  const QUALITIES: Quality[] = ["12kbps", "48kbps", "96kbps", "160kbps", "320kbps"];
  const ACCENTS: { key: AccentColor; color: string; label: string }[] = [
    { key: "green", color: "#1ed760", label: "Spotify Green" },
    { key: "blue", color: "#3b82f6", label: "Blue" },
    { key: "purple", color: "#8b5cf6", label: "Purple" },
    { key: "red", color: "#ef4444", label: "Red" },
    { key: "orange", color: "#f97316", label: "Orange" },
    { key: "pink", color: "#ec4899", label: "Pink" },
    { key: "cyan", color: "#06b6d4", label: "Cyan" },
    { key: "yellow", color: "#eab308", label: "Yellow" },
  ];

  const usedBytes = audioSize;
  const limitBytes = 50 * 1024 * 1024;
  const pct = Math.min(100, (usedBytes / limitBytes) * 100);
  const cache = typeof window !== "undefined" ? songCache.all() : {};
  const blockedSongList = blockedSongIds.map((id) => cache[id]).filter(Boolean);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Section title="Profile">
        <Row label="Display Name">
          <input value={settings.displayName} onChange={(e) => update({ displayName: e.target.value })}
            className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm w-44 outline-none focus:border-accent" />
        </Row>
        <div>
          <div className="text-sm font-semibold mb-2">Avatar</div>
          <div className="grid grid-cols-8 gap-2">
            {AVATARS.map((a) => (
              <button key={a} onClick={() => update({ avatar: a })}
                className={`w-9 h-9 rounded-full text-lg flex items-center justify-center ${settings.avatar === a ? "bg-accent" : "bg-white/5 hover:bg-white/15"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-bg/40 rounded-lg p-4">
          <h3 className="text-sm font-bold mb-3">Your Stats</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-secondary text-xs">Total plays</dt><dd className="font-semibold">{stats.totalPlays}</dd></div>
            <div><dt className="text-secondary text-xs">Listening time</dt><dd className="font-semibold">{Math.floor(stats.totalSec / 3600)}h {Math.floor((stats.totalSec % 3600) / 60)}m</dd></div>
            <div><dt className="text-secondary text-xs">Top artist</dt><dd className="font-semibold line-clamp-1">{stats.topArtist}</dd></div>
            <div><dt className="text-secondary text-xs">Top song</dt><dd className="font-semibold line-clamp-1">{stats.topSong}</dd></div>
            <div><dt className="text-secondary text-xs">Top language</dt><dd className="font-semibold capitalize">{stats.topLang}</dd></div>
            <div><dt className="text-secondary text-xs">Liked songs</dt><dd className="font-semibold">{likedIds.length}</dd></div>
          </dl>
          <Link href="/wrapped" className="text-accent text-xs hover:underline mt-3 inline-block">View Full Wrapped →</Link>
        </div>
      </Section>

      <Section title="Playback">
        <Row label="Streaming Quality" hint="Higher quality uses more data">
          <select value={settings.quality} onChange={(e) => update({ quality: e.target.value as Quality })} className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm">
            {QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </Row>
        <Row label="Download Quality">
          <select value={settings.downloadQuality} onChange={(e) => update({ downloadQuality: e.target.value as Quality })} className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm">
            {QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </Row>
        <Row label="Crossfade" hint={`${settings.crossfade}s — fade between songs`}>
          <input type="range" min={0} max={12} value={settings.crossfade} onChange={(e) => update({ crossfade: parseInt(e.target.value, 10) })}
            className="range range-accent w-32" style={{ ["--val" as string]: `${(settings.crossfade / 12) * 100}%` }} />
        </Row>
        <Row label="Gapless Playback"><Toggle value={settings.gapless} onChange={(v) => update({ gapless: v })} /></Row>
        <Row label="Normalize Volume"><Toggle value={settings.normalize} onChange={(v) => update({ normalize: v })} /></Row>
        <Row label="Autoplay similar songs" hint="When the queue ends"><Toggle value={settings.autoplay} onChange={(v) => update({ autoplay: v })} /></Row>
      </Section>

      <Section title="Equalizer">
        <Row label="Enable Equalizer"><Toggle value={settings.equalizer.enabled} onChange={(v) => update({ equalizer: { ...settings.equalizer, enabled: v } })} /></Row>
        <Row label="Preset">
          <select
            value={settings.equalizer.preset}
            onChange={(e) => {
              const preset = e.target.value;
              const gains = EQ_PRESETS[preset] || [0, 0, 0, 0, 0];
              update({ equalizer: { ...settings.equalizer, preset, gains } });
            }}
            className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm"
          >
            {Object.keys(EQ_PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="Custom">Custom</option>
          </select>
        </Row>
        <div className="flex justify-between gap-2 pt-3">
          {EQ_BANDS.map((freq, i) => (
            <div key={freq} className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[10px] text-secondary">+12</span>
              <input
                type="range" min={-12} max={12} step={1}
                value={settings.equalizer.gains[i] ?? 0}
                onChange={(e) => {
                  const gains = settings.equalizer.gains.slice();
                  gains[i] = parseInt(e.target.value, 10);
                  update({ equalizer: { ...settings.equalizer, gains, preset: "Custom" } });
                }}
                className="range range-vertical"
              />
              <span className="text-[10px] text-secondary">-12</span>
              <span className="text-[10px] font-mono">{freq < 1000 ? freq : `${freq / 1000}k`}</span>
              <span className="text-[10px] text-accent font-semibold">{settings.equalizer.gains[i] > 0 ? "+" : ""}{settings.equalizer.gains[i] ?? 0}dB</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => update({ equalizer: { ...settings.equalizer, gains: [0, 0, 0, 0, 0], preset: "Flat" } })}
          className="text-xs text-secondary hover:text-white"
        >Reset to Flat</button>
      </Section>

      <Section title="Display & Appearance">
        <Row label="Theme">
          <select value={settings.theme} onChange={(e) => update({ theme: e.target.value as Theme })} className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="amoled">AMOLED Black</option>
            <option value="system">System</option>
          </select>
        </Row>
        <Row label="Accent Color">
          <div className="flex gap-2 flex-wrap max-w-[260px] justify-end">
            {ACCENTS.map((a) => (
              <button key={a.key} onClick={() => update({ accentColor: a.key })} title={a.label}
                className={`w-7 h-7 rounded-full transition ${settings.accentColor === a.key ? "ring-2 ring-white ring-offset-2 ring-offset-card" : ""}`}
                style={{ background: a.color }} />
            ))}
          </div>
        </Row>
        <Row label="Animations" hint="Disable to save battery"><Toggle value={settings.animations} onChange={(v) => update({ animations: v })} /></Row>
        <Row label="Vinyl Rotation" hint="Spinning album art on full player"><Toggle value={settings.vinylRotation} onChange={(v) => update({ vinylRotation: v })} /></Row>
        <Row label="Compact Mode" hint="Smaller cards, denser grid"><Toggle value={settings.compact} onChange={(v) => update({ compact: v })} /></Row>
        <Row label="Show Explicit Content"><Toggle value={settings.showExplicit} onChange={(v) => update({ showExplicit: v })} /></Row>
      </Section>

      <Section title="Data & Storage">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold">Storage Usage</span>
            <span className="text-secondary text-xs">{bytes(usedBytes)} / 50 MB</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-secondary mt-2">iOS limits PWA storage to ~50MB. Use wisely.</p>
        </div>
        <Row label="Downloaded songs" hint={bytes(usedBytes)}>
          <button onClick={clearCache} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">Clear</button>
        </Row>
        <Row label="Search History">
          <button onClick={() => { searches.clear(); toast("Search history cleared", "success"); }} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">Clear</button>
        </Row>
        <Row label="Play History">
          <button onClick={() => { history.clear(); recent.clear(); counts.clear(); listenTime.clear(); toast("Play history cleared", "success"); }} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">Clear</button>
        </Row>
        <Row label="Reset all data" hint="Erases everything — settings, library, history, downloads">
          <button onClick={clearAllData} className="text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded">Factory reset</button>
        </Row>
      </Section>

      {(blockedSongList.length > 0 || blockedArtistIds.length > 0) && (
        <Section title="Blocked Content">
          {blockedSongList.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">Blocked Songs</div>
              <ul className="space-y-1">
                {blockedSongList.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm py-1">
                    <span className="line-clamp-1">{s.name}</span>
                    <button onClick={() => toggleBlockSong(s.id)} className="text-xs text-accent hover:underline">Unblock</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {blockedArtistIds.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">Blocked Artists</div>
              <ul className="space-y-1">
                {blockedArtistIds.map((id) => (
                  <li key={id} className="flex items-center justify-between text-sm py-1">
                    <span>{id}</span>
                    <button onClick={() => toggleBlockArtist(id)} className="text-xs text-accent hover:underline">Unblock</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      <Section title="About">
        <Row label="Version"><span className="text-secondary text-sm">1.0.0</span></Row>
        <Row label="Data Source"><span className="text-secondary text-sm">JioSaavn (saavn.dev)</span></Row>
        <Row label="Install App">
          {installed ? <span className="text-accent text-sm flex items-center gap-1"><Smartphone className="w-4 h-4" /> ✓ Installed</span>
            : <button onClick={handleInstall} className="text-sm bg-accent text-black font-semibold px-4 py-1.5 rounded-full flex items-center gap-1"><Download className="w-4 h-4" /> Install</button>}
        </Row>
        <Row label="Keyboard Shortcuts">
          <button onClick={() => setShowShortcuts(true)} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-1"><Keyboard className="w-4 h-4" /> Show all</button>
        </Row>
        <Row label="Made with"><span className="text-secondary text-sm">♥ in India</span></Row>
      </Section>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
