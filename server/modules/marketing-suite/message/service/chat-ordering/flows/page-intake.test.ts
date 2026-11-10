import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextIntakeReply, pageIntakeFlow } from "./page-intake";
import { PageChatFlowModel, PageChatFlowStateModel } from "../../../model/page-chat-flow.model";
import { generateReplyCompletion } from "../../ai-reply-provider";
import { PAGE_CUSTOMER_NOTES_KEY, savePageCustomer } from "../../page-customer.service";
import { splitHistoryAndPendingInboundMessages } from "../../chat-image-context";
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
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({ version: 2, lastMessageId: "M", lastReply: fields[2].question,
      values: { surface: "tường", area: "20 m²" } }) } as any);
    const retried = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M", message: "Sơn tường 20 m²", imageUrls: [] });
    expect(retried?.text).toBe(fields[2].question);
    expect(retried?.consultationContext).toBe(reply?.consultationContext);
    expect(generateReplyCompletion).toHaveBeenCalledTimes(1);
  });
  it("preserves a short name and the promotion question grouped after the bot asks for a name", async () => {
    const contactFields = [
      { key: "name", label: "Họ tên", question: "Anh/chị cho em xin tên để Ruby Queen tiện tư vấn cho mình nhé?" },
      { key: "phone", label: "Số điện thoại", question: "Cho em xin số điện thoại liên hệ nhé?" },
    ];
    const grouped = splitHistoryAndPendingInboundMessages([
      { direction: "inbound", text: "Alo" },
      { direction: "outbound", text: contactFields[0].question },
      { direction: "inbound", text: "Thủy" },
      { direction: "inbound", text: "Bên e có sản phẩm nào đang khuyến mại k" },
    ]);
    const history = grouped.historyMessages.map(turn => ({ sender: turn.direction === "inbound" ? "user" : "model", text: turn.text }));
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 1, goal: "Tư vấn Ruby Queen", fields: contactFields, completionMessage: "Cảm ơn." }) } as any);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as any);
    vi.mocked(generateReplyCompletion).mockImplementation(async params => {
      const payload = JSON.parse(String(params.messages[1].content));
      expect(payload.history).toEqual(history);
      expect(payload.message).toBe("1. Thủy\n2. Bên e có sản phẩm nào đang khuyến mại k");
      return { text: JSON.stringify({ name: "Thủy" }) } as any;
    });
    const reply = await pageIntakeFlow.process({ companyCode: "RUBYQUEEN", pageId: "PAGE", conversationId: "C", messageId: "PROMO",
      message: grouped.combinedText, history, imageUrls: [] });
    const guidance = JSON.parse(reply!.consultationContext!);
    expect(guidance.collected).toEqual({ name: "Thủy" });
    expect(guidance.missingFields.map((field: { key: string }) => field.key)).toEqual(["phone"]);
    expect(guidance.requiredReply).toBeUndefined();
    expect(guidance.instruction).toContain("Trả lời câu hỏi mới nhất");
    expect(savePageCustomer).toHaveBeenCalledWith(expect.objectContaining({ values: { name: "Thủy" }, message: grouped.combinedText }));
  });
  it("does not extract or save sales information from a self-harm message", async () => {
    const result = await pageIntakeFlow.process({ companyCode: "RUBYQUEEN", pageId: "PAGE", conversationId: "C", messageId: "CRISIS",
      message: "Tôi muốn tự vẫn", imageUrls: [] });
    expect(result).toBeUndefined();
    expect(PageChatFlowModel.findOne).not.toHaveBeenCalled();
    expect(generateReplyCompletion).not.toHaveBeenCalled();
    expect(savePageCustomer).not.toHaveBeenCalled();
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
