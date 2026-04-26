// Update detection — works on iOS PWA + Android + Desktop
// localStorage data is NEVER touched. SMTP creds, history, drafts all preserved.

const AUTO_UPDATE_KEY = "email-blaster-auto-update";
const VERSION_CHECK_INTERVAL = 30000;

// Bundled version — baked into the JS at build time from public/version.json.
// This is the SOURCE OF TRUTH for "what version am I running".
export const BUNDLED_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
export const BUNDLED_BUILD_TIME = process.env.NEXT_PUBLIC_APP_BUILD_TIME || "";

interface VersionInfo {
  version: string;
  buildTime: string;
  notes?: string;
}

export async function fetchLatestVersion(): Promise<VersionInfo | null> {
  try {
    // Aggressive cache busting — query param + no-store headers
    const res = await fetch(`/version.json?t=${Date.now()}&r=${Math.random()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function getAutoUpdate(): boolean {
  try {
    const v = localStorage.getItem(AUTO_UPDATE_KEY);
    return v !== "0";
  } catch { return true; }
}

export function setAutoUpdate(enabled: boolean) {
  try { localStorage.setItem(AUTO_UPDATE_KEY, enabled ? "1" : "0"); } catch {}
}

export async function checkForUpdate(): Promise<{ hasUpdate: boolean; latest?: VersionInfo; current: string }> {
  const latest = await fetchLatestVersion();
  if (!latest) return { hasUpdate: false, current: BUNDLED_VERSION };

  // Compare BUNDLED version (what's actually running) with LATEST (what server has)
  // This is reliable — bundled version is baked into the JS at build time
  return {
    hasUpdate: BUNDLED_VERSION !== latest.version,
    latest,
    current: BUNDLED_VERSION,
  };
}

// Aggressive update: unregister SW + clear all caches + force reload
export async function applyUpdate() {
  try {
    // 1. Unregister all service workers
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    // 2. Clear ALL caches (localStorage stays intact)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}

  // 3. Force reload bypassing cache (cache-busting query param ensures fresh fetch)
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
}

interface AutoUpdateOptions {
  onUpdateAvailable: (info: VersionInfo) => void;
  onAutoUpdating?: (info: VersionInfo) => void;
}

export function setupAutoUpdateCheck(opts: AutoUpdateOptions) {
  let lastCheck = 0;

  const doCheck = async (canAutoApply: boolean = false) => {
    if (Date.now() - lastCheck < 5000) return;
    lastCheck = Date.now();
    const { hasUpdate, latest } = await checkForUpdate();
    if (!hasUpdate || !latest) return;

    if (canAutoApply && getAutoUpdate()) {
      opts.onAutoUpdating?.(latest);
      await applyUpdate();
      return;
    }

    opts.onUpdateAvailable(latest);
  };

  // Initial check on load
  doCheck(false);

  // Periodic checks
  const interval = setInterval(() => doCheck(false), VERSION_CHECK_INTERVAL);

  // On visibility/focus — auto-apply if enabled
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      setTimeout(() => doCheck(true), 500);
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  const onFocus = () => setTimeout(() => doCheck(true), 500);
  window.addEventListener("focus", onFocus);

  const onOnline = () => doCheck(false);
  window.addEventListener("online", onOnline);

  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
  };
}
