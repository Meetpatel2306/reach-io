'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sun, Moon, Volume2, Download, Upload, Copy, ExternalLink,
  Trash2, Bell, Share2, HardDrive, Palette, Shield, Info, Send,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/components/ui/Toast';
import { playNotificationSound, requestNotificationPermission, getNotificationStatus, sendNotification } from '@/lib/notifications';
import { isAppInstalled } from '@/components/InstallPrompt';
import AppLogo from '@/components/AppLogo';
import { downloadFile, readFileAsText, cn } from '@/lib/utils';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TASK_FILE_EXTENSION, APP_NAME } from '@/lib/constants';
import { COLOR_THEMES, BG_EFFECTS } from '@/lib/themes';
import { Priority, Recurrence } from '@/lib/types';

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const exportTaskFile = useStore((s) => s.exportTaskFile);
  const importTaskFile = useStore((s) => s.importTaskFile);
  const clearAllData = useStore((s) => s.clearAllData);
  const addTask = useStore((s) => s.addTask);
  const tasks = useStore((s) => s.tasks);
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportFull = () => {
    const json = exportData();
    downloadFile(json, `taskmanager-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    addToast('Full backup exported!', 'success');
  };

  const handleImportFull = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    if (importData(text)) {
      addToast('Data imported successfully!', 'success');
    } else {
      addToast('Invalid backup file', 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportTaskFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importTaskFile(file);
    if (result.success) {
      addToast(`Imported ${result.count} new tasks!`, 'success');
    } else {
      addToast('Invalid task file', 'error');
    }
    if (taskFileInputRef.current) taskFileInputRef.current.value = '';
  };

  const handleClear = async () => {
    // Clear Zustand store
    clearAllData();

    // Clear all localStorage
    try { localStorage.clear(); } catch {}

    // Clear all caches
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}

    // Unregister service workers
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {}

    // Clear notification log
    try { localStorage.removeItem('taskpro-notification-log'); } catch {}
    try { localStorage.removeItem('taskpro-notif-dismissed-ids'); } catch {}
    try { localStorage.removeItem('taskpro-onboarding-done'); } catch {}
    try { localStorage.removeItem('taskpro-install-dismissed'); } catch {}

    // Reload fresh
    window.location.reload();
  };

  const handleTestSound = () => {
    playNotificationSound('medium', true);
  };

  const [permStatus, setPermStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('unsupported');
  const refreshPermStatus = () => setPermStatus(getNotificationStatus());
  useEffect(() => {
    refreshPermStatus();
    const handler = () => refreshPermStatus();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const handleTestNotification = async () => {
    if (permStatus === 'unsupported') {
      addToast('Your browser does not support notifications', 'error');
      return;
    }
    if (permStatus === 'denied') {
      addToast('Browser blocked notifications. Click the lock icon in the address bar → Notifications → Allow → reload.', 'warning');
      return;
    }
    if (permStatus === 'default') {
      const granted = await requestNotificationPermission();
      refreshPermStatus();
      if (!granted) {
        addToast('Permission not granted', 'warning');
        return;
      }
    }
    sendNotification('TaskPro Test Notification', 'If you can see this popup, notifications are working correctly.', 'test-notification');
    if (settings.soundEnabled) playNotificationSound('medium', true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active) reg.active.postMessage({ type: 'TEST_NOTIFICATION' });
      }).catch(() => {});
    }
    addToast('Test notification fired!', 'success');
  };

  const permLabel = {
    granted: { text: 'Allowed', color: 'text-green-400', bg: 'bg-green-500/10' },
    denied: { text: 'Blocked', color: 'text-red-400', bg: 'bg-red-500/10' },
    default: { text: 'Not asked yet', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    unsupported: { text: 'Unsupported', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-secondary)]' },
  }[permStatus];

  const storageUsed = useMemo(() => {
    try {
      const data = localStorage.getItem('task-manager-pro-storage');
      return data ? (new Blob([data]).size / 1024).toFixed(1) : '0';
    } catch { return '0'; }
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>

      {/* Appearance */}
      <Section title="Appearance" icon={Palette}>
        <SettingRow label="Dark / Light" description="Switch between light and dark mode">
          <button onClick={toggleTheme} className="btn-secondary flex items-center gap-2 text-sm">
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </SettingRow>

        <div className="pt-2">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Color Theme</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Choose your accent color — inspired by your favorite apps</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {COLOR_THEMES.map((ct) => {
              const isActive = settings.colorTheme === ct.id;
              return (
                <motion.button
                  key={ct.id}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateSettings({ colorTheme: ct.id })}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                    isActive
                      ? 'border-[var(--accent-primary)] shadow-lg'
                      : 'border-transparent hover:border-[var(--border)] bg-[var(--bg-secondary)]'
                  )}
                  style={isActive ? { borderColor: ct.colors.primary, boxShadow: `0 4px 20px ${ct.colors.primary}25` } : {}}
                >
                  <div
                    className="w-8 h-8 rounded-full shadow-md flex items-center justify-center text-sm"
                    style={{ background: ct.colors.gradient }}
                  >
                    <span className="drop-shadow">{ct.icon}</span>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate w-full text-center">
                    {ct.name}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="theme-check"
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: ct.colors.primary }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Background Effect */}
        <div className="pt-4 border-t border-[var(--border)]">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Background Effect</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">Animated background behind your app</p>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {BG_EFFECTS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => updateSettings({ bgEffect: bg.id })}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-center',
                  settings.bgEffect === bg.id
                    ? 'border-[var(--accent-primary)] shadow-md'
                    : 'border-transparent hover:bg-[var(--bg-secondary)]'
                )}
                style={settings.bgEffect === bg.id ? { borderColor: 'var(--accent-primary)' } : {}}
              >
                <span className="text-lg">{bg.icon}</span>
                <span className="text-[9px] text-[var(--text-muted)] truncate w-full">{bg.name}</span>
              </button>
            ))}
          </div>
        </div>

      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={Bell}>
        <div className={cn('p-3 rounded-xl flex items-center justify-between gap-3', permLabel.bg)}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Browser Permission</p>
            <p className={cn('text-xs', permLabel.color)}>{permLabel.text}</p>
            {permStatus === 'denied' && (
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Click the lock icon in the address bar → Notifications → Allow → reload the page
              </p>
            )}
          </div>
          <button
            onClick={handleTestNotification}
            className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
          >
            Send Test
          </button>
        </div>
        <SettingRow label="Push Notifications" description="Get notified when tasks are due">
          <ToggleButton
            enabled={settings.notificationsEnabled}
            onToggle={async () => {
              if (!settings.notificationsEnabled) {
                const granted = await requestNotificationPermission();
                refreshPermStatus();
                if (!granted) {
                  addToast('Enabled! Allow browser notifications: click lock icon in address bar → Permissions → Allow', 'warning');
                }
              }
              updateSettings({ notificationsEnabled: !settings.notificationsEnabled });
            }}
          />
        </SettingRow>
        <SettingRow label="Sound" description="Play sound for notifications">
          <div className="flex items-center gap-2">
            <button onClick={handleTestSound} className="btn-ghost text-xs px-2 py-1">Test</button>
            <ToggleButton
              enabled={settings.soundEnabled}
              onToggle={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            />
          </div>
        </SettingRow>
      </Section>

      {/* Defaults */}
      <Section title="Defaults" icon={Shield}>
        <SettingRow label="Default Priority" description="Priority for new tasks">
          <select
            value={settings.defaultPriority}
            onChange={(e) => updateSettings({ defaultPriority: e.target.value as Priority })}
            className="input-field py-1.5 text-sm w-32"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </SettingRow>
        <SettingRow label="Default Schedule" description="Default recurrence for new tasks">
          <select
            value={settings.defaultRecurrence}
            onChange={(e) => updateSettings({ defaultRecurrence: e.target.value as Recurrence })}
            className="input-field py-1.5 text-sm w-32"
          >
            <option value="once">Once</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </SettingRow>
      </Section>

      {/* Shareable Task Files */}
      <Section title="Shareable Task Files" icon={Share2}>
        <div className="p-3 rounded-xl bg-primary-500/5 border border-primary-500/10 mb-4">
          <p className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5 text-primary-400" />
            Export tasks as <strong>{TASK_FILE_EXTENSION}</strong> files to share with others.
            When someone opens the file, tasks are automatically imported into their app.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportTaskFile()} className="btn-secondary flex items-center gap-2 text-sm flex-1">
            <Download size={16} /> Export Tasks ({tasks.length})
          </button>
          <button onClick={() => taskFileInputRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm flex-1">
            <Upload size={16} /> Import Task File
          </button>
          <input ref={taskFileInputRef} type="file" accept={`${TASK_FILE_EXTENSION},.json`} onChange={handleImportTaskFile} className="hidden" />
        </div>
      </Section>

      {/* Share App */}
      <Section title="Share App" icon={Send}>
        <p className="text-xs text-[var(--text-muted)] mb-4">Share TaskPro with friends & colleagues</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              const url = window.location.origin;
              const lines = [
                '*TaskPro* \u2014 Organize your life smarter.',
                '',
                '\u2022 Task scheduling (daily, weekly, monthly)',
                '\u2022 Focus timer with analytics',
                '\u2022 Productivity tracking & streaks',
                '\u2022 Works offline as an app',
                '',
                'Try it free:',
                url,
              ];
              window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
            }}
            className="btn-secondary flex items-center justify-center gap-2 text-sm py-3"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
          <button
            onClick={() => {
              const url = window.location.origin;
              const text = 'TaskPro — Smart task management with time scheduling, focus timer & productivity analytics. Try it free:';
              window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
            }}
            className="btn-secondary flex items-center justify-center gap-2 text-sm py-3"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Twitter / X
          </button>
          <button
            onClick={() => {
              const url = window.location.origin;
              const text = 'TaskPro — Smart task management with time scheduling, focus timer & productivity analytics. Try it free:';
              window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
            }}
            className="btn-secondary flex items-center justify-center gap-2 text-sm py-3"
          >
            <Send size={16} />
            Telegram
          </button>
          <button
            onClick={() => {
              const url = window.location.origin;
              navigator.clipboard.writeText(url);
              addToast('Link copied to clipboard!', 'success');
            }}
            className="btn-secondary flex items-center justify-center gap-2 text-sm py-3"
          >
            <Copy size={16} />
            Copy Link
          </button>
        </div>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={() => {
              navigator.share({
                title: 'TaskPro — Task Manager',
                text: 'Check out TaskPro — beautiful task manager with scheduling, pomodoro & analytics!',
                url: window.location.origin,
              }).catch(() => {});
            }}
            className="btn-primary w-full mt-3 flex items-center justify-center gap-2 text-sm"
          >
            <ExternalLink size={16} /> Share via any app...
          </button>
        )}
      </Section>

      {/* Data Management */}
      <Section title="Data Management" icon={HardDrive}>
        <SettingRow label="Storage Used" description="Current localStorage usage">
          <span className="text-sm font-medium text-[var(--text-primary)]">{storageUsed} KB</span>
        </SettingRow>
        <div className="flex gap-3 mt-4">
          <button onClick={handleExportFull} className="btn-secondary flex items-center gap-2 text-sm flex-1">
            <Download size={16} /> Full Backup
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm flex-1">
            <Upload size={16} /> Restore Backup
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFull} className="hidden" />
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
        >
          <Trash2 size={16} /> Clear All Data & Cache
        </button>
        <button
          onClick={() => {
            const now = new Date();
            for (let i = 1; i <= 5; i++) {
              const start = new Date(now.getTime() + i * 60000);
              const end = new Date(start.getTime() + 60000);
              addTask({
                title: `Test Task ${i} (${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})`,
                description: `Auto-generated test task #${i}`,
                priority: (['low', 'medium', 'high', 'urgent'] as const)[i % 4],
                status: 'pending',
                categoryId: null,
                tags: ['test'],
                recurrence: 'once',
                scheduledAt: start.toISOString(),
                endAt: end.toISOString(),
                notifyOnEnd: true,
                completedAt: null,
                pomodorosEstimated: 1,
                subtasks: [],
              });
            }
            addToast(`Created 5 test tasks (1 per minute starting ${new Date(now.getTime() + 60000).toLocaleTimeString()})`, 'success');
          }}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition-all text-sm font-medium"
        >
          Generate 5 Test Tasks (1/min)
        </button>
      </Section>

      {/* Install / Update App */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'var(--accent-gradient)' }}>
              <Download size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                {isAppInstalled() ? 'Update App' : 'Install App'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {isAppInstalled() ? 'Check for the latest version' : 'Add to home screen for native experience'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAppInstalled() ? (
              <button
                onClick={() => { if (typeof window !== 'undefined' && 'serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.update())); addToast('Checking for updates...', 'info'); setTimeout(() => window.location.reload(), 1500); } }}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Download size={14} /> Update
              </button>
            ) : (
              <button
                onClick={() => {
                  addToast('Use the install popup at the bottom of the screen, or click the install icon in your browser address bar', 'info');
                }}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Download size={14} /> Install
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="text-center py-8 space-y-4">
        <div className="flex justify-center">
          <AppLogo size={48} />
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="h-px w-12 bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)] font-medium tracking-wider uppercase">TaskPro</span>
          <div className="h-px w-12 bg-[var(--border)]" />
        </div>
        <p className="text-sm text-[var(--text-secondary)] font-medium">
          Designed & Developed by <span className="accent-text font-semibold">Meet Patel</span>
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {APP_NAME} v1.0.0 &middot; Built with Next.js & Tailwind CSS
        </p>
        <p className="text-[10px] text-[var(--text-muted)]">
          &copy; {new Date().getFullYear()} Meet Patel. All rights reserved.
        </p>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        title="Clear All Data"
        message="This will clear ALL data — tasks, settings, cache, service worker, notifications. The app will restart fresh. Export a backup first!"
        confirmText="Clear Everything & Restart"
        danger
      />
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5"
    >
      <h2 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Icon size={18} className="text-primary-400" />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </motion.div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ToggleButton({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        enabled ? 'bg-primary-500' : 'bg-[var(--border)]'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform',
          enabled ? 'translate-x-5.5 left-[1px]' : 'translate-x-0 left-[2px]'
        )}
        style={{ transform: enabled ? 'translateX(21px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-[var(--bg-secondary)] hover:bg-white/10 text-[var(--text-primary)] flex items-center justify-center font-bold text-sm"
      >-</button>
      <span className="text-sm font-medium text-[var(--text-primary)] w-8 text-center">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-lg bg-[var(--bg-secondary)] hover:bg-white/10 text-[var(--text-primary)] flex items-center justify-center font-bold text-sm"
      >+</button>
    </div>
  );
}

