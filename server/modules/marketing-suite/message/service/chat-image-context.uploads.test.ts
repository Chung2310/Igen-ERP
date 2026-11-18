import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { analyzeChatImages } from "./chat-image-context";
import { generateText } from "../../shared/service/gemini/core";

vi.mock("../../shared/service/gemini/core", () => ({
  AI_REPLY_MESSAGE_MODEL: "test-model", generateText: vi.fn(), safeParseJson: JSON.parse,
}));
const image = "data:image/png;base64,aW1hZ2U=";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify({
    readable: true, needsSelection: false, description: "Ảnh giấy tờ khách gửi",
    productType: "other", cakeShape: "unknown", shapeConfidence: "low", selectedImageIndex: 0,
  }) });
});
afterEach(() => vi.unstubAllGlobals());

it("uses the normal image analyzer with uploaded pixels and the Chat Message key scope", async () => {
  expect(await analyzeChatImages([], "Đọc ảnh giúp tôi", [image])).toMatchObject({ status: "ready", description: "Ảnh giấy tờ khách gửi" });
  expect(fetch).not.toHaveBeenCalled();
  expect(generateText).toHaveBeenCalledWith("test-model", expect.any(String),
    expect.objectContaining({ keyScope: "chat-message", images: [image] }));
});

it("keeps the external URL allowlist for regular inbox attachments", async () => {
  expect(await analyzeChatImages(["http://127.0.0.1/private"])).toMatchObject({ status: "unavailable", reason: "download_failed" });
  expect(fetch).not.toHaveBeenCalled();
  expect(generateText).not.toHaveBeenCalled();
});

it("asks for a selection when the upload count exceeds the supported batch", async () => {
  expect(await analyzeChatImages([], "", [image, image, image, image])).toMatchObject({ status: "needs_selection" });
  expect(generateText).not.toHaveBeenCalled();
});
