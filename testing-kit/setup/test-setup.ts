// Generic jsdom setup shared across React/Next.js projects.
// Drop this in any project that uses vitest + jsdom + Notification API.
//
// In your project's vitest.config: setupFiles: ['<path-to-this-file>']

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

// ── matchMedia (used by useMediaQuery, theme code) ──
if (typeof window !== 'undefined' && !('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// ── Notification API stub ──
class NotificationStub {
  static permission: 'granted' | 'denied' | 'default' = 'default';
  static requestPermission = vi.fn(async () => NotificationStub.permission);
  title: string;
  options: NotificationOptions;
  onclick: ((this: Notification, ev: Event) => any) | null = null;
  constructor(title: string, options: NotificationOptions = {}) {
    this.title = title;
    this.options = options;
    NotificationStub.instances.push(this);
  }
  close() {}
  static instances: NotificationStub[] = [];
  static reset() {
    NotificationStub.instances = [];
    NotificationStub.permission = 'default';
    NotificationStub.requestPermission.mockClear();
    NotificationStub.requestPermission.mockImplementation(async () => NotificationStub.permission);
  }
}
(globalThis as any).Notification = NotificationStub;

// ── AudioContext stub (for any audio-using code) ──
class AudioContextStub {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => { this.state = 'running'; });
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} }; }
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      Q: { setValueAtTime: () => {} },
      connect: () => {},
    };
  }
  get sampleRate() { return 44100; }
}
if (typeof window !== 'undefined') {
  (window as any).AudioContext = AudioContextStub;
  (window as any).webkitAudioContext = AudioContextStub;
}

// ── Canvas stub (favicons, dynamic icons) ──
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, closePath: () => {}, fill: () => {},
      fillStyle: '',
    } as any;
  } as any;
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,STUB';
}

// ── Fresh state between tests ──
beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  NotificationStub.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

export { NotificationStub, AudioContextStub };
