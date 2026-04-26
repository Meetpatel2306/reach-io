// Per-user localStorage scoping.
// All app data (SMTP, OAuth, history, drafts) is keyed under the current user's email.
// Switching accounts → different namespace → no data leakage.

const APP_KEYS = [
  "email-blaster-state",        // draft (subject, body, recipients, resume)
  "email-blaster-history",      // send history (UI)
  "email-blaster-smtp",         // SMTP credentials
  "email-blaster-google-oauth", // OAuth tokens
  "email-blaster-version",      // version tracking
];

// Anchors current user; if it doesn't match server, wipe all keys
const CURRENT_USER_KEY = "email-blaster-current-user";

export function clearUserData() {
  try {
    for (const key of APP_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {}
}

// Call on every page load with the server-confirmed user email.
// If it differs from previously stored "current user", wipe localStorage.
// This prevents seeing leftover data from a previous logged-in account.
export function syncCurrentUser(serverEmail: string | null) {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);

    if (!serverEmail) {
      // Logged out — clear everything
      if (stored) clearUserData();
      return;
    }

    if (stored && stored !== serverEmail) {
      // Different user — clear previous user's data
      clearUserData();
    }

    // Anchor the current user
    localStorage.setItem(CURRENT_USER_KEY, serverEmail);
  } catch {}
}
