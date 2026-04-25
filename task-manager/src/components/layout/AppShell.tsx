'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { useDynamicIcon } from '@/hooks/useDynamicIcon';
import { ToastProvider } from '@/components/ui/Toast';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import Onboarding from '@/components/Onboarding';
import BgEffects from '@/components/BgEffects';
import InstallPrompt from '@/components/InstallPrompt';
import CustomCursor from '@/components/CustomCursor';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const hasHydrated = useStore((s) => s._hasHydrated);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  useTheme();
  useNotifications();
  useDynamicIcon();

  useEffect(() => {
    if (hasHydrated) {
      const seen = localStorage.getItem('taskpro-onboarding-done');
      if (!seen) setShowOnboarding(true);
      setOnboardingChecked(true);
    }
  }, [hasHydrated]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('taskpro-onboarding-done', 'true');
    setShowOnboarding(false);
  };

  if (!hasHydrated || !onboardingChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin accent-border" />
          <p className="text-[var(--text-muted)] text-sm">Loading TaskManager Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <ToastProvider>
      <BgEffects />
      <CustomCursor />
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <div className={`relative z-[1] min-h-screen flex ${showOnboarding ? 'invisible' : ''}`}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
          <Header onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 page-transition">
            {children}
          </main>
        </div>
        <MobileNav />
        <InstallPrompt />
      </div>
    </ToastProvider>
    </ErrorBoundary>
  );
}
