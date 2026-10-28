// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); localStorage.setItem('accessToken', 'old-token'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('bounded shared session refresh', () => {
  it('does not let an older session block or clear a newer session refresh', async () => {
    let completeOld!: (value: Response) => void, completeNew!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { completeOld = resolve; })).mockImplementationOnce(() => new Promise<Response>((resolve) => { completeNew = resolve; }));
    const { refreshAccessToken } = await import('./sessionRefresh');
    const old = Promise.allSettled([refreshAccessToken(fetcher)]);
    await Promise.resolve();
    localStorage.setItem('accessToken', 'another-login');
    const current = refreshAccessToken(fetcher);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    completeOld(new Response('{}', { status: 401 }));
    expect((await old)[0].status).toBe('rejected');
    expect(refreshAccessToken(fetcher)).toBe(current);
    completeNew(new Response(JSON.stringify({ accessToken: 'another-refreshed-token' })));
    await expect(current).resolves.toBe('another-refreshed-token');
    expect(localStorage.getItem('accessToken')).toBe('another-refreshed-token');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('shares one refresh and retains the token on a network timeout', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    const { refreshAccessToken } = await import('./sessionRefresh');
    const result = Promise.allSettled([refreshAccessToken(fetcher), refreshAccessToken(fetcher)]);
    await vi.advanceTimersByTimeAsync(10000);
    expect((await result).map((value) => value.status)).toEqual(['rejected', 'rejected']);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('accessToken')).toBe('old-token');
    expect(fetcher.mock.calls[0]?.length).toBe(2);
  });
  it('releases the refresh after failure so a user can retry', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'new-token' })));
    const { refreshAccessToken } = await import('./sessionRefresh');
    await expect(refreshAccessToken(fetcher)).rejects.toThrow('Hãy thử lại');
    await expect(refreshAccessToken(fetcher)).resolves.toBe('new-token');
    expect(localStorage.getItem('accessToken')).toBe('new-token');
  });
  it('never overwrites a different login while a refresh is in progress', async () => {
    let complete!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; }));
    const { refreshAccessToken } = await import('./sessionRefresh');
    const result = refreshAccessToken(fetcher);
    await Promise.resolve();
    localStorage.setItem('accessToken', 'another-login');
    complete(new Response(JSON.stringify({ accessToken: 'stale-token' })));
    await expect(result).rejects.toThrow('đã thay đổi');
    expect(localStorage.getItem('accessToken')).toBe('another-login');
  });
  it('invalidates the session only when the refresh credentials are rejected', async () => {
    const expired = vi.fn(); window.addEventListener('unauthorized', expired);
    try {
      const { refreshAccessToken } = await import('./sessionRefresh');
      await expect(refreshAccessToken(vi.fn(async () => new Response('{}', { status: 401 })))).resolves.toBeNull();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(expired).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('unauthorized', expired); }
  });
});
