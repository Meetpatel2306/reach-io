// Generic jsdom setup shared across React/Next.js projects.
// Loaded automatically by createVitestConfig — every test file gets all of these stubs for free.

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

// ── Canvas stub (favicons, dynamic icons, charting libs) ──
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => ({}),
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, bezierCurveTo: () => {},
      closePath: () => {}, fill: () => {}, stroke: () => {},
      arc: () => {}, arcTo: () => {}, rect: () => {},
      fillRect: () => {}, clearRect: () => {}, strokeRect: () => {},
      save: () => {}, restore: () => {},
      translate: () => {}, rotate: () => {}, scale: () => {},
      setTransform: () => {}, transform: () => {},
      drawImage: () => {},
      fillText: () => {}, strokeText: () => {},
      measureText: () => ({ width: 0 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    } as any;
  } as any;
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,STUB';
  HTMLCanvasElement.prototype.toBlob = function (cb: any) {
    cb(new Blob(['STUB'], { type: 'image/png' }));
  } as any;
}

// ── ResizeObserver stub (used by Radix UI, charting libs, virtualization) ──
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
}

// ── IntersectionObserver stub (used by lazy-load, infinite scroll, "in view" hooks) ──
if (typeof globalThis.IntersectionObserver === 'undefined') {
  (globalThis as any).IntersectionObserver = class {
    root = null; rootMargin = ''; thresholds: number[] = [];
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  };
}

// ── MutationObserver — jsdom has it, but ensure consistent behavior ──
if (typeof globalThis.MutationObserver === 'undefined') {
  (globalThis as any).MutationObserver = class {
    observe() {} disconnect() {} takeRecords() { return []; }
  };
}

// ── scrollTo / scrollIntoView (jsdom doesn't implement these) ──
if (typeof window !== 'undefined') {
  window.scrollTo = window.scrollTo ?? (() => {});
  (window as any).scroll = (window as any).scroll ?? (() => {});
}
if (typeof Element !== 'undefined') {
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
}

// ── Clipboard API stub (capturable copies) ──
const clipboardCalls: { type: 'write' | 'writeText' | 'read' | 'readText'; value?: any }[] = [];
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn(async (v: string) => { clipboardCalls.push({ type: 'writeText', value: v }); }),
      readText: vi.fn(async () => clipboardCalls.findLast?.((c) => c.type === 'writeText')?.value ?? ''),
      write: vi.fn(async (v: any) => { clipboardCalls.push({ type: 'write', value: v }); }),
      read: vi.fn(async () => []),
    },
  });
}
export function getClipboardCalls() { return [...clipboardCalls]; }
export function clearClipboardCalls() { clipboardCalls.length = 0; }

// ── IndexedDB stub — minimal in-memory; for richer behavior install `fake-indexeddb` ──
if (typeof globalThis.indexedDB === 'undefined') {
  (globalThis as any).indexedDB = {
    open: () => {
      const req: any = {
        result: {
          objectStoreNames: { contains: () => false },
          createObjectStore: () => ({}),
          transaction: () => ({
            objectStore: () => ({
              put: () => ({}), get: () => ({}), getAll: () => ({}), delete: () => ({}), clear: () => ({}),
            }),
            oncomplete: null, onerror: null,
          }),
          close: () => {},
        },
        onsuccess: null, onerror: null, onupgradeneeded: null,
      };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    },
    deleteDatabase: () => ({}),
  };
}

// ── BroadcastChannel stub (used by service-worker comms) ──
if (typeof globalThis.BroadcastChannel === 'undefined') {
  (globalThis as any).BroadcastChannel = class {
    name: string;
    onmessage: ((e: MessageEvent) => void) | null = null;
    constructor(name: string) { this.name = name; }
    postMessage() {} close() {} addEventListener() {} removeEventListener() {}
  };
}

// ── URL.createObjectURL / revokeObjectURL (file uploads, blob preview) ──
if (typeof URL !== 'undefined') {
  if (!URL.createObjectURL) (URL as any).createObjectURL = () => 'blob:stub';
  if (!URL.revokeObjectURL) (URL as any).revokeObjectURL = () => {};
}

// ── crypto.randomUUID polyfill for older jsdom builds ──
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  (crypto as any).randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}

// ── Fresh state between tests ──
beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  NotificationStub.reset();
  clearClipboardCalls();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

export { NotificationStub, AudioContextStub };
