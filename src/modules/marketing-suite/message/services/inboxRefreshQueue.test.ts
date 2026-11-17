import { afterEach, expect, it, vi } from "vitest";
import { createInboxRefreshQueue } from "./inboxRefreshQueue";

afterEach(() => { vi.useRealTimers(); });

it("coalesces repeated Facebook refreshes without loading an unrelated channel", async () => {
  vi.useFakeTimers();
  const loadFacebook = vi.fn(async () => {});
  const loadZalo = vi.fn(async () => {});
  const queue = createInboxRefreshQueue(async (channels: Array<"facebook" | "zalo">) => {
    if (channels.includes("facebook")) await loadFacebook();
    if (channels.includes("zalo")) await loadZalo();
  });
  for (let index = 0; index < 50; index++) queue.request("facebook");
  await vi.advanceTimersByTimeAsync(250);
  expect(loadFacebook).toHaveBeenCalledOnce();
  expect(loadZalo).not.toHaveBeenCalled();
  queue.dispose();
});

it("keeps a single trailing refresh for events received during an in-flight request", async () => {
  vi.useFakeTimers();
  let complete!: () => void;
  const pending = new Promise<void>(resolve => { complete = resolve; });
  const refresh = vi.fn(async (_scopes: string[]) => {}).mockReturnValueOnce(pending);
  const queue = createInboxRefreshQueue(refresh);
  queue.request("facebook");
  await vi.advanceTimersByTimeAsync(250);
  queue.request("facebook");
  queue.request("zalo");
  queue.request("zalo");
  await vi.advanceTimersByTimeAsync(1000);
  expect(refresh).toHaveBeenCalledTimes(1);
  complete();
  await vi.advanceTimersByTimeAsync(250);
  expect(refresh.mock.calls).toEqual([[["facebook"]], [["facebook", "zalo"]]]);
  queue.request("facebook");
  queue.dispose();
  await vi.runAllTimersAsync();
  expect(refresh).toHaveBeenCalledTimes(2);
});
