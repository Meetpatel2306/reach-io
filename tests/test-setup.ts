// Project-local test setup. Mirrors the shared testing-kit setup
// (inlined here so Vite resolves dependencies from the project's node_modules).

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// matchMedia stub
if (typeof window !== "undefined" && !("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
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

// Notification API stub
class NotificationStub {
  static permission: "granted" | "denied" | "default" = "default";
  static requestPermission = vi.fn(async () => NotificationStub.permission);
  title: string;
  options: NotificationOptions;
  onclick: ((this: Notification, ev: Event) => unknown) | null = null;
  constructor(title: string, options: NotificationOptions = {}) {
    this.title = title;
    this.options = options;
    NotificationStub.instances.push(this);
  }
  close() {}
  static instances: NotificationStub[] = [];
  static reset() {
    NotificationStub.instances = [];
    NotificationStub.permission = "default";
    NotificationStub.requestPermission.mockClear();
    NotificationStub.requestPermission.mockImplementation(async () => NotificationStub.permission);
  }
}
(globalThis as unknown as { Notification: typeof NotificationStub }).Notification = NotificationStub;

// Canvas stub
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, closePath: () => {}, fill: () => {},
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,STUB";
}

// Service Worker stub (used by updater.ts)
if (typeof navigator !== "undefined" && !("serviceWorker" in navigator)) {
  Object.defineProperty(navigator, "serviceWorker", {
    writable: true,
    value: {
      register: vi.fn(),
      getRegistrations: vi.fn(async () => []),
      getRegistration: vi.fn(async () => undefined),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
}

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  NotificationStub.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

export { NotificationStub };
