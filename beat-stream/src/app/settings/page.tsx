"use client";
import { useEffect, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/contexts/ToastContext";
import { history, searches, store, STORAGE_KEYS, downloads, songCache, recent, counts } from "@/lib/storage";
import { audioCache } from "@/lib/audioCache";
import type { AccentColor, Quality, Theme } from "@/lib/types";

const AVATARS = ["🎧", "🎵", "🎸", "🎤", "🎹", "🥁", "🎺", "🎻", "🎼"];

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const [audioSize, setAudioSize] = useState<number>(0);

  useEffect(() => {
    audioCache.size().then(setAudioSize);
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
    if (!confirm("This will erase ALL data — settings, library, history. Continue?")) return;
    Object.values(STORAGE_KEYS).forEach((k) => store.remove(k));
    audioCache.clear();
    toast("All data cleared — reload page", "success");
    setTimeout(() => window.location.reload(), 1000);
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
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition ${value ? "bg-accent" : "bg-white/20"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? "left-5" : "left-0.5"}`} />
    </button>
  );

  const QUALITIES: Quality[] = ["12kbps", "48kbps", "96kbps", "160kbps", "320kbps"];
  const ACCENTS: { key: AccentColor; color: string }[] = [
    { key: "emerald", color: "#10b981" },
    { key: "blue", color: "#3b82f6" },
    { key: "purple", color: "#a855f7" },
    { key: "red", color: "#ef4444" },
    { key: "orange", color: "#f97316" },
    { key: "pink", color: "#ec4899" },
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Section title="Profile">
        <Row label="Display Name">
          <input
            value={settings.displayName}
            onChange={(e) => update({ displayName: e.target.value })}
            className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm w-44 outline-none focus:border-accent"
          />
        </Row>
        <Row label="Avatar">
          <div className="flex flex-wrap gap-1 max-w-xs">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => update({ avatar: a })}
                className={`w-9 h-9 rounded-full text-lg flex items-center justify-center ${settings.avatar === a ? "bg-accent" : "bg-white/5 hover:bg-white/15"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Playback">
        <Row label="Audio Quality" hint="Streaming bitrate">
          <select value={settings.quality} onChange={(e) => update({ quality: e.target.value as Quality })} className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm">
            {QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </Row>
        <Row label="Download Quality">
          <select value={settings.downloadQuality} onChange={(e) => update({ downloadQuality: e.target.value as Quality })} className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm">
            {QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </Row>
        <Row label="Crossfade" hint={`${settings.crossfade}s`}>
          <input
            type="range" min={0} max={12}
            value={settings.crossfade}
            onChange={(e) => update({ crossfade: parseInt(e.target.value, 10) })}
            className="range range-accent w-32"
            style={{ ["--val" as string]: `${(settings.crossfade / 12) * 100}%` }}
          />
        </Row>
        <Row label="Gapless Playback"><Toggle value={settings.gapless} onChange={(v) => update({ gapless: v })} /></Row>
        <Row label="Normalize Volume"><Toggle value={settings.normalize} onChange={(v) => update({ normalize: v })} /></Row>
        <Row label="Autoplay similar songs" hint="When the queue ends"><Toggle value={settings.autoplay} onChange={(v) => update({ autoplay: v })} /></Row>
      </Section>

      <Section title="Display">
        <Row label="Theme">
          <select value={settings.theme} onChange={(e) => update({ theme: e.target.value as Theme })} className="bg-bg border border-white/10 rounded px-3 py-1.5 text-sm">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="amoled">AMOLED Black</option>
            <option value="system">System</option>
          </select>
        </Row>
        <Row label="Accent Color">
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                onClick={() => update({ accentColor: a.key })}
                className={`w-7 h-7 rounded-full transition ${settings.accentColor === a.key ? "ring-2 ring-white ring-offset-2 ring-offset-card" : ""}`}
                style={{ background: a.color }}
              />
            ))}
          </div>
        </Row>
        <Row label="Compact Mode"><Toggle value={settings.compact} onChange={(v) => update({ compact: v })} /></Row>
        <Row label="Show Explicit Content"><Toggle value={settings.showExplicit} onChange={(v) => update({ showExplicit: v })} /></Row>
      </Section>

      <Section title="Data & Storage">
        <Row label="Cache Size" hint={bytes(audioSize)}>
          <button onClick={clearCache} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">Clear cache</button>
        </Row>
        <Row label="Search History">
          <button onClick={() => { searches.clear(); toast("Search history cleared", "success"); }} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">Clear</button>
        </Row>
        <Row label="Play History">
          <button onClick={() => { history.clear(); recent.clear(); counts.clear(); toast("Play history cleared", "success"); }} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">Clear</button>
        </Row>
        <Row label="Reset all data" hint="Erases settings, library, history">
          <button onClick={clearAllData} className="text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded">Factory reset</button>
        </Row>
      </Section>

      <Section title="Keyboard Shortcuts">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
          {[
            ["Space", "Play / Pause"],
            ["→", "Skip 10 seconds"],
            ["←", "Rewind 10 seconds"],
            ["Shift + →", "Next song"],
            ["Shift + ←", "Previous song"],
            ["↑ / ↓", "Volume up/down"],
            ["M", "Mute"],
            ["L", "Like current song"],
            ["Q", "Toggle queue"],
            ["F", "Fullscreen player"],
            ["/", "Focus search"],
          ].map(([k, d]) => (
            <div key={k} className="flex items-center gap-3">
              <kbd className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono min-w-[60px] text-center">{k}</kbd>
              <span className="text-secondary">{d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="About">
        <Row label="Version"><span className="text-secondary text-sm">1.0.0</span></Row>
        <Row label="Data Source"><span className="text-secondary text-sm">JioSaavn (saavn.dev)</span></Row>
      </Section>
    </div>
  );
}
