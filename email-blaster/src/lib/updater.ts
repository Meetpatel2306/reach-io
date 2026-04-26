// Client-side update detection — works on iOS PWA + Android + Desktop
// IMPORTANT: localStorage data is NEVER touched. SMTP creds, history, drafts all preserved.

const VERSION_KEY = "email-blaster-version";
const AUTO_UPDATE_KEY = "email-blaster-auto-update";
const VERSION_CHECK_INTERVAL = 30000; // 30 seconds

interface VersionInfo {
  version: string;
  buildTime: string;
  notes?: string;
}

export async function fetchLatestVersion(): Promise<VersionInfo | null> {
  try {
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

export function getAutoUpdate(): boolean {
  try {
    const v = localStorage.getItem(AUTO_UPDATE_KEY);
    // Default: ON (auto-update enabled by default)
    return v !== "0";
  } catch { return true; }
}

export function setAutoUpdate(enabled: boolean) {
  try { localStorage.setItem(AUTO_UPDATE_KEY, enabled ? "1" : "0"); } catch {}
}

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

// Apply the update — clears CACHES ONLY (localStorage preserved)
export async function applyUpdate(latestVersion?: string) {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      await reg?.update();
    }

    // Clear ONLY service-worker caches — localStorage stays intact
    // Your SMTP credentials, send history, drafts, and settings are preserved.
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    if (latestVersion) setStoredVersion(latestVersion);
  } catch {}

  window.location.reload();
}

interface AutoUpdateOptions {
  onUpdateAvailable: (info: VersionInfo) => void;
  onAutoUpdating?: (info: VersionInfo) => void; // Called right before silent auto-update
}

// Setup automatic update polling.
// If auto-update is enabled and the app is in background/just-opened,
// silently apply the update without user interaction.
export function setupAutoUpdateCheck(opts: AutoUpdateOptions) {
  let lastCheck = 0;
  let pendingUpdate: VersionInfo | null = null;

  const doCheck = async (canAutoApply: boolean = false) => {
    if (Date.now() - lastCheck < 5000) return;
    lastCheck = Date.now();
    const { hasUpdate, latest } = await checkForUpdate();
    if (!hasUpdate || !latest) return;

    pendingUpdate = latest;

    // If auto-update is enabled AND we can safely apply (page just got focus / hidden),
    // do silent auto-update
    if (canAutoApply && getAutoUpdate()) {
      opts.onAutoUpdating?.(latest);
      await applyUpdate(latest.version);
      return;
    }

    // Otherwise show the manual update banner
    opts.onUpdateAvailable(latest);
  };

  // Initial check (no auto-apply on first load — let user see the banner if they want)
  doCheck(false);

  // Periodic check (no auto-apply during active use)
  const interval = setInterval(() => doCheck(false), VERSION_CHECK_INTERVAL);

  // When tab becomes visible again — auto-apply if enabled
  // (User reopened the PWA, perfect time to silently update)
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      // Small delay to let page settle
      setTimeout(() => doCheck(true), 500);
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  // Window focus — also good time for auto-update
  const onFocus = () => {
    setTimeout(() => doCheck(true), 500);
  };
  window.addEventListener("focus", onFocus);

  // Online — refresh check (no auto-apply, user might be in middle of something)
  const onOnline = () => doCheck(false);
  window.addEventListener("online", onOnline);

  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
  };
}

export function getPendingUpdateVersion(): string | null {
  return getStoredVersion();
}
