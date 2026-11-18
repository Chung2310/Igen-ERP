// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chatTestService } from "./chatTestService";
vi.mock("../../shared/services/authService", () => ({ getAccessToken: () => "test-token" }));
const fetcher = vi.fn();
beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ data: { id: "message" } }), blob: async () => new Blob(["image"]) });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

it("sends the whole image batch as repeated multipart image fields", async () => {
  const files = ["one", "two", "three"].map(name => new File([name], name + ".png", { type: "image/png" }));
  await chatTestService.send("session", "client-message", "Nội dung", files);
  const [url, request] = fetcher.mock.calls[0];
  expect(url).toBe("/api/v1/omni-inbox/chat-test/session/messages");
  expect(request.body.getAll("image").map((file: File) => file.name)).toEqual(files.map(file => file.name));
  expect(request.body.get("clientMessageId")).toBe("client-message");
  expect(request.body.get("text")).toBe("Nội dung");
  expect(request.headers.Authorization).toBe("Bearer test-token");
});

it("retains single-image calls and authenticates indexed image downloads", async () => {
  const file = new File(["one"], "one.png", { type: "image/png" });
  await chatTestService.send("session", "legacy-client", "", file);
  expect(fetcher.mock.calls[0][1].body.getAll("image")).toHaveLength(1);
  const controller = new AbortController();
  await chatTestService.image("session", "message", controller.signal, 2);
  expect(fetcher).toHaveBeenLastCalledWith("/api/v1/omni-inbox/chat-test/session/messages/message/image?index=2",
    { signal: controller.signal, headers: { Authorization: "Bearer test-token" } });
});
