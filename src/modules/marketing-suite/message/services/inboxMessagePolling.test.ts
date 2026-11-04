import { afterEach, describe, expect, it, vi } from "vitest";
import { startInboxMessagePolling } from "./inboxMessagePolling";

describe("Facebook reply reconciliation", () => {
  afterEach(() => vi.useRealTimers());

  it("does not poll history when the selected realtime subscription is confirmed", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => {});
    const stop = startInboxMessagePolling({ channel: "facebook", isVisible: () => true,
      isSocketConnected: () => true, refresh, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh).not.toHaveBeenCalled();
    stop();
    await vi.advanceTimersByTimeAsync(30000);
    expect(refresh).not.toHaveBeenCalled();
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
    expect(refresh).toHaveBeenLastCalledWith(false);
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

  it("uses only DB fallback before subscription confirmation and stops after recovery", async () => {
    vi.useFakeTimers();
    let ready = false;
    const refresh = vi.fn<(_: boolean) => Promise<void>>().mockResolvedValue(undefined);
    const stop = startInboxMessagePolling({ channel: "facebook", isVisible: () => true,
      isSocketConnected: () => ready, refresh, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh.mock.calls.map(call => call[0])).toEqual([false, false, false, false]);
    ready = true;
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh).toHaveBeenCalledTimes(4);
    stop();
  });
});
