'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare, Calendar, Timer, BarChart3, Bell, Share2,
  Zap, ArrowRight, Sparkles, Shield, Smartphone, Moon,
  ChevronRight, Rocket, Volume2, BellRing, Star,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { requestNotificationPermission, playNotificationSound } from '@/lib/notifications';
import AppLogo from '@/components/AppLogo';

const FEATURES = [
  {
    icon: CheckSquare,
    title: 'Smart Tasks',
    description: 'Create tasks with priorities, categories, tags, subtasks, and estimated pomodoros',
    color: '#6366f1',
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    icon: Calendar,
    title: 'Schedule & Repeat',
    description: 'Set tasks once, daily, weekly, or monthly with a beautiful calendar view',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Timer,
    title: 'Pomodoro Timer',
    description: 'Stay focused with built-in work/break cycles linked to your tasks',
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Streaks',
    description: 'Track your productivity with charts, heatmaps, and streak tracking',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Get notified when tasks are due with priority-based sounds',
    color: '#ef4444',
    gradient: 'from-red-500 to-pink-500',
  },
  {
    icon: Share2,
    title: 'Shareable Files',
    description: 'Export tasks as .taskpro files and share with anyone',
    color: '#8b5cf6',
    gradient: 'from-purple-500 to-violet-600',
  },
];

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to TaskManager Pro',
    subtitle: 'Your productivity superpower',
  },
  {
    id: 'features',
    title: 'Everything you need',
    subtitle: 'Packed with powerful features',
  },
  {
    id: 'setup',
    title: 'Quick Setup',
    subtitle: 'Let\'s customize your experience',
  },
  {
    id: 'ready',
    title: 'You\'re all set!',
    subtitle: 'Let\'s get productive',
  },
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const updateSettings = useStore((s) => s.updateSettings);
  const settings = useStore((s) => s.settings);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const next = () => {
    if (step === STEPS.length - 1) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const skip = () => onComplete();

  const toggleNotif = async () => {
    if (notifEnabled) {
      setNotifEnabled(false);
      updateSettings({ notificationsEnabled: false });
    } else {
      const granted = await requestNotificationPermission();
      setNotifEnabled(granted);
      updateSettings({ notificationsEnabled: granted });
      if (granted) playNotificationSound('low', true);
    }
  };

  const toggleOnboardingSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    updateSettings({ soundEnabled: newVal });
    if (newVal) playNotificationSound('medium', true);
  };

  const setTheme = (theme: 'light' | 'dark') => {
    updateSettings({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary-500/5 blur-3xl float-animation" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-3xl float-animation" style={{ animationDelay: '-3s' }} />
        <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-3xl float-animation" style={{ animationDelay: '-1.5s' }} />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === step ? 'w-8 bg-primary-500' :
                i < step ? 'w-4 bg-primary-500/40' :
                'w-4 bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* Skip button */}
        {step < STEPS.length - 1 && (
          <button
            onClick={skip}
            className="absolute top-4 right-6 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
          >
            Skip <ChevronRight size={14} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              {/* Logo */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.2 }}
                className="mx-auto mb-8"
              >
                <AppLogo size={96} className="drop-shadow-2xl" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-4xl md:text-5xl font-bold mb-4"
              >
                <span className="gradient-text">TaskManager</span>
                <span className="text-[var(--text-primary)]"> Pro</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-lg text-[var(--text-secondary)] mb-3 max-w-md mx-auto"
              >
                The most beautiful way to manage your tasks, stay focused, and track your productivity.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-wrap items-center justify-center gap-3 mb-10"
              >
                {[
                  { icon: Smartphone, label: 'PWA Ready' },
                  { icon: Shield, label: 'Offline First' },
                  { icon: Sparkles, label: 'No Account Needed' },
                ].map((badge) => (
                  <span
                    key={badge.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[var(--text-secondary)]"
                  >
                    <badge.icon size={12} className="text-primary-400" />
                    {badge.label}
                  </span>
                ))}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={next}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-500 to-purple-600 text-white font-semibold text-lg shadow-xl shadow-primary-500/30 hover:shadow-2xl hover:shadow-primary-500/40 transition-all"
              >
                Get Started <ArrowRight size={22} />
              </motion.button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="features"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2">{STEPS[1].title}</h2>
                <p className="text-[var(--text-secondary)]">{STEPS[1].subtitle}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {FEATURES.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-4 text-center group hover:scale-105 transition-transform cursor-default"
                  >
                    <div
                      className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg`}
                      style={{ boxShadow: `0 8px 20px ${feature.color}30` }}
                    >
                      <feature.icon size={22} className="text-white" />
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">{feature.title}</h3>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{feature.description}</p>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={next}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold shadow-lg shadow-primary-500/25 transition-all"
                >
                  Continue <ArrowRight size={18} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2">{STEPS[2].title}</h2>
                <p className="text-[var(--text-secondary)]">{STEPS[2].subtitle}</p>
              </div>

              <div className="space-y-4 max-w-md mx-auto mb-8">
                {/* Theme */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-purple-500/10">
                      <Moon size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-[var(--text-primary)]">Choose Theme</h3>
                      <p className="text-xs text-[var(--text-muted)]">Pick your preferred appearance</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                        settings.theme === 'dark'
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-[var(--border)] hover:border-primary-500/30'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center">
                        <Moon size={14} className="text-gray-400" />
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                        settings.theme === 'light'
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-[var(--border)] hover:border-primary-500/30'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center">
                        <Star size={14} className="text-amber-500" />
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">Light</span>
                    </button>
                  </div>
                </motion.div>

                {/* Notifications */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-red-500/10">
                        <BellRing size={20} className="text-red-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-[var(--text-primary)]">Notifications</h3>
                        <p className="text-xs text-[var(--text-muted)]">Get reminded when tasks are due</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleNotif}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        notifEnabled ? 'bg-primary-500' : 'bg-[var(--border)]'
                      }`}
                    >
                      <div
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform"
                        style={{ left: '2px', transform: notifEnabled ? 'translateX(22px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                </motion.div>

                {/* Sound */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10">
                        <Volume2 size={20} className="text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-[var(--text-primary)]">Sound Effects</h3>
                        <p className="text-xs text-[var(--text-muted)]">Audio alerts for notifications</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleOnboardingSound}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        soundEnabled ? 'bg-primary-500' : 'bg-[var(--border)]'
                      }`}
                    >
                      <div
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform"
                        style={{ left: '2px', transform: soundEnabled ? 'translateX(22px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                </motion.div>
              </div>

              <div className="flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={next}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold shadow-lg shadow-primary-500/25 transition-all"
                >
                  Continue <ArrowRight size={18} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10, delay: 0.2 }}
                className="w-28 h-28 mx-auto mb-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/30"
              >
                <Rocket size={48} className="text-white" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-bold text-[var(--text-primary)] mb-3"
              >
                You&apos;re Ready!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-[var(--text-secondary)] mb-4 max-w-sm mx-auto"
              >
                Start creating tasks and building your productivity habits. Your data stays on your device - no account needed.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-wrap items-center justify-center gap-2 mb-8 text-xs text-[var(--text-muted)]"
              >
                <span className="px-2 py-1 rounded-lg bg-white/5">Install as app from browser menu</span>
                <span className="px-2 py-1 rounded-lg bg-white/5">Works offline</span>
                <span className="px-2 py-1 rounded-lg bg-white/5">Share tasks via .taskpro files</span>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={next}
                className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold text-lg shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40 transition-all"
              >
                <Sparkles size={22} /> Start Using TaskManager Pro
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
