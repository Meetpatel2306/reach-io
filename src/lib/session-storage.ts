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
// Only wipes when a DIFFERENT user is positively confirmed logged in — this
// prevents cross-account data leakage WITHOUT wiping your data on a transient
// /api/auth/me hiccup or an expired session (the old code wiped on any null
// result, which silently ate your Google connection / SMTP / drafts and looked
// like a random logout). Genuine sign-out clears data explicitly via clearUserData().
export function syncCurrentUser(serverEmail: string | null) {
  try {
    // Unknown/failed check → do nothing. Never wipe on absence of confirmation.
    if (!serverEmail) return;

    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored && stored !== serverEmail) {
      // A different account is now logged in on this browser — clear the old one's data.
      clearUserData();
    }
    localStorage.setItem(CURRENT_USER_KEY, serverEmail);
  } catch {}
}
