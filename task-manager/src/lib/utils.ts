export function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return 'Invalid date'; }
}

export function formatTime(date: string | Date): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return '--:--'; }
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

export function formatRelative(date: string | Date): string {
  try {
    const now = new Date();
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'unknown';
    const diff = d.getTime() - now.getTime();
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(absDiff / 3600000);
    const days = Math.floor(absDiff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return diff > 0 ? `in ${minutes}m` : `${minutes}m ago`;
    if (hours < 24) return diff > 0 ? `in ${hours}h` : `${hours}h ago`;
    if (days < 7) return diff > 0 ? `in ${days}d` : `${days}d ago`;
    return formatDate(date);
  } catch { return 'unknown'; }
}

export function isToday(date: string | Date): boolean {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  } catch { return false; }
}

export function isOverdue(date: string | Date): boolean {
  try {
    const d = new Date(date);
    return !isNaN(d.getTime()) && d < new Date();
  } catch { return false; }
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + 's');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* download failed silently */ }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) { reject(new Error('File too large (max 10MB)')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    const timeout = setTimeout(() => { reader.abort(); reject(new Error('File read timeout')); }, 30000);
    reader.onloadend = () => clearTimeout(timeout);
    reader.readAsText(file);
  });
}

export function safeLocalStorage(key: string, fallback: string = ''): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

export function safeLocalStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded or private browsing */ }
}
