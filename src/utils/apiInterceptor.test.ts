// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); localStorage.setItem('accessToken', 'old-token'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('bounds concurrent 401 waiters even when refresh never responds', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn((input: RequestInfo | URL) => String(input).includes('refresh-token') ? new Promise<Response>(() => {}) : Promise.resolve(new Response('{}', { status: 401 })));
  vi.stubGlobal('fetch', fetcher);
  await import('./apiInterceptor');
  const result = Promise.allSettled([fetch('/api/v1/first'), fetch('/api/v1/second')]);
  await vi.advanceTimersByTimeAsync(10000);
  expect((await result).every((value) => value.status === 'rejected')).toBe(true);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes('refresh-token'))).toHaveLength(1);
  expect(localStorage.getItem('accessToken')).toBe('old-token');
});
it('handles URL inputs and preserves Request headers when retrying', async () => {
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('refresh-token')) return Promise.resolve(new Response(JSON.stringify({ accessToken: 'new-token' })));
    return Promise.resolve(new Response('{}', { status: new Headers(init?.headers).get('Authorization') === 'Bearer new-token' ? 200 : 401 }));
  });
  vi.stubGlobal('fetch', fetcher); await import('./apiInterceptor');
  await expect(fetch(new URL('/api/v1/example', location.origin), { headers: { 'x-branch-id': 'b1' } })).resolves.toMatchObject({ status: 200 });
  const headers = new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers);
  expect(headers.get('x-branch-id')).toBe('b1');
  expect(headers.get('Authorization')).toBe('Bearer new-token');
});
it('does not refresh third party requests', async () => {
  const fetcher = vi.fn(async () => new Response('{}', { status: 401 }));
  vi.stubGlobal('fetch', fetcher); await import('./apiInterceptor');
  await expect(fetch('https://example.test/image')).resolves.toMatchObject({ status: 401 });
  expect(fetcher).toHaveBeenCalledOnce();
});

it('never replays a stale explicit bearer token under a different account', async () => {
  localStorage.setItem('accessToken', 'another-account-token');
  const fetcher = vi.fn(async () => new Response('{}', { status: 401 }));
  vi.stubGlobal('fetch', fetcher); await import('./apiInterceptor');
  await expect(fetch('/api/v1/customer-action', { method: 'POST', headers: { Authorization: 'Bearer old-token' }, body: '{}' })).rejects.toThrow('đã thay đổi');
  expect(fetcher).toHaveBeenCalledOnce();
  expect(localStorage.getItem('accessToken')).toBe('another-account-token');
});

it('releases a logged-out caller as unauthorized instead of leaving a stale authenticated screen', async () => {
  localStorage.removeItem('accessToken');
  const expired = vi.fn(); window.addEventListener('unauthorized', expired);
  try {
    const fetcher = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetcher); await import('./apiInterceptor');
    await expect(fetch('/api/v1/example', { headers: { Authorization: 'Bearer old-token' } })).resolves.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
  } finally { window.removeEventListener('unauthorized', expired); }
});

it('reuses the refreshed token for a late 401 from the same session without refreshing again', async () => {
  let late!: (value: Response) => void;
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('refresh-token')) return Promise.resolve(new Response(JSON.stringify({ accessToken: 'new-token' })));
    if (new Headers(init?.headers).get('Authorization') === 'Bearer new-token') return Promise.resolve(new Response('{}'));
    if (String(input).endsWith('/late')) return new Promise<Response>((resolve) => { late = resolve; });
    return Promise.resolve(new Response('{}', { status: 401 }));
  });
  vi.stubGlobal('fetch', fetcher); await import('./apiInterceptor');
  const delayed = fetch('/api/v1/late', { headers: { Authorization: 'Bearer old-token' } });
  await expect(fetch('/api/v1/first', { headers: { Authorization: 'Bearer old-token' } })).resolves.toMatchObject({ status: 200 });
  late(new Response('{}', { status: 401 }));
  await expect(delayed).resolves.toMatchObject({ status: 200 });
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes('refresh-token'))).toHaveLength(1);
});

it('preserves a Request body and branch header when retrying after refresh', async () => {
  const bodies: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('refresh-token')) return new Response(JSON.stringify({ accessToken: 'new-token' }));
    bodies.push(await (input as Request).text());
    const headers = new Headers(init?.headers ?? (input as Request).headers);
    expect(headers.get('x-branch-id')).toBe('b1');
    return new Response('{}', { status: headers.get('Authorization') === 'Bearer new-token' ? 200 : 401 });
  });
  vi.stubGlobal('fetch', fetcher); await import('./apiInterceptor');
  const request = new Request(new URL('/api/v1/action', location.origin), { method: 'POST', body: '{"message":"test"}', headers: { Authorization: 'Bearer old-token', 'x-branch-id': 'b1' } });
  await expect(fetch(request)).resolves.toMatchObject({ status: 200 });
  expect(bodies).toEqual(['{"message":"test"}', '{"message":"test"}']);
});
