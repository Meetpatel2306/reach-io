export interface ColorTheme {
  id: string;
  name: string;
  icon: string;
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    glow: string;
    gradient: string;
    bgGradient: string;
  };
}

export const COLOR_THEMES: ColorTheme[] = [
  // ── Originals ──
  { id: 'violet', name: 'Violet', icon: '💜', colors: { primary: '#8b5cf6', primaryLight: '#a78bfa', primaryDark: '#7c3aed', glow: 'rgba(139,92,246,.25)', gradient: 'linear-gradient(135deg,#8b5cf6,#a855f7)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(139,92,246,.12) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(168,85,247,.08) 0%,transparent 50%)' } },
  { id: 'claude', name: 'Claude', icon: '🤖', colors: { primary: '#d97706', primaryLight: '#f59e0b', primaryDark: '#b45309', glow: 'rgba(217,119,6,.25)', gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(217,119,6,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(245,158,11,.06) 0%,transparent 50%)' } },
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', colors: { primary: '#25d366', primaryLight: '#4ade80', primaryDark: '#16a34a', glow: 'rgba(37,211,102,.25)', gradient: 'linear-gradient(135deg,#25d366,#4ade80)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(37,211,102,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(74,222,128,.06) 0%,transparent 50%)' } },
  { id: 'ocean', name: 'Ocean', icon: '🌊', colors: { primary: '#0ea5e9', primaryLight: '#38bdf8', primaryDark: '#0284c7', glow: 'rgba(14,165,233,.25)', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(14,165,233,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(56,189,248,.06) 0%,transparent 50%)' } },
  { id: 'rose', name: 'Rose', icon: '🌸', colors: { primary: '#f43f5e', primaryLight: '#fb7185', primaryDark: '#e11d48', glow: 'rgba(244,63,94,.25)', gradient: 'linear-gradient(135deg,#f43f5e,#fb7185)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(244,63,94,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(251,113,133,.06) 0%,transparent 50%)' } },
  { id: 'emerald', name: 'Emerald', icon: '💎', colors: { primary: '#10b981', primaryLight: '#34d399', primaryDark: '#059669', glow: 'rgba(16,185,129,.25)', gradient: 'linear-gradient(135deg,#10b981,#34d399)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(16,185,129,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(52,211,153,.06) 0%,transparent 50%)' } },
  { id: 'sunset', name: 'Sunset', icon: '🌅', colors: { primary: '#f97316', primaryLight: '#fb923c', primaryDark: '#ea580c', glow: 'rgba(249,115,22,.25)', gradient: 'linear-gradient(135deg,#f97316,#fb923c)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(249,115,22,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(251,146,60,.06) 0%,transparent 50%)' } },
  { id: 'indigo', name: 'Indigo', icon: '🔮', colors: { primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5', glow: 'rgba(99,102,241,.25)', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(99,102,241,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(129,140,248,.06) 0%,transparent 50%)' } },
  { id: 'crimson', name: 'Crimson', icon: '🩸', colors: { primary: '#dc2626', primaryLight: '#ef4444', primaryDark: '#b91c1c', glow: 'rgba(220,38,38,.25)', gradient: 'linear-gradient(135deg,#dc2626,#ef4444)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(220,38,38,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(239,68,68,.06) 0%,transparent 50%)' } },
  { id: 'teal', name: 'Teal', icon: '🐬', colors: { primary: '#14b8a6', primaryLight: '#2dd4bf', primaryDark: '#0d9488', glow: 'rgba(20,184,166,.25)', gradient: 'linear-gradient(135deg,#14b8a6,#2dd4bf)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(20,184,166,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(45,212,191,.06) 0%,transparent 50%)' } },
  { id: 'amber', name: 'Gold', icon: '⭐', colors: { primary: '#eab308', primaryLight: '#facc15', primaryDark: '#ca8a04', glow: 'rgba(234,179,8,.25)', gradient: 'linear-gradient(135deg,#eab308,#facc15)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(234,179,8,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(250,204,21,.06) 0%,transparent 50%)' } },
  { id: 'cyan', name: 'Cyan', icon: '🧊', colors: { primary: '#06b6d4', primaryLight: '#22d3ee', primaryDark: '#0891b2', glow: 'rgba(6,182,212,.25)', gradient: 'linear-gradient(135deg,#06b6d4,#22d3ee)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(6,182,212,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(34,211,238,.06) 0%,transparent 50%)' } },
  { id: 'fuchsia', name: 'Fuchsia', icon: '🪻', colors: { primary: '#d946ef', primaryLight: '#e879f9', primaryDark: '#c026d3', glow: 'rgba(217,70,239,.25)', gradient: 'linear-gradient(135deg,#d946ef,#e879f9)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(217,70,239,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(232,121,249,.06) 0%,transparent 50%)' } },
  { id: 'lime', name: 'Lime', icon: '🍀', colors: { primary: '#84cc16', primaryLight: '#a3e635', primaryDark: '#65a30d', glow: 'rgba(132,204,22,.25)', gradient: 'linear-gradient(135deg,#84cc16,#a3e635)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(132,204,22,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(163,230,53,.06) 0%,transparent 50%)' } },
  { id: 'slate', name: 'Slate', icon: '🌑', colors: { primary: '#64748b', primaryLight: '#94a3b8', primaryDark: '#475569', glow: 'rgba(100,116,139,.25)', gradient: 'linear-gradient(135deg,#64748b,#94a3b8)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(100,116,139,.08) 0%,transparent 60%)' } },
  { id: 'spotify', name: 'Spotify', icon: '🎵', colors: { primary: '#1db954', primaryLight: '#1ed760', primaryDark: '#1aa34a', glow: 'rgba(29,185,84,.25)', gradient: 'linear-gradient(135deg,#1db954,#1ed760)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(29,185,84,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(30,215,96,.06) 0%,transparent 50%)' } },
  { id: 'twitter', name: 'Twitter / X', icon: '🐦', colors: { primary: '#1d9bf0', primaryLight: '#60c0f8', primaryDark: '#1a8cd8', glow: 'rgba(29,155,240,.25)', gradient: 'linear-gradient(135deg,#1d9bf0,#60c0f8)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(29,155,240,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(96,192,248,.06) 0%,transparent 50%)' } },
  // ── Special multi-gradient themes ──
  { id: 'love', name: 'Love', icon: '❤️‍🔥', colors: { primary: '#e11d48', primaryLight: '#fb7185', primaryDark: '#be123c', glow: 'rgba(225,29,72,.3)', gradient: 'linear-gradient(135deg,#e11d48,#f43f5e,#fb7185)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(225,29,72,.14) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 20% 80%,rgba(251,113,133,.08) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 80% 60%,rgba(244,63,94,.06) 0%,transparent 50%)' } },
  { id: 'aurora', name: 'Aurora', icon: '🌌', colors: { primary: '#22d3ee', primaryLight: '#67e8f9', primaryDark: '#06b6d4', glow: 'rgba(34,211,238,.25)', gradient: 'linear-gradient(135deg,#06b6d4,#22d3ee,#a78bfa)', bgGradient: 'radial-gradient(ellipse 80% 50% at 30% -10%,rgba(34,211,238,.12) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 70% 90%,rgba(167,139,250,.10) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 90% 30%,rgba(52,211,153,.06) 0%,transparent 50%)' } },
  { id: 'midnight', name: 'Midnight', icon: '🌙', colors: { primary: '#6366f1', primaryLight: '#a5b4fc', primaryDark: '#4338ca', glow: 'rgba(99,102,241,.3)', gradient: 'linear-gradient(135deg,#4338ca,#6366f1,#818cf8)', bgGradient: 'radial-gradient(ellipse 90% 60% at 50% -20%,rgba(99,102,241,.15) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 10% 100%,rgba(67,56,202,.10) 0%,transparent 50%),radial-gradient(ellipse 40% 40% at 90% 50%,rgba(129,140,248,.06) 0%,transparent 50%)' } },
  { id: 'neon', name: 'Neon', icon: '⚡', colors: { primary: '#a855f7', primaryLight: '#c084fc', primaryDark: '#9333ea', glow: 'rgba(168,85,247,.35)', gradient: 'linear-gradient(135deg,#9333ea,#a855f7,#e879f9)', bgGradient: 'radial-gradient(ellipse 70% 50% at 40% -10%,rgba(168,85,247,.15) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% 90%,rgba(232,121,249,.10) 0%,transparent 50%),radial-gradient(ellipse 60% 30% at 10% 60%,rgba(147,51,234,.08) 0%,transparent 50%)' } },
  { id: 'fire', name: 'Fire', icon: '🔥', colors: { primary: '#ef4444', primaryLight: '#f87171', primaryDark: '#dc2626', glow: 'rgba(239,68,68,.3)', gradient: 'linear-gradient(135deg,#dc2626,#ef4444,#f97316)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(239,68,68,.12) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% 90%,rgba(249,115,22,.08) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 10% 50%,rgba(220,38,38,.06) 0%,transparent 50%)' } },
  { id: 'instagram', name: 'Instagram', icon: '📸', colors: { primary: '#e1306c', primaryLight: '#f56040', primaryDark: '#c13584', glow: 'rgba(225,48,108,.25)', gradient: 'linear-gradient(135deg,#833ab4,#e1306c,#f56040)', bgGradient: 'radial-gradient(ellipse 70% 50% at 30% -10%,rgba(131,58,180,.12) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% 90%,rgba(245,96,64,.08) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 60% 40%,rgba(225,48,108,.06) 0%,transparent 50%)' } },
  { id: 'matrix', name: 'Matrix', icon: '💻', colors: { primary: '#00ff41', primaryLight: '#39ff14', primaryDark: '#00cc33', glow: 'rgba(0,255,65,.2)', gradient: 'linear-gradient(135deg,#00cc33,#00ff41)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(0,255,65,.06) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(57,255,20,.04) 0%,transparent 50%)' } },
  // ── 15 NEW themes ──
  { id: 'galaxy', name: 'Galaxy', icon: '🪐', colors: { primary: '#7c3aed', primaryLight: '#a78bfa', primaryDark: '#5b21b6', glow: 'rgba(124,58,237,.3)', gradient: 'linear-gradient(135deg,#5b21b6,#7c3aed,#c084fc)', bgGradient: 'radial-gradient(ellipse 90% 60% at 40% -10%,rgba(124,58,237,.14) 0%,transparent 55%),radial-gradient(ellipse 50% 50% at 90% 80%,rgba(192,132,252,.10) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 10% 90%,rgba(91,33,182,.08) 0%,transparent 50%)' } },
  { id: 'bubblegum', name: 'Bubblegum', icon: '🫧', colors: { primary: '#ec4899', primaryLight: '#f472b6', primaryDark: '#db2777', glow: 'rgba(236,72,153,.3)', gradient: 'linear-gradient(135deg,#db2777,#ec4899,#f9a8d4)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(236,72,153,.12) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 20% 80%,rgba(249,168,212,.10) 0%,transparent 50%),radial-gradient(ellipse 40% 40% at 85% 50%,rgba(219,39,119,.06) 0%,transparent 50%)' } },
  { id: 'coffee', name: 'Coffee', icon: '☕', colors: { primary: '#92400e', primaryLight: '#b45309', primaryDark: '#78350f', glow: 'rgba(146,64,14,.25)', gradient: 'linear-gradient(135deg,#78350f,#92400e,#b45309)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(146,64,14,.10) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(180,83,9,.06) 0%,transparent 50%)' } },
  { id: 'lavender', name: 'Lavender', icon: '💐', colors: { primary: '#a78bfa', primaryLight: '#c4b5fd', primaryDark: '#8b5cf6', glow: 'rgba(167,139,250,.3)', gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa,#c4b5fd)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(167,139,250,.14) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 80% 90%,rgba(196,181,253,.10) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 10% 50%,rgba(139,92,246,.06) 0%,transparent 50%)' } },
  { id: 'cherry', name: 'Cherry', icon: '🍒', colors: { primary: '#be123c', primaryLight: '#e11d48', primaryDark: '#9f1239', glow: 'rgba(190,18,60,.3)', gradient: 'linear-gradient(135deg,#9f1239,#be123c,#e11d48)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(190,18,60,.12) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(225,29,72,.08) 0%,transparent 50%)' } },
  { id: 'arctic', name: 'Arctic', icon: '❄️', colors: { primary: '#7dd3fc', primaryLight: '#bae6fd', primaryDark: '#38bdf8', glow: 'rgba(125,211,252,.3)', gradient: 'linear-gradient(135deg,#38bdf8,#7dd3fc,#bae6fd)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(125,211,252,.14) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 20% 80%,rgba(186,230,253,.10) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 90% 40%,rgba(56,189,248,.06) 0%,transparent 50%)' } },
  { id: 'peach', name: 'Peach', icon: '🍑', colors: { primary: '#fb923c', primaryLight: '#fdba74', primaryDark: '#f97316', glow: 'rgba(251,146,60,.25)', gradient: 'linear-gradient(135deg,#f97316,#fb923c,#fdba74)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(251,146,60,.12) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 80% 90%,rgba(253,186,116,.08) 0%,transparent 50%)' } },
  { id: 'discord', name: 'Discord', icon: '🎮', colors: { primary: '#5865f2', primaryLight: '#7289da', primaryDark: '#4752c4', glow: 'rgba(88,101,242,.3)', gradient: 'linear-gradient(135deg,#4752c4,#5865f2,#7289da)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(88,101,242,.12) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(114,137,218,.08) 0%,transparent 50%)' } },
  { id: 'mint', name: 'Mint', icon: '🌿', colors: { primary: '#34d399', primaryLight: '#6ee7b7', primaryDark: '#10b981', glow: 'rgba(52,211,153,.25)', gradient: 'linear-gradient(135deg,#10b981,#34d399,#6ee7b7)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(52,211,153,.12) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 20% 80%,rgba(110,231,183,.08) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 85% 50%,rgba(16,185,129,.06) 0%,transparent 50%)' } },
  { id: 'coral', name: 'Coral', icon: '🪸', colors: { primary: '#f87171', primaryLight: '#fca5a5', primaryDark: '#ef4444', glow: 'rgba(248,113,113,.25)', gradient: 'linear-gradient(135deg,#ef4444,#f87171,#fca5a5)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(248,113,113,.12) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 80% 90%,rgba(252,165,165,.08) 0%,transparent 50%)' } },
  { id: 'sapphire', name: 'Sapphire', icon: '💠', colors: { primary: '#2563eb', primaryLight: '#3b82f6', primaryDark: '#1d4ed8', glow: 'rgba(37,99,235,.3)', gradient: 'linear-gradient(135deg,#1d4ed8,#2563eb,#3b82f6)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(37,99,235,.14) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 20% 80%,rgba(59,130,246,.08) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 85% 50%,rgba(29,78,216,.06) 0%,transparent 50%)' } },
  { id: 'wine', name: 'Wine', icon: '🍷', colors: { primary: '#881337', primaryLight: '#be123c', primaryDark: '#4c0519', glow: 'rgba(136,19,55,.3)', gradient: 'linear-gradient(135deg,#4c0519,#881337,#be123c)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(136,19,55,.12) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,rgba(190,18,60,.06) 0%,transparent 50%)' } },
  { id: 'ocean-deep', name: 'Deep Sea', icon: '🦑', colors: { primary: '#0369a1', primaryLight: '#0284c7', primaryDark: '#075985', glow: 'rgba(3,105,161,.3)', gradient: 'linear-gradient(135deg,#075985,#0369a1,#0ea5e9)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(3,105,161,.14) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 20% 100%,rgba(14,165,233,.08) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 80% 50%,rgba(7,89,133,.06) 0%,transparent 50%)' } },
  { id: 'rainbow', name: 'Rainbow', icon: '🌈', colors: { primary: '#ec4899', primaryLight: '#f472b6', primaryDark: '#be185d', glow: 'rgba(236,72,153,.25)', gradient: 'linear-gradient(135deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#8b5cf6)', bgGradient: 'radial-gradient(ellipse 60% 40% at 20% -10%,rgba(239,68,68,.08) 0%,transparent 50%),radial-gradient(ellipse 50% 40% at 50% 100%,rgba(34,197,94,.06) 0%,transparent 50%),radial-gradient(ellipse 50% 40% at 80% -10%,rgba(59,130,246,.08) 0%,transparent 50%),radial-gradient(ellipse 40% 30% at 60% 50%,rgba(139,92,246,.05) 0%,transparent 50%)' } },
  { id: 'snow', name: 'Snow', icon: '⛄', colors: { primary: '#cbd5e1', primaryLight: '#e2e8f0', primaryDark: '#94a3b8', glow: 'rgba(203,213,225,.3)', gradient: 'linear-gradient(135deg,#94a3b8,#cbd5e1,#e2e8f0)', bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(203,213,225,.10) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 20% 80%,rgba(226,232,240,.08) 0%,transparent 50%)' } },
];

export function getTheme(id: string): ColorTheme {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}

export function applyColorTheme(theme: ColorTheme): void {
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', theme.colors.primary);
  root.style.setProperty('--accent-light', theme.colors.primaryLight);
  root.style.setProperty('--accent-dark', theme.colors.primaryDark);
  root.style.setProperty('--accent-glow', theme.colors.glow);
  root.style.setProperty('--accent-gradient', theme.colors.gradient);
  root.style.setProperty('--accent-bg-gradient', theme.colors.bgGradient);
}

// ── Background Effects ──
export interface BgEffect {
  id: string;
  name: string;
  icon: string;
}

export const BG_EFFECTS: BgEffect[] = [
  { id: 'none', name: 'None', icon: '🚫' },
  { id: 'orbs', name: 'Floating Orbs', icon: '🫧' },
  { id: 'particles', name: 'Particles', icon: '✨' },
  { id: 'grid', name: 'Grid', icon: '📐' },
  { id: 'waves', name: 'Waves', icon: '🌊' },
  { id: 'stars', name: 'Starfield', icon: '⭐' },
  { id: 'gradient-mesh', name: 'Gradient Mesh', icon: '🎨' },
  { id: 'dots', name: 'Dot Matrix', icon: '⚪' },
  { id: 'aurora-bg', name: 'Aurora', icon: '🌌' },
  { id: 'rain', name: 'Digital Rain', icon: '🌧️' },
  { id: 'glow-lines', name: 'Glow Lines', icon: '〰️' },
  { id: 'hexagons', name: 'Hexagons', icon: '⬡' },
  { id: 'bubbles', name: 'Bubbles', icon: '🔵' },
  { id: 'smoke', name: 'Smoke', icon: '💨' },
  { id: 'spotlight', name: 'Spotlight', icon: '🔦' },
];

