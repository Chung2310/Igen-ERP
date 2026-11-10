import { afterEach, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  create: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOneAndDelete: vi.fn(),
}));
vi.mock("../model/marketing-content.model.ts", () => ({ MarketingContentModel: model }));

import { createMarketingContentDraft, deleteMarketingContentDraft, updateMarketingContentDraft } from "./marketing-content-draft.service.ts";

const objectId = "507f1f77bcf86cd799439011";
const source = (record: Record<string, unknown>) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(record) }),
});

afterEach(() => vi.clearAllMocks());

it("creates only the allowlisted fields as a standalone draft and returns a safe summary", async () => {
  const stored = {
    title: "Bài giới thiệu", channel: "Facebook", contentType: "Bài đăng", bodyText: "Nội dung",
    status: "draft", companyCode: "TEST", authorUid: "actor", imageUrl: "PRIVATE-URL",
    toObject: () => ({ title: "Bài giới thiệu", channel: "Facebook", contentType: "Bài đăng", bodyText: "Nội dung", status: "draft", generatedAt: new Date("2026-11-01T00:00:00.000Z"), imageUrl: "PRIVATE-URL", companyCode: "TEST" }),
  };
  model.create.mockResolvedValue(stored);
  const result = await createMarketingContentDraft("TEST", "actor", {
    title: " Bài giới thiệu ", channel: "Facebook", contentType: "Bài đăng", bodyText: "Nội dung",
    outline: "", mediaPrompt: "Ảnh sản phẩm",
  });

  expect(model.create).toHaveBeenCalledWith({
    title: "Bài giới thiệu", channel: "Facebook", contentType: "Bài đăng", bodyText: "Nội dung",
    outline: "", mediaPrompt: "Ảnh sản phẩm", status: "draft", companyCode: "TEST", authorUid: "actor",
  });
  expect(result).toEqual({
    title: "Bài giới thiệu", channel: "Facebook", contentType: "Bài đăng", status: "draft",
    bodyText: "Nội dung", outline: undefined, mediaPrompt: undefined, generatedAt: new Date("2026-11-01T00:00:00.000Z"),
  });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|companyCode|authorUid|imageUrl/);
});

it("rejects unsupported fields, blank required text, and overlong TikTok captions before writing", async () => {
  const valid = { title: "Tiêu đề", channel: "TikTok", contentType: "Video", bodyText: "Caption" };
  await expect(createMarketingContentDraft("TEST", "actor", { ...valid, campaignId: "internal" })).rejects.toThrow("Chỉ được sửa các trường nội dung");
  await expect(createMarketingContentDraft("TEST", "actor", { ...valid, title: "   " })).rejects.toThrow("không được để trống");
  await expect(createMarketingContentDraft("TEST", "actor", { ...valid, bodyText: "a".repeat(2201) })).rejects.toThrow("2.200 ký tự");
  expect(model.create).not.toHaveBeenCalled();
});

it("updates only an unscheduled standalone draft with atomic publication and campaign guards", async () => {
  model.findOne.mockReturnValue(source({ status: "draft", channel: "Facebook" }));
  model.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({
    title: "Tiêu đề mới", channel: "Facebook", contentType: "Bài đăng", bodyText: "Đã sửa", status: "draft", companyCode: "PRIVATE",
  }) });

  const result = await updateMarketingContentDraft("TEST", objectId, { title: " Tiêu đề mới ", bodyText: "Đã sửa" });
  const [filter, update] = model.findOneAndUpdate.mock.calls[0];
  expect(filter).toMatchObject({
    companyCode: "TEST", status: "draft", campaignId: { $in: [null, ""] }, campaignSlotId: null,
    scheduledDate: { $in: [null, ""] }, scheduledTime: { $in: [null, ""] }, publishedAt: null,
    facebookPostId: { $in: [null, ""] }, tiktokPostId: { $in: [null, ""] }, tiktokPublishId: { $in: [null, ""] },
    tiktokLastWebhookEvent: { $in: [null, ""] }, tiktokWebhookUpdatedAt: null,
  });
  expect(String(filter._id)).toBe(objectId);
  expect(update).toEqual({ $set: { title: "Tiêu đề mới", bodyText: "Đã sửa" } });
  expect(result).toMatchObject({ title: "Tiêu đề mới", status: "draft", bodyText: "Đã sửa" });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|companyCode/);
});

it("blocks updates to scheduled, linked, published, or stale drafts", async () => {
  model.findOne.mockReturnValue(source({ status: "scheduled", channel: "Facebook", scheduledDate: "2026-11-05" }));
  await expect(updateMarketingContentDraft("TEST", objectId, { bodyText: "Không sửa" })).rejects.toThrow("Chỉ có thể cập nhật bản nháp độc lập");
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();

  model.findOne.mockReturnValue(source({ status: "draft", channel: "Facebook" }));
  model.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  await expect(updateMarketingContentDraft("TEST", objectId, { bodyText: "Đã đổi trạng thái đồng thời" })).rejects.toThrow("Bản nháp đã thay đổi");
});

it("deletes only standalone unpublished drafts and reports the visible title", async () => {
  model.findOne.mockReturnValue(source({ title: "Bản nháp cũ", status: "draft" }));
  model.findOneAndDelete.mockReturnValue({ lean: vi.fn().mockResolvedValue({ title: "Bản nháp cũ", _id: objectId }) });
  await expect(deleteMarketingContentDraft("TEST", objectId)).resolves.toEqual({ deleted: true, title: "Bản nháp cũ" });
  expect(model.findOneAndDelete.mock.calls[0][0]).toMatchObject({
    companyCode: "TEST", status: "draft", campaignSlotId: null, publishedAt: null,
    facebookPostId: { $in: [null, ""] }, tiktokPostId: { $in: [null, ""] }, tiktokPublishId: { $in: [null, ""] },
    tiktokLastWebhookEvent: { $in: [null, ""] }, tiktokWebhookUpdatedAt: null,
  });
  expect(String(model.findOneAndDelete.mock.calls[0][0]._id)).toBe(objectId);

  model.findOne.mockReturnValue(source({ title: "Đã đăng", status: "draft", facebookPostId: "post-1" }));
  await expect(deleteMarketingContentDraft("TEST", objectId)).rejects.toThrow("Chỉ có thể xóa bản nháp độc lập");
  expect(model.findOneAndDelete).toHaveBeenCalledTimes(1);
});
