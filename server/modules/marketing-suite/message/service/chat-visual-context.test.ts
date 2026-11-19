import { expect, it } from "vitest";
import { parseChatVisualReply, visualToImageObservation, type ChatVisualInput } from "./chat-visual-context";

const input: ChatVisualInput = {
  images: ["image_1", "image_2"].map(id => ({ id, hash: id, width: 3, height: 3, dataUrl: "data:image/png;base64,fixture", messageId: "message" })),
  messageId: "message", sourceMessageIds: ["message"], customerMessage: "[Ảnh]",
};
const reply = (subjectType?: string) => ({
  replyDraft: "Hai ảnh có thông tin hồ sơ. Bạn muốn kiểm tra phần nào?",
  visual: { ...(subjectType ? { subjectType } : {}), readable: true, needsSelection: false, selectedImageId: "",
    summary: "Hai ảnh tài liệu", facts: input.images.map((image, index) => ({ key: "record", value: `Hồ sơ ${index + 1}`, imageId: image.id, confidence: "high" })),
    customerRequests: [], uncertainties: [] },
});

it("accepts two readable documents without forcing one selected image", () => {
  const result = parseChatVisualReply(reply("document"), input);
  expect(result.text).toContain("Hai ảnh");
  expect(result.visual).toMatchObject({ subjectType: "document", selectedImageId: "", needsSelection: false });
  expect(result.visual.facts.map(fact => fact.imageId)).toEqual(["image_1", "image_2"]);
  const observation = visualToImageObservation(result.visual, input.images);
  expect(observation.status).toBe("ready");
  expect(observation.cakeShape).toBeUndefined();
});

it("asks for a sample choice instead of failing or inventing a selected product", () => {
  const payload = reply();
  payload.replyDraft = "Giá mẫu này là 500.000đ";
  const result = parseChatVisualReply(payload, input);
  expect(result.visual).toMatchObject({ subjectType: "product", selectedImageId: "", needsSelection: true });
  expect(result.text).toContain("ảnh nào");
  expect(result.text).not.toContain("500.000");
});

it("retains an explicitly selected product and its original reply", () => {
  const payload = reply("product");
  payload.visual.selectedImageId = "image_2";
  const result = parseChatVisualReply(payload, input);
  expect(result.text).toBe(payload.replyDraft);
  expect(result.visual).toMatchObject({ selectedImageId: "image_2", needsSelection: false });
});

it.each(["product", "document", "other"])("rejects invented image identifiers for %s subjects", subject => {
  const payload = reply(subject);
  payload.visual.facts[0].imageId = "invented";
  expect(() => parseChatVisualReply(payload, input)).toThrow("Invalid visual fact source");
});

it("preserves the type and observations of document memory without seeing images again", () => {
  const previous = parseChatVisualReply(reply("document"), input).visual;
  const payload = reply("product");
  payload.visual.summary = "Không được thay đổi hồ sơ cũ";
  const result = parseChatVisualReply(payload, { ...input, images: [], previous });
  expect(result.visual).toMatchObject({ subjectType: "document", summary: previous.summary, needsSelection: false });
  expect(result.visual.facts).toEqual(previous.facts);
});
