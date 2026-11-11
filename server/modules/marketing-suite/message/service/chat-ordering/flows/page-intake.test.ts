import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextIntakeReply, normalizeIntakeValue, pageIntakeFlow } from "./page-intake";
import { PageChatFlowModel, PageChatFlowStateModel } from "../../../model/page-chat-flow.model";
import { LeadIntakeProfileModel } from "../../../model/lead-intake-profile.model";
import { generateReplyCompletion } from "../../ai-reply-provider";
import { PAGE_CUSTOMER_NOTES_KEY, savePageCustomer } from "../../page-customer.service";
import { splitHistoryAndPendingInboundMessages } from "../../chat-image-context";
import { upsertLeadFromIntake } from "../../lead-intake.service";
vi.mock("../../../model/page-chat-flow.model", () => ({ PageChatFlowModel: { findOne: vi.fn() }, PageChatFlowStateModel: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("../../../model/lead-intake-profile.model", () => ({ LeadIntakeProfileModel: { findOne: vi.fn(), exists: vi.fn() } }));
vi.mock("../../ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));
vi.mock("../../page-customer.service", () => ({ PAGE_CUSTOMER_NOTES_KEY: "__customer_notes", savePageCustomer: vi.fn() }));
vi.mock("../../lead-intake.service", () => ({ upsertLeadFromIntake: vi.fn().mockResolvedValue({ _id: "LEAD" }) }));
const fields = [
  { key: "surface", label: "Bề mặt", question: "Sơn bề mặt nào ạ?" },
  { key: "area", label: "Diện tích", question: "Diện tích bao nhiêu m² ạ?" },
  { key: "paint", label: "Loại sơn", question: "Mình muốn loại sơn nào ạ?" },
  { key: "phone", label: "Số điện thoại", question: "Cho em xin số điện thoại ạ?" },
];
describe("Page intake flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(LeadIntakeProfileModel.findOne).mockReturnValue({ sort: () => ({ lean: async () => null }) } as any);
  });
  it("asks only for the first missing field", () => {
    expect(nextIntakeReply(fields, { surface: "tường", area: "20 m²" }, "Đã nhận thông tin.")).toBe(fields[2].question);
    expect(nextIntakeReply(fields, { surface: "tường", area: "20 m²", paint: "nội thất", phone: "0900000000" }, "Đã nhận thông tin.")).toBe("Đã nhận thông tin.");
  });
  it("validates and normalizes answers according to each configured field type", () => {
    expect(normalizeIntakeValue({ key: "email", label: "Email", question: "Email?", type: "email" }, " lead@example.com ")).toBe("lead@example.com");
    expect(normalizeIntakeValue({ key: "phone", label: "Điện thoại", question: "SĐT?", type: "phone" }, "+84 90 123 4567")).toBe("+84 90 123 4567");
    expect(normalizeIntakeValue({ key: "budget", label: "Ngân sách", question: "Bao nhiêu?", type: "currency" }, "1,500,000")).toBe("1500000");
    expect(normalizeIntakeValue({ key: "date", label: "Ngày", question: "Ngày?", type: "date" }, "2026-02-29")).toBeUndefined();
    expect(normalizeIntakeValue({ key: "date", label: "Ngày", question: "Ngày?", type: "date" }, "2024-02-29")).toBe("2024-02-29");
    expect(normalizeIntakeValue({ key: "service", label: "Dịch vụ", question: "Chọn?", type: "single_select", options: ["Khám tổng quát"] }, "khám tổng quát")).toBe("Khám tổng quát");
    expect(normalizeIntakeValue({ key: "services", label: "Dịch vụ", question: "Chọn?", type: "multi_select", options: ["Khám", "Tư vấn"] }, ["Khám", "không có trong lựa chọn"])).toBeUndefined();
    expect(normalizeIntakeValue({ key: "consent", label: "Đồng ý", question: "Đồng ý?", type: "checkbox" }, "không")).toBe("Không");
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
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ platform: "facebook", accountId: "PAGE", conversationId: "C", collectionStatus: "collecting" }));
  });
  it("saves a Lead for a non-Facebook channel without creating an ERP customer", async () => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ _id: "PROFILE", companyCode: "ACME", pageId: "OA", platform: "zalo", version: 4,
      goal: "Tư vấn", fields: [{ key: "name", label: "Họ tên", question: "Tên?", type: "text", required: true }], completionMessage: "Cảm ơn." }) } as any);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as any);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ name: "Thủy" }) } as any);
    await pageIntakeFlow.process({ companyCode: "ACME", pageId: "OA", platform: "zalo", conversationId: "USER-1", messageId: "M1", message: "Thủy", imageUrls: [] });
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ platform: "zalo", accountId: "OA", conversationId: "USER-1", profileVersion: 4, collectionStatus: "complete" }));
    expect(savePageCustomer).not.toHaveBeenCalled();
    expect(PageChatFlowStateModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ platform: "zalo" }), expect.anything(), { upsert: true });
  });
  it("uses the intake profile configured for the exact social account", async () => {
    const profile = { _id: "ACCOUNT-PROFILE", companyCode: "ACME", platform: "zalo", accountId: "OA-1", version: 5, goal: "Tư vấn khóa học",
      fields: [{ key: "name", label: "Họ tên", question: "Tên học viên?", type: "text", required: true }], completionMessage: "Đã nhận thông tin." };
    vi.mocked(LeadIntakeProfileModel.findOne).mockImplementation((filter: any) => ({ sort: () => ({ lean: async () => filter.accountId === "OA-1" ? profile : null }) }) as any);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as any);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ name: "Nguyễn An" }) } as any);
    await pageIntakeFlow.process({ companyCode: "ACME", pageId: "OA-1", platform: "zalo", conversationId: "USER-2", messageId: "M2", message: "Nguyễn An", imageUrls: [] });
    expect(LeadIntakeProfileModel.findOne).toHaveBeenCalledTimes(1);
    expect(LeadIntakeProfileModel.findOne).toHaveBeenCalledWith({ companyCode: "ACME", platform: "zalo", accountId: "OA-1", status: "active" });
    expect(PageChatFlowModel.findOne).not.toHaveBeenCalled();
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ platform: "zalo", accountId: "OA-1", profileId: "ACCOUNT-PROFILE", profileVersion: 5 }));
    expect(PageChatFlowStateModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ pageId: "OA-1", platform: "zalo" }),
      expect.objectContaining({ $set: expect.objectContaining({ profileId: "ACCOUNT-PROFILE", version: 5 }) }), { upsert: true });
  });
  it("updates an already complete Lead with new answers without repeating the collection completion message", async () => {
    const contactFields = [
      { key: "name", label: "Họ tên", question: "Tên?", type: "text", required: true },
      { key: "phone", label: "Số điện thoại", question: "SĐT?", type: "phone", required: true },
    ];
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ _id: "PROFILE", version: 3, goal: "Tư vấn", fields: contactFields, completionMessage: "Đã đủ thông tin." }) } as any);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({ version: 3, completedAt: new Date(), values: { name: "An", phone: "0900000000" } }) } as any);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ phone: "0911111111" }) } as any);
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M3", message: "Số mới là 0911111111", imageUrls: [] });
    expect(reply).toBeUndefined();
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ values: { name: "An", phone: "0911111111" }, collectionStatus: "complete" }));
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
    expect(guidance.suggestedQuestion).toBeUndefined();
    expect(guidance.completionMessage).toBeUndefined();
    expect(guidance.missingFields).toEqual([{ key: "phone", label: "Số điện thoại" }]);
    expect(guidance.instruction).toContain("Trả lời câu hỏi mới nhất");
    expect(savePageCustomer).toHaveBeenCalledWith(expect.objectContaining({ values: { name: "Thủy" }, message: "Alo\n" + grouped.combinedText }));
  });
  it("can save a phone supplied in earlier customer history without using the bot's hotline as source proof", async () => {
    const contactFields = [
      { key: "name", label: "Họ tên", question: "Cho em xin tên nhé?" },
      { key: "phone", label: "Số điện thoại", question: "Cho em xin số liên hệ nhé?" },
    ];
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 1, goal: "Tư vấn Ruby Queen", fields: contactFields, completionMessage: "Cảm ơn." }) } as any);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as any);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ name: "Thủy", phone: "0900000000" }) } as any);
    await pageIntakeFlow.process({ companyCode: "RUBYQUEEN", pageId: "PAGE", conversationId: "C", messageId: "NAME",
      message: "Thủy", imageUrls: [], history: [
        { sender: "model", text: "Hotline Ruby Queen là 0965959929. Cho em xin số điện thoại của mình nhé?" },
        { sender: "user", text: "0900000000" },
        { sender: "model", text: contactFields[0].question },
      ] });
    expect(savePageCustomer).toHaveBeenCalledWith(expect.objectContaining({ message: "0900000000\nThủy",
      values: { name: "Thủy", phone: "0900000000" } }));
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
