// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { marketingService } from "./marketingService";
vi.mock("../../shared/services/authService", () => ({ getAccessToken: () => "session" }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("passes all images and avoids a second PATCH after a canonical Campaign schedule", async () => {
  const card = { authorUid: "owner", title: "Title", bodyText: "Body", channel: "Facebook", campaignSlotId: "slot", imageUrl: "https://cdn.invalid/1.jpg", mediaUrls: ["https://cdn.invalid/1.jpg", "https://cdn.invalid/2.jpg"] };
  vi.spyOn(marketingService, "getCardById").mockResolvedValue(card as Awaited<ReturnType<typeof marketingService.getCardById>>);
  const update = vi.spyOn(marketingService, "updateCard").mockResolvedValue(undefined);
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { facebookIntegration: { isConnected: true, pageId: "page" } } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success", data: { campaignScheduled: true } })));
  vi.stubGlobal("fetch", fetcher);
  await marketingService.scheduleCard("card", "2027-01-10", "09:30");
  expect(JSON.parse(fetcher.mock.calls[1][1].body).mediaUrls).toEqual(card.mediaUrls);
  expect(update).not.toHaveBeenCalled();
});
it("loads all pages rather than silently stopping at 1000 cards", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ _id: "first" }], total: 2 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ _id: "second" }], total: 2 })));
  vi.stubGlobal("fetch", fetcher);
  expect((await marketingService.getCards()).map(card => card.id)).toEqual(["first", "second"]);
  expect(fetcher.mock.calls[1][0]).toContain("page=2");
});
it("prevents overlapping polls and suppresses late updates after leaving the page", async () => {
  vi.useFakeTimers();
  let resolveCards!: (cards: []) => void;
  const get = vi.spyOn(marketingService, "getCards").mockImplementation(() => new Promise(resolve => { resolveCards = resolve; }));
  const update = vi.fn(), error = vi.fn();
  const stop = marketingService.subscribeToContents(update, error);
  await vi.advanceTimersByTimeAsync(90_000);
  expect(get).toHaveBeenCalledTimes(1);
  const signal = get.mock.calls[0][1];
  stop(); resolveCards([]);
  await Promise.resolve();
  expect(signal?.aborted).toBe(true);
  expect(update).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
