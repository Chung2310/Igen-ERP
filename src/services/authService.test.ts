// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { authService } from "./authService";

afterEach(() => vi.unstubAllGlobals());

test('getMe preserves the session and surfaces a temporary server error', async () => {
  localStorage.setItem('accessToken', 'test-token');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
  await expect(authService.getMe()).rejects.toThrow('Không thể tải phiên');
  expect(fetch).toHaveBeenCalledOnce();
  expect(localStorage.getItem('accessToken')).toBe('test-token');
});

test('getMe never restores a late response after the user has logged out', async () => {
  let complete!: (value: Response) => void;
  localStorage.setItem('accessToken', 'old-login');
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
  const result = authService.getMe(); await Promise.resolve();
  localStorage.removeItem('accessToken');
  complete(new Response(JSON.stringify({ user: { _id: 'old-user' } })));
  await expect(result).rejects.toThrow('đã thay đổi');
});

test('getMe stops waiting when the profile endpoint never responds', async () => {
  vi.useFakeTimers();
  try {
    localStorage.setItem('accessToken', 'test-token');
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const result = Promise.allSettled([authService.getMe()]);
    await vi.advanceTimersByTimeAsync(20000);
    expect((await result)[0]).toMatchObject({ status: 'rejected', reason: expect.objectContaining({ message: expect.stringContaining('quá lâu') }) });
    expect(localStorage.getItem('accessToken')).toBe('test-token');
  } finally { vi.useRealTimers(); }
});

test("getColleagues excludes inactive users", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
    { _id: "active-tech", displayName: "Active technician", isActive: true },
    { _id: "inactive-tech", displayName: "Inactive technician", isActive: false },
  ] }), { status: 200 })));

  await expect(authService.getColleagues()).resolves.toEqual([
    expect.objectContaining({ uid: "active-tech", isActive: true }),
  ]);
});
