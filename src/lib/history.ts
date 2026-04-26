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

export function saveToHistory(batch: SendBatch) {
  const history = loadHistory();
  history.unshift(batch);
  // Keep last 100 batches
  if (history.length > 100) history.length = 100;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

export function deleteBatch(id: string) {
  const history = loadHistory().filter((b) => b.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}
