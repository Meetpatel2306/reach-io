"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Settings } from "@/lib/types";
import { defaultSettings, defaultEqualizer, defaultEnhancement, store, STORAGE_KEYS } from "@/lib/storage";

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    const stored = store.read<Settings>(STORAGE_KEYS.settings, defaultSettings);
    setSettings({
      ...defaultSettings,
      ...stored,
      equalizer: { ...defaultEqualizer, ...(stored.equalizer || {}) },
      enhancement: { ...defaultEnhancement, ...(stored.enhancement || {}) },
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let theme = settings.theme;
    if (theme === "system") {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    root.dataset.theme = theme;
    root.dataset.accent = settings.accentColor;
    root.dataset.compact = String(settings.compact);
    root.dataset.animations = String(settings.animations);
  }, [settings.theme, settings.accentColor, settings.compact, settings.animations]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      store.write(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  return <SettingsCtx.Provider value={{ settings, update }}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
