// Next.js App Router API route test template.
// Works with route handlers under app/api/<route>/route.ts that export GET/POST/etc.
//
// Pattern: invoke the route handler directly with a mocked NextRequest, assert on the Response.

import { describe, it, expect, vi } from 'vitest';

// import { GET, POST } from '@/app/api/your-route/route';

// Demo handlers so this file runs as-is. Delete and replace.
async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  return new Response(JSON.stringify({ echo: q }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  if (!body?.name) return new Response(JSON.stringify({ error: 'name required' }), { status: 422 });
  return new Response(JSON.stringify({ id: 'new', name: body.name }), { status: 201 });
}

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe('GET /api/your-route', () => {
  it('returns 200 and echoes the query param', async () => {
    const res = await GET(makeRequest('http://localhost/api/your-route?q=hello'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ echo: 'hello' });
  });

  it('returns empty echo when q is missing', async () => {
    const res = await GET(makeRequest('http://localhost/api/your-route'));
    const json = await res.json();
    expect(json).toEqual({ echo: '' });
  });
});

describe('POST /api/your-route — validation', () => {
  it('returns 422 if `name` is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/your-route', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    }));
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.error).toMatch(/name/i);
  });

  it('returns 400 on invalid JSON', async () => {
    const res = await POST(makeRequest('http://localhost/api/your-route', {
      method: 'POST',
      body: '{not json',
      headers: { 'content-type': 'application/json' },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 201 with the created resource on a valid body', async () => {
    const res = await POST(makeRequest('http://localhost/api/your-route', {
      method: 'POST',
      body: JSON.stringify({ name: 'alice' }),
      headers: { 'content-type': 'application/json' },
    }));
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j).toMatchObject({ name: 'alice' });
    expect(j.id).toBeTruthy();
  });
});

describe('side effects — DB / external services should be mocked at the boundary', () => {
  it('calls the external service exactly once per request', async () => {
    const externalCall = vi.fn().mockResolvedValue({ ok: true });
    // Pretend GET internally calls externalCall — replace with vi.mock or a DI seam.
    await externalCall('payload');
    expect(externalCall).toHaveBeenCalledTimes(1);
    expect(externalCall).toHaveBeenCalledWith('payload');
  });
});
