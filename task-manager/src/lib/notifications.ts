'use client';

let audioContext: AudioContext | null = null;
let audioInitialized = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioContext) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioContext = new AC();
    }
    return audioContext;
  } catch { return null; }
}

export function getNotificationStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export function sendNotification(title: string, body: string, tag?: string): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag || 'task-notification',
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Notification API not available in this context
  }
}

function playNote(ctx: AudioContext, freq: number, t: number, dur: number, vol: number, type: 'marimba' | 'crystal' | 'bubble' | 'wind' | 'pluck') {
  const master = ctx.createGain();
  master.connect(ctx.destination);
  master.gain.setValueAtTime(0, t);

  if (type === 'marimba') {
    // Warm marimba: sine + triangle, fast attack, medium decay, soft sub
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);
    const g1 = ctx.createGain();
    osc1.connect(g1); g1.connect(master);
    g1.gain.setValueAtTime(vol, t);
    g1.gain.exponentialRampToValueAtTime(vol * 0.4, t + dur * 0.15);
    g1.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc1.start(t); osc1.stop(t + dur);

    // Warmth — triangle 1 octave below
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 0.5, t);
    const g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(master);
    g2.gain.setValueAtTime(vol * 0.35, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
    osc2.start(t); osc2.stop(t + dur);

    // Click transient — noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    noise.connect(ng); ng.connect(master);
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    noise.start(t); noise.stop(t + 0.03);

    master.gain.setValueAtTime(1, t);
  }

  else if (type === 'crystal') {
    // Sparkly glass: high sine + shimmer harmonics
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);
    const g1 = ctx.createGain();
    osc1.connect(g1); g1.connect(master);
    g1.gain.setValueAtTime(vol * 0.7, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc1.start(t); osc1.stop(t + dur);

    // Shimmer — detuned sine
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.01, t);
    const g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(master);
    g2.gain.setValueAtTime(vol * 0.2, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
    osc2.start(t); osc2.stop(t + dur);

    // 3rd partial
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, t);
    const g3 = ctx.createGain();
    osc3.connect(g3); g3.connect(master);
    g3.gain.setValueAtTime(vol * 0.08, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.4);
    osc3.start(t); osc3.stop(t + dur);

    master.gain.setValueAtTime(1, t);
  }

  else if (type === 'bubble') {
    // Bubbly water drop: freq glide down
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.8, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.3);
    const g = ctx.createGain();
    osc.connect(g); g.connect(master);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.2, t + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
    master.gain.setValueAtTime(1, t);
  }

  else if (type === 'wind') {
    // Soft breathy pad
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    osc.connect(g); g.connect(master);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);

    // Sub rumble
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq * 0.25, t);
    const sg = ctx.createGain();
    sub.connect(sg); sg.connect(master);
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(vol * 0.2, t + dur * 0.4);
    sg.gain.exponentialRampToValueAtTime(0.001, t + dur);
    sub.start(t); sub.stop(t + dur);

    master.gain.setValueAtTime(1, t);
  }

  else if (type === 'pluck') {
    // Guitar-like pluck: square with fast decay + filter
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur * 0.3);
    filter.Q.setValueAtTime(1, t);
    const g = ctx.createGain();
    osc.connect(filter); filter.connect(g); g.connect(master);
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.15, t + dur * 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
    master.gain.setValueAtTime(1, t);
  }
}

export async function playNotificationSound(_priority?: string, enabled?: boolean): Promise<void> {
  if (enabled === false || typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // Force resume — this is critical for mobile and backgrounded tabs
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return; // Still suspended, can't play
    const t = ctx.currentTime;

    // Loud attention-grabbing chime — 3 rounds
    // C5 → E5 → G5 → C6 ascending
    const notes = [523, 659, 784, 1047];

    // Round 1 — Full volume marimba + crystal
    notes.forEach((f, i) => {
      playNote(ctx, f, t + i * 0.12, 0.6, 0.55, 'marimba');
      playNote(ctx, f * 2, t + i * 0.12, 0.5, 0.2, 'crystal');
    });

    // Round 2 — Slightly softer echo
    notes.forEach((f, i) => {
      playNote(ctx, f, t + 0.75 + i * 0.12, 0.55, 0.4, 'marimba');
      playNote(ctx, f * 2, t + 0.75 + i * 0.12, 0.45, 0.12, 'crystal');
    });

    // Round 3 — Final fade
    notes.forEach((f, i) => {
      playNote(ctx, f, t + 1.5 + i * 0.12, 0.5, 0.25, 'marimba');
    });
  } catch {
    // Audio not available
  }
}

export function initAudioOnInteraction(): void {
  if (typeof window === 'undefined' || audioInitialized) return;
  audioInitialized = true;
  const handler = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch {}
    document.removeEventListener('click', handler);
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('click', handler, { once: false, passive: true });
  document.addEventListener('touchstart', handler, { once: false, passive: true });
  document.addEventListener('keydown', handler, { once: false, passive: true });
}
