'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Calendar, Timer, BarChart3,
  Settings, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import AppLogo from '@/components/AppLogo';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/pomodoro', label: 'Pomodoro', icon: Timer },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const tasks = useStore((s) => s.tasks);
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 glass-sidebar hidden md:flex flex-col transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[var(--border)]">
        <AppLogo size={40} className="flex-shrink-0 drop-shadow-lg" />
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
            <h1 className="text-lg font-extrabold whitespace-nowrap tracking-tight">
              <span className="gradient-text">Task</span><span className="text-[var(--text-primary)]">Pro</span>
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-medium tracking-widest uppercase">Manager</p>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                isActive
                  ? 'accent-bg-soft accent-text'
                  : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 accent-bg rounded-r-full"
                />
              )}
              <Icon size={20} className={isActive ? 'accent-text' : ''} />
              {!collapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
              {!collapsed && item.href === '/tasks' && pendingCount > 0 && (
                <span className="ml-auto text-xs accent-bg-soft accent-text px-2 py-0.5 rounded-full font-medium">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-[var(--border)]">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 text-[var(--text-muted)] transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
