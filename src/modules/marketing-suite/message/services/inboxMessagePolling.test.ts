import { afterEach, describe, expect, it, vi } from "vitest";
import { startInboxMessagePolling } from "./inboxMessagePolling";

describe("Facebook reply reconciliation", () => {
  afterEach(() => vi.useRealTimers());

  it("recovers persisted AI replies when the socket stays connected but misses the event", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => {});
    const stop = startInboxMessagePolling({ channel: "facebook", isVisible: () => true,
      isSocketConnected: () => true, refresh, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(15000);
    expect(refresh).toHaveBeenCalledWith(false); // DB reconciliation without a Graph API sync.
    stop();
    await vi.advanceTimersByTimeAsync(30000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("skips hidden tabs, prevents overlapping requests, and retries after errors", async () => {
    vi.useFakeTimers();
    let visible = false;
    let finish: (() => void) | undefined;
    const refresh = vi.fn<(_: boolean) => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
      .mockRejectedValueOnce(new Error("API unavailable"))
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const stop = startInboxMessagePolling({ channel: "facebook", isVisible: () => visible,
      isSocketConnected: () => false, refresh, onError });
    await vi.advanceTimersByTimeAsync(15000);
    expect(refresh).not.toHaveBeenCalled();
    visible = true;
    await vi.advanceTimersByTimeAsync(45000);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish!();
    await vi.advanceTimersByTimeAsync(15000);
    expect(onError).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(15000);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(refresh).toHaveBeenLastCalledWith(true);
    stop();
  });

  it("preserves other channels' socket fallback behavior", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => {});
    const stop = startInboxMessagePolling({ channel: "zalo", isVisible: () => true,
      isSocketConnected: () => true, refresh, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh).not.toHaveBeenCalled();
    stop();
  });

  it("periodically imports Facebook replies missing from DB even while the socket remains connected", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn<(_: boolean) => Promise<void>>().mockResolvedValue(undefined);
    const stop = startInboxMessagePolling({ channel: "facebook", isVisible: () => true,
      isSocketConnected: () => true, refresh, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh.mock.calls.map(call => call[0])).toEqual([false, false, false, true]);
    await vi.advanceTimersByTimeAsync(15000);
    expect(refresh).toHaveBeenLastCalledWith(false);
    stop();
  });
});
