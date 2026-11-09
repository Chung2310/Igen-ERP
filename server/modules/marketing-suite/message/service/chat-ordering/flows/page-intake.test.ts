import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextIntakeReply, pageIntakeFlow } from "./page-intake";
import { PageChatFlowModel, PageChatFlowStateModel } from "../../../model/page-chat-flow.model";
import { generateReplyCompletion } from "../../ai-reply-provider";
import { PAGE_CUSTOMER_NOTES_KEY, savePageCustomer } from "../../page-customer.service";
vi.mock("../../../model/page-chat-flow.model", () => ({ PageChatFlowModel: { findOne: vi.fn() }, PageChatFlowStateModel: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("../../ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));
vi.mock("../../page-customer.service", () => ({ PAGE_CUSTOMER_NOTES_KEY: "__customer_notes", savePageCustomer: vi.fn() }));
const fields = [
  { key: "surface", label: "Bề mặt", question: "Sơn bề mặt nào ạ?" },
  { key: "area", label: "Diện tích", question: "Diện tích bao nhiêu m² ạ?" },
  { key: "paint", label: "Loại sơn", question: "Mình muốn loại sơn nào ạ?" },
  { key: "phone", label: "Số điện thoại", question: "Cho em xin số điện thoại ạ?" },
];
describe("Page intake flow", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("asks only for the first missing field", () => {
    expect(nextIntakeReply(fields, { surface: "tường", area: "20 m²" }, "Đã nhận thông tin.")).toBe(fields[2].question);
    expect(nextIntakeReply(fields, { surface: "tường", area: "20 m²", paint: "nội thất", phone: "0900000000" }, "Đã nhận thông tin.")).toBe("Đã nhận thông tin.");
  });
  it("keeps Page state, skips supplied answers, and retries the same message without another extraction", async () => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ companyCode: "ACME", pageId: "PAGE", version: 2, goal: "Tư vấn sơn", fields, completionMessage: "Đã nhận thông tin." }) } as any);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as any);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ surface: "tường", area: "20 m²" }) } as any);
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M", message: "Sơn tường 20 m²", imageUrls: [] });
    expect(reply?.text).toBe(fields[2].question);
    expect(PageChatFlowStateModel.updateOne).toHaveBeenCalledWith(
      { companyCode: "ACME", pageId: "PAGE", conversationId: "C" },
      expect.objectContaining({ $set: expect.objectContaining({ version: 2, values: { surface: "tường", area: "20 m²" }, lastMessageId: "M" }) }),
      { upsert: true }
    );
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({ version: 2, lastMessageId: "M", lastReply: fields[2].question }) } as any);
    expect((await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M", message: "Sơn tường 20 m²", imageUrls: [] }))?.text).toBe(fields[2].question);
    expect(generateReplyCompletion).toHaveBeenCalledTimes(1);
  });
  it("keeps unconfigured customer facts and syncs later replies to the linked customer", async () => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 2, goal: "Tư vấn sơn", fields, completionMessage: "Đã nhận thông tin." }) } as any);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({ version: 2, customerId: "CUSTOMER", values: new Map([
      ["surface", "tường"], [PAGE_CUSTOMER_NOTES_KEY, "Ngân sách: 50 triệu"],
    ]) }) } as any);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ area: "20 m²", [PAGE_CUSTOMER_NOTES_KEY]: "Ngân sách: 50 triệu\nChỉ gọi buổi chiều", injected: "ignored" }) } as any);
    vi.mocked(savePageCustomer).mockResolvedValue("CUSTOMER");
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M2", message: "20 m², ngân sách 50 triệu, chỉ gọi buổi chiều", imageUrls: [] });
    expect(reply?.text).toBe(fields[2].question);
    const expectedValues = { surface: "tường", area: "20 m²", [PAGE_CUSTOMER_NOTES_KEY]: "Ngân sách: 50 triệu\nChỉ gọi buổi chiều" };
    expect(savePageCustomer).toHaveBeenCalledWith(expect.objectContaining({ customerId: "CUSTOMER", values: expectedValues }));
    expect(PageChatFlowStateModel.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      $set: expect.objectContaining({ customerId: "CUSTOMER", values: expectedValues }),
    }), { upsert: true });
  });
});
