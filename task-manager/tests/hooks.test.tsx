import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery, useIsMobile } from '@/hooks/useMediaQuery';
import { useDynamicIcon } from '@/hooks/useDynamicIcon';
import { useStore } from '@/lib/store';
import { DEFAULT_SETTINGS } from '@/lib/constants';

beforeEach(() => {
  useStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  document.documentElement.className = '';
  document.head.querySelectorAll('link[rel="icon"]').forEach((n) => n.remove());
});

describe('useTheme', () => {
  it('HK1: applies "dark" class to <html> when theme=dark', () => {
    useStore.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'dark' } });
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('HK2: removes "dark" class when theme=light', () => {
    useStore.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'light' } });
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('HK3: applies CSS vars from selected color theme', () => {
    useStore.setState({ settings: { ...DEFAULT_SETTINGS, colorTheme: 'rose' } });
    renderHook(() => useTheme());
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#f43f5e');
  });

  it('HK4: toggleTheme flips dark <-> light', () => {
    useStore.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'dark' } });
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    act(() => result.current.toggleTheme());
    rerender();
    expect(useStore.getState().settings.theme).toBe('light');
    act(() => result.current.toggleTheme());
    expect(useStore.getState().settings.theme).toBe('dark');
  });

  it('HK5: invalid colorTheme falls back to first theme', () => {
    useStore.setState({ settings: { ...DEFAULT_SETTINGS, colorTheme: 'nonexistent' } });
    renderHook(() => useTheme());
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#8b5cf6'); // violet
  });
});

describe('useMediaQuery', () => {
  let listeners: Array<(e: { matches: boolean }) => void> = [];

  beforeEach(() => {
    listeners = [];
    (window as any).matchMedia = (q: string) => {
      const mq = {
        matches: false,
        media: q,
        onchange: null,
        addEventListener: (_e: string, l: any) => listeners.push(l),
        removeEventListener: (_e: string, l: any) => {
          listeners = listeners.filter((x) => x !== l);
        },
      };
      return mq;
    };
  });

  it('HK6: returns initial matches value', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1px)'));
    expect(result.current).toBe(false);
  });

  it('HK7: updates when media query change event fires', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1px)'));
    expect(result.current).toBe(false);
    act(() => listeners.forEach((l) => l({ matches: true } as any)));
    expect(result.current).toBe(true);
  });

  it('HK8: useIsMobile resolves to a boolean', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe('boolean');
  });

  it('HK9: cleanup removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1px)'));
    expect(listeners).toHaveLength(1);
    unmount();
    expect(listeners).toHaveLength(0);
  });
});

describe('useDynamicIcon', () => {
  beforeEach(() => {
    // Provide canvas .toDataURL stub (jsdom does not implement <canvas> rendering)
    HTMLCanvasElement.prototype.getContext = function () {
      return {
        createLinearGradient: () => ({ addColorStop: () => {} }),
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillStyle: '',
      } as any;
    } as any;
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,STUB';
  });

  it('HK10: creates a favicon link element when none exists', () => {
    expect(document.querySelector('link[rel="icon"]')).toBeNull();
    renderHook(() => useDynamicIcon());
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('data:image/png');
  });

  it('HK11: updates the existing favicon href on color theme change', () => {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = 'old';
    document.head.appendChild(link);
    renderHook(() => useDynamicIcon());
    expect(link.href).toContain('data:image/png');
  });

  it('HK12: updates theme-color meta tag if present', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#000000');
    document.head.appendChild(meta);
    useStore.setState({ settings: { ...DEFAULT_SETTINGS, colorTheme: 'emerald' } });
    renderHook(() => useDynamicIcon());
    expect(meta.getAttribute('content')).toBe('#10b981');
    meta.remove();
  });
});
