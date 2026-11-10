import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), sync: vi.fn(), access: vi.fn() }));
vi.mock("../../shared/model/social-integration.model", () => ({ SocialIntegrationModel: { find: mocks.find } }));
vi.mock("../webhook-access", () => ({ canProcessMessengerWebhook: mocks.access }));
vi.mock("./fb-messenger.service", () => ({ fbMessengerService: { syncConversationsFromFacebook: mocks.sync } }));

const page = { _id: "one", companyCode: "RUBYQUEEN", username: "1440398419152197", createdBy: "author" };
let pages = [page];
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  pages = [page];
  mocks.find.mockImplementation(() => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => pages }) }) }) }));
  mocks.access.mockResolvedValue(true);
  mocks.sync.mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.clearAllTimers(); vi.useRealTimers(); });

it("reconciles only enabled company Pages using their tenant and owner token context", async () => {
  const { reconcileFacebookInboxes } = await import("./facebook-inbox-sync.service");
  await reconcileFacebookInboxes();
  expect(mocks.find).toHaveBeenCalledWith({ platform: "Facebook", isConnected: true, "aiAutoReplyConfig.enabled": true });
  expect(mocks.access).toHaveBeenCalledWith("Facebook", page.username);
  expect(mocks.sync).toHaveBeenCalledWith(page.username, { companyCode: "RUBYQUEEN", source: "company", userId: "author" }, { reconcileMessages: true });
});

it("does not poll Pages whose ownership or module access is blocked", async () => {
  mocks.access.mockResolvedValue(false);
  const { reconcileFacebookInboxes } = await import("./facebook-inbox-sync.service");
  await reconcileFacebookInboxes();
  expect(mocks.sync).not.toHaveBeenCalled();
});

it("keeps other Pages progressing after a Page fails and allows a later cycle", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  pages = [page, { ...page, _id: "two", username: "222" }];
  mocks.sync.mockRejectedValueOnce(new Error("Facebook unavailable"));
  const { reconcileFacebookInboxes } = await import("./facebook-inbox-sync.service");
  await reconcileFacebookInboxes();
  expect(mocks.sync).toHaveBeenCalledTimes(2);
  await reconcileFacebookInboxes();
  expect(mocks.sync).toHaveBeenCalledTimes(4);
});

it("does not overlap cycles and limits concurrent Page requests to two", async () => {
  pages = [page, { ...page, _id: "two", username: "222" }, { ...page, _id: "three", username: "333" }];
  const releases: Array<() => void> = [];
  mocks.sync.mockImplementation(() => new Promise<void>(resolve => { releases.push(resolve); }));
  const { reconcileFacebookInboxes } = await import("./facebook-inbox-sync.service");
  const first = reconcileFacebookInboxes();
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(2));
  await reconcileFacebookInboxes();
  expect(mocks.find).toHaveBeenCalledTimes(1);
  releases[0]();
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(3));
  releases[1](); releases[2]();
  await first;
});

it("rotates bounded batches so Pages beyond the first batch are not starved", async () => {
  pages = Array.from({ length: 25 }, (_, index) => ({ ...page, _id: String(index), username: String(100 + index) }));
  const { reconcileFacebookInboxes } = await import("./facebook-inbox-sync.service");
  await reconcileFacebookInboxes();
  pages = [{ ...page, _id: "25", username: "125" }];
  await reconcileFacebookInboxes();
  expect(mocks.find).toHaveBeenLastCalledWith(expect.objectContaining({ _id: { $gt: "24" } }));
  await reconcileFacebookInboxes();
  expect(mocks.find.mock.lastCall?.[0]).not.toHaveProperty("_id");
});

it("starts periodic reconciliation only inside a worker process", async () => {
  vi.useFakeTimers();
  const { startFacebookInboxSyncWorker } = await import("./facebook-inbox-sync.service");
  vi.stubEnv("MARKETING_WORKER_PROCESS", "false");
  startFacebookInboxSyncWorker();
  expect(mocks.find).not.toHaveBeenCalled();
  vi.stubEnv("MARKETING_WORKER_PROCESS", "true");
  startFacebookInboxSyncWorker(); startFacebookInboxSyncWorker();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(mocks.find).toHaveBeenCalledTimes(2);
});
