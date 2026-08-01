import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./authService", () => ({ getAccessToken: () => "test-token" }));
import { inventoryCategoryService } from "./inventoryCategoryService";
import { inventoryProductService } from "./inventoryProductService";
import { inventoryStockLogService } from "./inventoryStockLogService";

describe("inventory subscriptions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ["products", inventoryProductService.subscribe],
    ["categories", inventoryCategoryService.subscribe],
    ["stock logs", inventoryStockLogService.subscribe],
  ])("loads %s for the explicit branch and aborts on cleanup", async (_name, subscribe) => {
    const cleanup = subscribe("branch-b", vi.fn());

    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("x-branch-id")).toBe("branch-b");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);

    cleanup();

    expect(init?.signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not publish a response that finishes after subscription cleanup", async () => {
    let resolveBody!: (value: { data: [] }) => void;
    const body = new Promise<{ data: [] }>((resolve) => {
      resolveBody = resolve;
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => body,
    } as Response);
    const callback = vi.fn();

    const cleanup = inventoryProductService.subscribe("branch-a", callback);
    await Promise.resolve();
    cleanup();
    resolveBody({ data: [] });
    await body;
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
  });
});
