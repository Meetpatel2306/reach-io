// Error boundary test template — verifies that a child throwing renders the fallback,
// and that a happy child renders normally.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Replace with your real boundary:
// import ErrorBoundary from '@/components/ErrorBoundary';

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch() {}
  render() {
    if (this.state.err) return <>{this.props.fallback}</>;
    return this.props.children;
  }
}

function Boom({ when }: { when: boolean }): React.ReactElement {
  if (when) throw new Error('💥');
  return <p>fine</p>;
}

describe('ErrorBoundary', () => {
  // React logs the caught error to console.error; silence it for tidy output.
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>oh no</p>}>
        <Boom when={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByText('oh no')).not.toBeInTheDocument();
  });

  it('renders the fallback when a child throws on render', () => {
    render(
      <ErrorBoundary fallback={<p>oh no</p>}>
        <Boom when={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('oh no')).toBeInTheDocument();
    expect(screen.queryByText('fine')).not.toBeInTheDocument();
  });

  it('isolates the failure to the nearest boundary', () => {
    render(
      <div>
        <p>before</p>
        <ErrorBoundary fallback={<p>scoped</p>}>
          <Boom when={true} />
        </ErrorBoundary>
        <p>after</p>
      </div>
    );
    expect(screen.getByText('before')).toBeInTheDocument();
    expect(screen.getByText('after')).toBeInTheDocument();
    expect(screen.getByText('scoped')).toBeInTheDocument();
  });
});
