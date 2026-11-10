import { beforeEach, expect, it, vi } from "vitest";
import { prepareChatPreview } from "./chat-preview.service";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";

vi.mock("../model/fb-messenger.model", () => ({ FBConversationModel: { findById: vi.fn() }, FBMessageModel: { find: vi.fn() } }));
vi.mock("../model/zalo-messenger.model", () => ({ ZaloConversationModel: {}, ZaloMessageModel: {} }));
vi.mock("../model/tiktok-messenger.model", () => ({ TikTokConversationModel: {}, TikTokMessageModel: {} }));
vi.mock("../../../../model/user.model.ts", () => ({ UserModel: {} }));

const input = { userId: "user", companyCode: "SHOP", channel: "facebook" as const, conversationId: "CONV" };
const owner = async () => ({ companyCode: "SHOP", aiConfig: {} });
function messages(rows: Array<{ direction: string; text: string; consultationSessionId?: string }>) {
  vi.mocked(FBMessageModel.find).mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => rows.map(row => ({ ...row })) }) }) } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(FBConversationModel.findById).mockReturnValue({ select: () => ({ lean: async () => ({ pageId: "PAGE" }) }) } as never);
});

it("removes the previewed latest question while preserving a short name sent immediately before it", async () => {
  messages([{ direction: "inbound", text: "Bên em có ưu đãi gì?" }, { direction: "inbound", text: "Thủy" },
    { direction: "outbound", text: "Cho em xin tên nhé?" }]);
  const result = await prepareChatPreview({ ...input, message: "Bên em có ưu đãi gì?" }, owner);
  expect(result.history.map(item => item.text)).toEqual(["Cho em xin tên nhé?", "Thủy"]);
  expect(result.sourceMessages).toHaveLength(3);
});

it("removes the whole pending group only when that group is explicitly being previewed", async () => {
  messages([{ direction: "inbound", text: "Ưu đãi gì?" }, { direction: "inbound", text: "Thủy" },
    { direction: "outbound", text: "Cho em xin tên nhé?" }]);
  const grouped = await prepareChatPreview({ ...input, message: "1. Thủy\n2. Ưu đãi gì?" }, owner);
  expect(grouped.history.map(item => item.text)).toEqual(["Cho em xin tên nhé?"]);
  const next = await prepareChatPreview({ ...input, message: "Địa chỉ ở đâu?" }, owner);
  expect(next.history.map(item => item.text)).toEqual(["Cho em xin tên nhé?", "Thủy", "Ưu đãi gì?"]);
});

it("honors explicit text consultation sessions without filtering generic untagged intake messages", async () => {
  messages([{ direction: "inbound", text: "Nano giá bao nhiêu?", consultationSessionId: "current" },
    { direction: "inbound", text: "Thủy", consultationSessionId: "current" },
    { direction: "inbound", text: "Đơn cũ", consultationSessionId: "old" }]);
  const result = await prepareChatPreview({ ...input, message: "Nano giá bao nhiêu?" }, owner);
  expect(result.sessionId).toBe("current");
  expect(result.history.map(item => item.text)).toEqual(["Thủy"]);
  messages([{ direction: "inbound", text: "Nano giá bao nhiêu?" }, { direction: "inbound", text: "Thủy" },
    { direction: "outbound", text: "Cho em xin tên?", consultationSessionId: "page-intake" }]);
  const untagged = await prepareChatPreview({ ...input, message: "Nano giá bao nhiêu?" }, owner);
  expect(untagged.sessionId).toBeUndefined();
  expect(untagged.history.map(item => item.text)).toContain("Thủy");
});

it("uses the same new-order boundary as live replies", async () => {
  messages([{ direction: "inbound", text: "Thủy" }, { direction: "inbound", text: "Mình muốn mua trần Nano" },
    { direction: "outbound", text: "Đơn cũ đã hoàn tất" }]);
  const result = await prepareChatPreview({ ...input, message: "Giá bao nhiêu?" }, owner);
  expect(result.history.map(item => item.text)).toEqual(["Mình muốn mua trần Nano", "Thủy"]);
});

it("authorizes the selected conversation before reading any customer messages", async () => {
  await expect(prepareChatPreview(input, async () => ({ companyCode: "OTHER", aiConfig: {} })))
    .rejects.toMatchObject({ status: 403 });
  expect(FBMessageModel.find).not.toHaveBeenCalled();
});
