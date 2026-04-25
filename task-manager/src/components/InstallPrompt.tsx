'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, Zap, Wifi } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let dismissedThisSession = false;

export default function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  // Exact same pattern as email-blaster
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Show popup on page changes
  useEffect(() => {
    if (isInstalled || !installPrompt || dismissedThisSession) return;
    setShow(false);
    const timer = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(timer);
  }, [pathname, installPrompt, isInstalled]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const r = await installPrompt.userChoice;
    if (r.outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
    setShow(false);
  };

  if (isInstalled || !installPrompt) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[90] glass-card p-5 shadow-2xl"
          style={{ border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, var(--border))' }}
        >
          <button onClick={() => { setShow(false); dismissedThisSession = true; }} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]">
            <X size={16} />
          </button>

          <div className="flex gap-4">
            <AppLogo size={56} className="flex-shrink-0 drop-shadow-xl" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Install TaskPro</h3>
              <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">
                Get the full app — instant launch, offline mode & push notifications
              </p>
              <button onClick={handleInstall} className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5">
                <Download size={14} /> Install Now
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border)]">
            {[
              { icon: Smartphone, text: 'Native app feel' },
              { icon: Wifi, text: 'Works offline' },
              { icon: Zap, text: 'Instant launch' },
            ].map((f) => (
              <span key={f.text} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <f.icon size={10} className="accent-text" /> {f.text}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}
