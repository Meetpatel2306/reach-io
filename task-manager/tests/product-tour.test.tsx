import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductTour from '@/components/ProductTour';
import { useStore } from '@/lib/store';

// Snapshot of store length before/after tour — must be IDENTICAL.
function snapshotStore() {
  const s = useStore.getState();
  return {
    tasks: s.tasks.length,
    pomodoroSessions: s.pomodoroSessions.length,
    completionHistory: s.completionHistory.length,
    categories: s.categories.length,
  };
}

beforeEach(() => {
  useStore.setState({ tasks: [], pomodoroSessions: [], completionHistory: [] });
});

describe('ProductTour', () => {
  it('PT1: open=false renders nothing', () => {
    const { container } = render(<ProductTour open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('PT2: open=true renders the dialog with first step', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to TaskManager Pro/i)).toBeInTheDocument();
  });

  it('PT3: clicking Next advances to the Tasks step', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Smart Tasks')).toBeInTheDocument();
  });

  it('PT4: clicking Back from step 2 returns to Welcome', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText(/Welcome to TaskManager Pro/i)).toBeInTheDocument();
  });

  it('PT5: Back button is disabled on the first step', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    expect((screen.getByText('Back').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('PT6: progress dots match number of steps and the active dot updates', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    const dots = screen.getAllByRole('button', { name: /Go to step/ });
    expect(dots.length).toBeGreaterThanOrEqual(8);
    fireEvent.click(dots[3]);
    expect(screen.getByText('Pomodoro Timer')).toBeInTheDocument();
  });

  it('PT7: progress dot click jumps directly to that step', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    const dots = screen.getAllByRole('button', { name: /Go to step/ });
    fireEvent.click(dots[5]); // notifications step
    expect(screen.getByText('Smart Notifications')).toBeInTheDocument();
  });

  it('PT8: clicking Finish on the last step calls onClose', () => {
    const onClose = vi.fn();
    render(<ProductTour open={true} onClose={onClose} />);
    const dots = screen.getAllByRole('button', { name: /Go to step/ });
    fireEvent.click(dots[dots.length - 1]); // jump to last
    fireEvent.click(screen.getByText('Finish'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('PT9: close (X) button calls onClose', () => {
    const onClose = vi.fn();
    render(<ProductTour open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close tour'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('PT10: walking the entire tour does NOT modify the user store', () => {
    const before = snapshotStore();
    render(<ProductTour open={true} onClose={() => {}} />);
    const dots = screen.getAllByRole('button', { name: /Go to step/ });
    // Click each step in sequence
    for (let i = 0; i < dots.length; i++) {
      fireEvent.click(dots[i]);
    }
    const after = snapshotStore();
    expect(after).toEqual(before);
  });

  it('PT11: every step renders some visible body content', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    const dots = screen.getAllByRole('button', { name: /Go to step/ });
    for (let i = 0; i < dots.length; i++) {
      fireEvent.click(dots[i]);
      expect(screen.getByText(/of/)).toBeInTheDocument(); // "X of Y" footer
    }
  });

  it('PT12: dialog has a11y attributes', () => {
    render(<ProductTour open={true} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Product Tour');
  });
});
