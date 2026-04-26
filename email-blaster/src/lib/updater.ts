// Client-side update detection — works on iOS PWA + Android + Desktop

const VERSION_KEY = "email-blaster-version";
const VERSION_CHECK_INTERVAL = 30000; // 30 seconds

interface VersionInfo {
  version: string;
  buildTime: string;
  notes?: string;
}

export async function fetchLatestVersion(): Promise<VersionInfo | null> {
  try {
    // Cache-busting query param ensures we get fresh data, never SW cache
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function getStoredVersion(): string | null {
  try { return localStorage.getItem(VERSION_KEY); } catch { return null; }
}

export function setStoredVersion(version: string) {
  try { localStorage.setItem(VERSION_KEY, version); } catch {}
}

// Returns true if a new version is available
export async function checkForUpdate(): Promise<{ hasUpdate: boolean; latest?: VersionInfo }> {
  const latest = await fetchLatestVersion();
  if (!latest) return { hasUpdate: false };

  const stored = getStoredVersion();
  if (!stored) {
    setStoredVersion(latest.version);
    return { hasUpdate: false, latest };
  }

  return { hasUpdate: stored !== latest.version, latest };
}

// Apply the update: clear caches, unregister old SW, reload
export async function applyUpdate(latestVersion?: string) {
  try {
    // Tell SW to activate the new version
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      // Force update check
      await reg?.update();
    }

    // Clear all caches manually (extra safety for iOS)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // Update stored version
    if (latestVersion) setStoredVersion(latestVersion);
  } catch {}

  // Reload with cache-busting
  window.location.reload();
}

// Setup automatic update polling (works on both iOS + Android)
export function setupAutoUpdateCheck(onUpdateAvailable: (info: VersionInfo) => void) {
  let lastCheck = 0;

  const doCheck = async () => {
    if (Date.now() - lastCheck < 5000) return; // throttle
    lastCheck = Date.now();
    const { hasUpdate, latest } = await checkForUpdate();
    if (hasUpdate && latest) onUpdateAvailable(latest);
  };

  // Initial check
  doCheck();

  // Periodic check (every 30 seconds)
  const interval = setInterval(doCheck, VERSION_CHECK_INTERVAL);

  // Check when tab becomes visible (iOS PWA reopen, Android resume)
  const onVisible = () => {
    if (document.visibilityState === "visible") doCheck();
  };
  document.addEventListener("visibilitychange", onVisible);

  // Check on window focus
  const onFocus = () => doCheck();
  window.addEventListener("focus", onFocus);

  // Check on online (after offline)
  const onOnline = () => doCheck();
  window.addEventListener("online", onOnline);

  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
  };
}
