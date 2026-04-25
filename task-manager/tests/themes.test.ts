import { describe, it, expect } from 'vitest';
import { COLOR_THEMES, BG_EFFECTS, getTheme, applyColorTheme } from '@/lib/themes';

describe('themes — color themes', () => {
  it('TH1: COLOR_THEMES has at least 25 themes', () => {
    expect(COLOR_THEMES.length).toBeGreaterThanOrEqual(25);
  });

  it('TH2: every color theme has unique id', () => {
    const ids = COLOR_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('TH3: every color theme has the required color fields', () => {
    for (const t of COLOR_THEMES) {
      expect(t.colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.colors.primaryLight).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.colors.primaryDark).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.colors.gradient).toContain('linear-gradient');
      expect(t.colors.bgGradient).toContain('radial-gradient');
      expect(t.colors.glow.startsWith('rgba(')).toBe(true);
    }
  });

  it('TH4: every color theme has a non-empty name and icon', () => {
    for (const t of COLOR_THEMES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
    }
  });

  it('TH5: getTheme returns the matching theme by id', () => {
    expect(getTheme('violet').id).toBe('violet');
  });

  it('TH6: getTheme falls back to first theme for unknown id', () => {
    expect(getTheme('does-not-exist').id).toBe(COLOR_THEMES[0].id);
  });

  it('TH7: getTheme returns first theme when given empty string', () => {
    expect(getTheme('').id).toBe(COLOR_THEMES[0].id);
  });

  it('TH8: applyColorTheme writes CSS custom properties', () => {
    applyColorTheme(getTheme('emerald'));
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--accent-primary')).toBe('#10b981');
    expect(root.style.getPropertyValue('--accent-gradient')).toContain('#10b981');
  });

  it('TH9: applyColorTheme overwrites previous theme values', () => {
    applyColorTheme(getTheme('emerald'));
    applyColorTheme(getTheme('violet'));
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#8b5cf6');
  });
});

describe('themes — background effects', () => {
  it('TH10: BG_EFFECTS includes "none" option', () => {
    expect(BG_EFFECTS.find((b) => b.id === 'none')).toBeTruthy();
  });

  it('TH11: every bg effect has unique id', () => {
    const ids = BG_EFFECTS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('TH12: every bg effect has name + icon', () => {
    for (const b of BG_EFFECTS) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.icon.length).toBeGreaterThan(0);
    }
  });
});
