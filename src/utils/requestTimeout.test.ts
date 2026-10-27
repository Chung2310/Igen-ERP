import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRequestTimeout } from './requestTimeout';

afterEach(() => vi.useRealTimers());

describe('bounded read requests', () => {
  it('settles and aborts a hung request at its deadline', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const pending = withRequestTimeout((signal) => { requestSignal = signal; return new Promise(() => {}); }, 1000, 'Timed out');
    const assertion = expect(pending).rejects.toThrow('Timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases a request when its caller aborts, even if the underlying request ignores it', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = withRequestTimeout(() => new Promise(() => {}), 1000, 'Timed out', controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up the deadline after success and never starts already cancelled work', async () => {
    vi.useFakeTimers();
    await expect(withRequestTimeout(async () => 'ok', 1000, 'Timed out')).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn(async () => 'unexpected');
    await expect(withRequestTimeout(request, 1000, 'Timed out', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
  });
});
