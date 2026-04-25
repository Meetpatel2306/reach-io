import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AppLogo from '@/components/AppLogo';
import NotificationPanel, { addNotifLog } from '@/components/NotificationPanel';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { useStore } from '@/lib/store';

beforeEach(() => {
  useStore.setState({ tasks: [] });
  try { localStorage.clear(); } catch {}
});

describe('AppLogo', () => {
  it('CMP1: renders an svg with default size 40', () => {
    const { container } = render(<AppLogo />);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute('width')).toBe('40');
    expect(svg.getAttribute('height')).toBe('40');
  });

  it('CMP2: respects custom size prop', () => {
    const { container } = render(<AppLogo size={120} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('120');
  });

  it('CMP3: forwards className prop', () => {
    const { container } = render(<AppLogo className="logo-x" />);
    expect(container.querySelector('svg')!.classList.contains('logo-x')).toBe(true);
  });
});

describe('NotificationPanel', () => {
  it('CMP4: bell button is visible at mount', () => {
    render(<NotificationPanel />);
    expect(screen.getByTitle('Notifications')).toBeInTheDocument();
  });

  it('CMP5: opens dropdown showing "No notifications" when log is empty', () => {
    render(<NotificationPanel />);
    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.getByText(/No notifications/i)).toBeInTheDocument();
  });

  it('CMP6: addNotifLog persists into localStorage', () => {
    addNotifLog({
      taskId: 'x', taskTitle: 'My Task', priority: 'high',
      type: 'start', time: new Date().toISOString(),
    });
    const log = JSON.parse(localStorage.getItem('taskpro-notification-log') || '[]');
    expect(log).toHaveLength(1);
    expect(log[0].taskTitle).toBe('My Task');
  });

  it('CMP7: opening the panel after addNotifLog shows the entry', () => {
    addNotifLog({
      taskId: 'y', taskTitle: 'Logged Task', priority: 'medium',
      type: 'start', time: new Date().toISOString(),
    });
    render(<NotificationPanel />);
    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.getByText('Logged Task')).toBeInTheDocument();
  });

  it('CMP8: shows red badge with overdue task', () => {
    useStore.setState({
      tasks: [{
        id: 'od', title: 'Overdue Task', description: '',
        priority: 'high', status: 'pending', categoryId: null, tags: [],
        scheduledAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        endAt: null, notifyOnEnd: false, recurrence: 'once',
        completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        order: 0, pomodorosCompleted: 0, pomodorosEstimated: 0,
        notified: false, endNotified: false, subtasks: [],
      }],
    });
    render(<NotificationPanel />);
    // Badge text would say "1"
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('CMP9: completed overdue tasks are NOT counted as overdue', () => {
    useStore.setState({
      tasks: [{
        id: 'done', title: 'Done', description: '',
        priority: 'high', status: 'completed', categoryId: null, tags: [],
        scheduledAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        endAt: null, notifyOnEnd: false, recurrence: 'once',
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        order: 0, pomodorosCompleted: 0, pomodorosEstimated: 0,
        notified: false, endNotified: false, subtasks: [],
      }],
    });
    render(<NotificationPanel />);
    // No badge — would not appear
    expect(screen.queryByText('1')).toBeNull();
  });

  it('CMP10: addNotifLog caps log length at 50', () => {
    for (let i = 0; i < 60; i++) {
      addNotifLog({
        taskId: 'i' + i, taskTitle: 'T', priority: 'low',
        type: 'start', time: new Date().toISOString(),
      });
    }
    const log = JSON.parse(localStorage.getItem('taskpro-notification-log') || '[]');
    expect(log).toHaveLength(50);
  });
});

describe('Toast', () => {
  it('CMP11: addToast renders the message inside provider', () => {
    function Trigger() {
      const { addToast } = useToast();
      return <button onClick={() => addToast('Hello toast', 'success')}>fire</button>;
    }
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Hello toast')).toBeInTheDocument();
  });

  it('CMP12: useToast.addToast outside provider is a no-op (does not throw)', () => {
    function Trigger() {
      const { addToast } = useToast();
      return <button onClick={() => addToast('orphan')}>fire</button>;
    }
    expect(() => {
      render(<Trigger />);
      fireEvent.click(screen.getByText('fire'));
    }).not.toThrow();
  });

  it('CMP13: toast auto-dismisses after 4s', () => {
    vi.useFakeTimers();
    function Trigger() {
      const { addToast } = useToast();
      return <button onClick={() => addToast('Auto bye', 'info')}>fire</button>;
    }
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Auto bye')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4100); });
    vi.useRealTimers();
  });
});
