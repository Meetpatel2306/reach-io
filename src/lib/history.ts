export interface EmailResult {
  email: string;
  name: string;
  status: "sent" | "failed";
  error?: string;
}

export interface SendBatch {
  id: string;
  timestamp: string;
  subject: string;
  body: string;
  from: string;
  hasAttachment: boolean;
  attachmentName: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  results: EmailResult[];
  durationMs: number;
}

const HISTORY_KEY = "email-blaster-history";

export function loadHistory(): SendBatch[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// Custom event name — any component reading send history can listen to this
// and re-load when a new batch lands. Used by useRecipientHistoryIndex so
// the "already contacted" badge updates the instant a send completes.
export const HISTORY_UPDATED_EVENT = "eb-history-updated";

export function saveToHistory(batch: SendBatch) {
  const history = loadHistory();
  history.unshift(batch);
  // Keep last 100 batches
  if (history.length > 100) history.length = 100;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
  // Notify listeners (badge index, banners, etc.)
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
    }
  } catch {}
}

function dispatchHistoryUpdate() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
    }
  } catch {}
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
  dispatchHistoryUpdate();
}

// Pull the current user's history from the server and cache it into localStorage
// (the same key loadHistory reads). This is what makes history appear the same
// on every device: the server is the source of truth, localStorage is a cache.
// Returns the batches, or null if the fetch failed (offline / not logged in) —
// in which case the existing local cache is left untouched.
export async function hydrateHistoryFromServer(): Promise<SendBatch[] | null> {
  try {
    const res = await fetch("/api/history", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.batches)) return null;
    const batches = data.batches as SendBatch[];
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(batches.slice(0, 100))); } catch {}
    dispatchHistoryUpdate();
    return batches;
  } catch {
    return null;
  }
}

export function deleteBatch(id: string) {
  const history = loadHistory().filter((b) => b.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
  dispatchHistoryUpdate();
}
