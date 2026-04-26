// Snapshot testing template — useful for catching unintended rendering changes.
// Tip: snapshots work best on small, stable components. For volatile output, prefer toMatchInlineSnapshot
// with normalized values, or assert specific text instead.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

function Badge({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: React.ReactNode }) {
  const cls = { info: 'bg-blue', warn: 'bg-yellow', error: 'bg-red' }[tone];
  return <span className={`badge ${cls}`}>{children}</span>;
}

describe('Badge — snapshots', () => {
  it.each(['info', 'warn', 'error'] as const)('snapshot for tone=%s', (tone) => {
    const { container } = render(<Badge tone={tone}>label</Badge>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('inline snapshot for stable content', () => {
    const { container } = render(<Badge tone="info">x</Badge>);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class=\\"badge bg-blue\\">x</span>"`);
  });
});

describe('snapshot pitfalls — normalize before snapshotting', () => {
  it('strips dynamic content before snapshotting', () => {
    const html = `<div data-testid="x" id="auto-${Math.random()}">hello</div>`;
    const normalized = html.replace(/id="auto-[^"]+"/, 'id="auto-STABLE"');
    expect(normalized).toMatchInlineSnapshot(`"<div data-testid=\\"x\\" id=\\"auto-STABLE\\">hello</div>"`);
  });
});
