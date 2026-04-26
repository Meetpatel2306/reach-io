// Network mocking template — vi.spyOn(globalThis, 'fetch') for simple cases.
// For richer fixtures (request matching, scenarios) install msw and use setupServer.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// import { fetchUser, postOrder } from '@/lib/api-client';

// Demo client so this template runs as-is. Delete and replace.
async function fetchUser(id: string) {
  const r = await fetch(`/api/users/${id}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function postOrder(payload: any) {
  const r = await fetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function jsonResponse(body: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('fetchUser', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { fetchMock = vi.spyOn(globalThis, 'fetch'); });
  afterEach(() => { fetchMock.mockRestore(); });

  it('returns the parsed user on 200', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'u-1', name: 'Alice' }));
    await expect(fetchUser('u-1')).resolves.toEqual({ id: 'u-1', name: 'Alice' });
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u-1');
  });

  it('throws on non-200', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }));
    await expect(fetchUser('u-x')).rejects.toThrow(/404/);
  });

  it('rethrows network errors', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(fetchUser('u-1')).rejects.toThrow('offline');
  });
});

describe('postOrder', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { fetchMock = vi.spyOn(globalThis, 'fetch'); });
  afterEach(() => { fetchMock.mockRestore(); });

  it('sends the payload as JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'o-1' }, { status: 201 }));
    await postOrder({ sku: 'X', qty: 2 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/orders');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({ 'content-type': 'application/json' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ sku: 'X', qty: 2 });
  });
});

describe('multi-call sequencing — different responses for successive calls', () => {
  it('returns failure-then-success when re-implementing fetch in sequence', async () => {
    let n = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      n++;
      if (n === 1) return new Response('x', { status: 500 });
      return jsonResponse({ ok: true });
    });
    await expect(fetchUser('u-1')).rejects.toThrow();
    await expect(fetchUser('u-1')).resolves.toEqual({ ok: true });
  });
});
