'use client';

import { useState } from 'react';
import { Search, Moon, Sun, Volume2, VolumeX, Menu } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { playNotificationSound } from '@/lib/notifications';
import { useToast } from '@/components/ui/Toast';
import NotificationPanel from '@/components/NotificationPanel';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSound = () => {
    const newVal = !settings.soundEnabled;
    updateSettings({ soundEnabled: newVal });
    if (newVal) playNotificationSound();
    addToast(newVal ? 'Sound enabled' : 'Sound disabled', 'info');
  };

  return (
    <header className="sticky top-0 z-30 px-4 md:px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-xl hover:bg-white/10 text-[var(--text-secondary)]"
        >
          <Menu size={22} />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 py-2 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button onClick={toggleSound} className="btn-ghost p-2.5 rounded-xl relative" title="Toggle sound">
            {settings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          <NotificationPanel />

          <button onClick={toggleTheme} className="btn-ghost p-2.5 rounded-xl" title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
