'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getTheme, applyColorTheme } from '@/lib/themes';

export function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const colorTheme = useStore((s) => s.settings.colorTheme);
  const updateSettings = useStore((s) => s.updateSettings);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    const ct = getTheme(colorTheme || 'violet');
    applyColorTheme(ct);
  }, [colorTheme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: next });
  };

  return { theme, toggleTheme, colorTheme };
}
