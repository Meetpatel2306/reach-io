import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

// Stub window.matchMedia (used by useMediaQuery, theme code)
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

// Stub Notification API — jsdom does not implement it
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

// Stub AudioContext (used by playNotificationSound)
class AudioContextStub {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => { this.state = 'running'; });
  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
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
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBufferSource() {
    return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} };
  }
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
(window as any).AudioContext = AudioContextStub;
(window as any).webkitAudioContext = AudioContextStub;

beforeEach(() => {
  // Fresh localStorage between tests
  try { localStorage.clear(); } catch {}
  NotificationStub.reset();
});

afterEach(() => {
  vi.useRealTimers();
});
