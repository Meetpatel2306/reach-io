// Network mocking helpers — small, dependency-free wrapper around vi.spyOn(globalThis, 'fetch').
// For richer scenarios install msw and use setupServer.

import { vi, type MockInstance } from 'vitest';

export interface MockedFetch {
  spy: MockInstance;
  /** Replace the *next* call's response with this body+status. */
  next(body: any, init?: ResponseInit): void;
  /** Replace every call with this body+status until cleared. */
  always(body: any, init?: ResponseInit): void;
  /** Make every call reject with this error. */
  fail(err?: Error): void;
  /** Inspect call args for assertion. */
  calls: () => Array<[string, RequestInit | undefined]>;
  /** Restore original fetch. */
  restore(): void;
}

export function jsonResponse(body: any, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

/** Quickly set up a mocked fetch with the helpers above. Call .restore() in afterEach. */
export function mockFetch(): MockedFetch {
  const spy = vi.spyOn(globalThis, 'fetch');
  const queued: Response[] = [];
  let always: Response | null = null;
  let failure: Error | null = null;

  spy.mockImplementation(async () => {
    if (failure) throw failure;
    if (queued.length > 0) return queued.shift()!;
    if (always) return always;
    return jsonResponse({});
  });

  return {
    spy,
    next(body, init) { queued.push(jsonResponse(body, init)); },
    always(body, init) { always = jsonResponse(body, init); },
    fail(err = new Error('network')) { failure = err; },
    calls: () => spy.mock.calls.map((c) => [c[0] as string, c[1] as RequestInit | undefined]),
    restore() { spy.mockRestore(); },
  };
}

/** Build a sequence of responses: first call gets first response, etc. */
export function sequencedFetch(responses: Array<{ body: any; init?: ResponseInit }>): MockInstance {
  let i = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return jsonResponse(r.body, r.init);
  });
}
