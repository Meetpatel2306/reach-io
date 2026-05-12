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

export function deleteBatch(id: string) {
  const history = loadHistory().filter((b) => b.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
  dispatchHistoryUpdate();
}
