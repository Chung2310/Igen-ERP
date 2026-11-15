import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeIntakeValue, pageIntakeFlow } from "./page-intake";
import { PageChatFlowModel, PageChatFlowStateModel } from "../../../model/page-chat-flow.model";
import { LeadIntakeProfileModel } from "../../../model/lead-intake-profile.model";
import { generateReplyCompletion } from "../../ai-reply-provider";
import { PAGE_CUSTOMER_NOTES_KEY, savePageCustomer } from "../../page-customer.service";
import { splitHistoryAndPendingInboundMessages } from "../../chat-image-context";
import { findLeadForIntake, upsertLeadFromIntake } from "../../lead-intake.service";
vi.mock("../../../model/page-chat-flow.model", () => ({ PageChatFlowModel: { findOne: vi.fn() }, PageChatFlowStateModel: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("../../../model/lead-intake-profile.model", () => ({ LeadIntakeProfileModel: { findOne: vi.fn(), exists: vi.fn() } }));
vi.mock("../../ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));
vi.mock("../../page-customer.service", () => ({ PAGE_CUSTOMER_NOTES_KEY: "__customer_notes", savePageCustomer: vi.fn() }));
vi.mock("../../lead-intake.service", () => ({ findLeadForIntake: vi.fn(), upsertLeadFromIntake: vi.fn() }));
const fields = [
  { key: "surface", label: "Bề mặt", question: "Sơn bề mặt nào ạ?" },
  { key: "area", label: "Diện tích", question: "Diện tích bao nhiêu m² ạ?" },
  { key: "paint", label: "Loại sơn", question: "Mình muốn loại sơn nào ạ?" },
  { key: "phone", label: "Số điện thoại", question: "Cho em xin số điện thoại ạ?" },
];
describe("Page intake flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(LeadIntakeProfileModel.findOne).mockReturnValue({ sort: () => ({ lean: async () => null }) } as never);
    vi.mocked(findLeadForIntake).mockResolvedValue(null);
    vi.mocked(upsertLeadFromIntake).mockResolvedValue({ _id: "LEAD" } as never);
  });
  it("validates and normalizes answers according to each configured field type", () => {
    expect(normalizeIntakeValue({ key: "email", label: "Email", question: "Email?", type: "email" }, " lead@example.com ")).toBe("lead@example.com");
    expect(normalizeIntakeValue({ key: "phone", label: "Điện thoại", question: "SĐT?", type: "phone" }, "+84 90 123 4567")).toBe("+84 90 123 4567");
    expect(normalizeIntakeValue({ key: "budget", label: "Ngân sách", question: "Bao nhiêu?", type: "currency" }, "1,500,000")).toBe("1500000");
    expect(normalizeIntakeValue({ key: "budget", label: "Ngân sách", question: "Bao nhiêu?", type: "currency" }, "1.500.000 VNĐ")).toBe("1500000");
    expect(normalizeIntakeValue({ key: "date", label: "Ngày", question: "Ngày?", type: "date" }, "2026-02-29")).toBeUndefined();
    expect(normalizeIntakeValue({ key: "date", label: "Ngày", question: "Ngày?", type: "date" }, "2024-02-29")).toBe("2024-02-29");
    expect(normalizeIntakeValue({ key: "service", label: "Dịch vụ", question: "Chọn?", type: "single_select", options: ["Khám tổng quát"] }, "khám tổng quát")).toBe("Khám tổng quát");
    expect(normalizeIntakeValue({ key: "services", label: "Dịch vụ", question: "Chọn?", type: "multi_select", options: ["Khám", "Tư vấn"] }, ["Khám", "không có trong lựa chọn"])).toBeUndefined();
    expect(normalizeIntakeValue({ key: "consent", label: "Đồng ý", question: "Đồng ý?", type: "checkbox" }, "không")).toBe("Không");
  });
  it("keeps Page state, skips supplied answers, and retries the same message without another extraction", async () => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ companyCode: "ACME", pageId: "PAGE", version: 2, goal: "Tư vấn sơn", fields, completionMessage: "Đã nhận thông tin." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ __lead_intent: true, surface: "tường", area: "20 m²" }) } as never);
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M", message: "Sơn tường 20 m²", imageUrls: [] });
    expect(reply?.text).toBe("");
    expect(reply?.leadIntake).toMatchObject({
      collected: { surface: "tường", area: "20 m²" }, status: "collecting",
      missingRequiredFields: [
        { label: "Loại sơn", type: "text", question: fields[2].question },
        { label: "Số điện thoại", type: "text", question: fields[3].question },
      ],
    });
    expect(PageChatFlowStateModel.updateOne).toHaveBeenCalledWith(
      { companyCode: "ACME", pageId: "PAGE", conversationId: "C" },
      expect.objectContaining({ $set: expect.objectContaining({ version: 2, values: { surface: "tường", area: "20 m²" }, lastMessageId: "M" }) }),
      { upsert: true }
    );
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({ version: 2, lastMessageId: "M", lastReply: fields[2].question,
      values: { surface: "tường", area: "20 m²" } }) } as never);
    const retried = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M", message: "Sơn tường 20 m²", imageUrls: [] });
    expect(retried?.text).toBe("");
    expect(retried?.leadIntake).toEqual(reply?.leadIntake);
    expect(generateReplyCompletion).toHaveBeenCalledTimes(1);
    expect(upsertLeadFromIntake).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ platform: "facebook", accountId: "PAGE", conversationId: "C", messageId: "M", allowCreate: true }));
    expect(savePageCustomer).not.toHaveBeenCalled();
  });
  it("saves a Lead for a non-Facebook channel without creating an ERP customer", async () => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ _id: "PROFILE", companyCode: "ACME", pageId: "OA", platform: "zalo", version: 4,
      goal: "Tư vấn", fields: [{ key: "name", label: "Họ tên", question: "Tên?", type: "text", required: true }], completionMessage: "Cảm ơn." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ __lead_intent: true, name: "Thủy" }) } as never);
    await pageIntakeFlow.process({ companyCode: "ACME", pageId: "OA", platform: "zalo", conversationId: "USER-1", messageId: "M1", message: "Thủy", imageUrls: [] });
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ platform: "zalo", accountId: "OA", conversationId: "USER-1", profileVersion: 4 }));
    expect(savePageCustomer).not.toHaveBeenCalled();
    expect(PageChatFlowStateModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ platform: "zalo" }), expect.anything(), { upsert: true });
  });
  it("uses the intake profile configured for the exact social account", async () => {
    const profile = { _id: "ACCOUNT-PROFILE", companyCode: "ACME", platform: "zalo", accountId: "OA-1", version: 5, goal: "Tư vấn khóa học",
      fields: [{ key: "name", label: "Họ tên", question: "Tên học viên?", type: "text", required: true }], completionMessage: "Đã nhận thông tin." };
    vi.mocked(LeadIntakeProfileModel.findOne).mockImplementation(((filter: Record<string, unknown>) => ({ sort: () => ({ lean: async () => filter?.accountId === "OA-1" ? profile : null }) })) as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ __lead_intent: true, name: "Nguyễn An" }) } as never);
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
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ _id: "PROFILE", version: 3, goal: "Tư vấn", fields: contactFields, completionMessage: "Đã đủ thông tin." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({ version: 3, completedAt: new Date(), values: { name: "An", phone: "0900000000" } }) } as never);
    vi.mocked(findLeadForIntake).mockResolvedValue({ _id: "LEAD", answers: { name: "An", phone: "0900000000" } } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ phone: "0911111111" }) } as never);
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M3", message: "Số mới là 0911111111", imageUrls: [] });
    expect(reply).toMatchObject({ text: "", leadIntake: { status: "complete", missingRequiredFields: [], collected: { name: "An", phone: "0911111111" } } });
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ values: { name: "An", phone: "0911111111" }, previousValues: { name: "An", phone: "0900000000" } }));
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
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 1, goal: "Tư vấn Ruby Queen", fields: contactFields, completionMessage: "Cảm ơn." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(generateReplyCompletion).mockImplementation(async params => {
      const payload = JSON.parse(String(params.messages[1].content));
      expect(payload.history).toEqual(history);
      expect(payload.message).toBe("1. Thủy\n2. Bên e có sản phẩm nào đang khuyến mại k");
      return { text: JSON.stringify({ __lead_intent: true, name: "Thủy" }) } as never;
    });
    const reply = await pageIntakeFlow.process({ companyCode: "RUBYQUEEN", pageId: "PAGE", conversationId: "C", messageId: "PROMO",
      message: grouped.combinedText, history, imageUrls: [] });
    expect(reply?.text).toBe("");
    expect(reply?.leadIntake).toEqual({ goal: "Tư vấn Ruby Queen", collected: { name: "Thủy" },
      status: "collecting", missingRequiredFields: [{ label: "Số điện thoại", type: "text", question: contactFields[1].question }] });
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ values: { name: "Thủy" } }));
  });
  it("continues a Zalo booking after a short name without asking for the selected package again", async () => {
    const fields = [
      { key: "package", label: "Gói khám", type: "single_select", options: ["Nam", "Nữ"], question: "Mình chọn gói nào ạ?" },
      { key: "name", label: "Họ tên", type: "text", question: "Cho em xin họ tên người đi khám nhé?" },
      { key: "phone", label: "Số điện thoại", type: "phone", question: "Cho em xin số liên hệ để lễ tân xác nhận lịch nhé?" },
      { key: "visit_date", label: "Ngày muốn khám", type: "date", question: "Mình muốn đến khám ngày nào ạ?" },
    ];
    vi.mocked(LeadIntakeProfileModel.findOne).mockReturnValue({ sort: () => ({ lean: async () => ({
      _id: "PROFILE", version: 1, goal: "Đăng ký gói khám", fields,
    }) }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({
      version: 1, profileId: "PROFILE", leadId: "LEAD", hasLeadIntent: true, values: { package: "Nam" },
    }) } as never);
    vi.mocked(findLeadForIntake).mockResolvedValue({ _id: "LEAD", answers: { package: "Nam" } } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ name: "Cường" }) } as never);

    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "OA", platform: "zalo", conversationId: "C",
      messageId: "NAME", message: "Cường", history: [{ sender: "model", text: fields[1].question }], imageUrls: [] });

    expect(reply?.leadIntake).toMatchObject({
      status: "collecting", collected: { package: "Nam", name: "Cường" },
      missingRequiredFields: [
        { label: "Số điện thoại", type: "phone", question: fields[2].question },
        { label: "Ngày muốn khám", type: "date", question: fields[3].question },
      ],
    });
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({
      allowCreate: false, values: { package: "Nam", name: "Cường" },
    }));
    expect(generateReplyCompletion).toHaveBeenCalledWith(expect.objectContaining({
      operation: "lead_intake_extraction", maxTokens: 4096,
    }));
  });
  it("can save a phone supplied in earlier customer history without using the bot's hotline as source proof", async () => {
    const contactFields = [
      { key: "name", label: "Họ tên", question: "Cho em xin tên nhé?" },
      { key: "phone", label: "Số điện thoại", question: "Cho em xin số liên hệ nhé?", type: "phone" },
    ];
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 1, goal: "Tư vấn Ruby Queen", fields: contactFields, completionMessage: "Cảm ơn." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ __lead_intent: true, name: "Thủy", phone: "0900000000" }) } as never);
    await pageIntakeFlow.process({ companyCode: "RUBYQUEEN", pageId: "PAGE", conversationId: "C", messageId: "NAME",
      message: "Thủy", imageUrls: [], history: [
        { sender: "model", text: "Hotline Ruby Queen là 0965959929. Cho em xin số điện thoại của mình nhé?" },
        { sender: "user", text: "0900000000" },
        { sender: "model", text: contactFields[0].question },
      ] });
    expect(upsertLeadFromIntake).toHaveBeenCalledWith(expect.objectContaining({ values: { name: "Thủy", phone: "0900000000" } }));
  });
  it("keeps unconfigured customer facts in the conversation and writes only to Lead", async () => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 2, goal: "Tư vấn sơn", fields, completionMessage: "Đã nhận thông tin." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => ({ version: 2, customerId: "CUSTOMER", values: new Map([
      ["surface", "tường"], [PAGE_CUSTOMER_NOTES_KEY, "Ngân sách: 50 triệu"],
    ]) }) } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ __lead_intent: true, area: "20 m²", [PAGE_CUSTOMER_NOTES_KEY]: "Ngân sách: 50 triệu\nChỉ gọi buổi chiều", injected: "ignored" }) } as never);
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "PAGE", conversationId: "C", messageId: "M2", message: "20 m², ngân sách 50 triệu, chỉ gọi buổi chiều", imageUrls: [] });
    expect(reply?.text).toBe("");
    const expectedValues = { surface: "tường", area: "20 m²", [PAGE_CUSTOMER_NOTES_KEY]: "Ngân sách: 50 triệu\nChỉ gọi buổi chiều" };
    expect(savePageCustomer).not.toHaveBeenCalled();
    expect(PageChatFlowStateModel.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      $set: expect.objectContaining({ values: expectedValues }),
    }), { upsert: false });
  });
  it.each(["facebook", "zalo"] as const)("does not create a Lead for a greeting on %s", async platform => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 1, goal: "Tư vấn", fields, completionMessage: "Cảm ơn." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: "{}" } as never);
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", platform, pageId: "PAGE", conversationId: "C", messageId: "M", message: "Chào shop", imageUrls: [] });
    expect(reply).toMatchObject({ text: "", leadIntake: { status: "inactive", missingRequiredFields: [] } });
    expect(upsertLeadFromIntake).not.toHaveBeenCalled();
  });

  it("previews contextual guidance without creating a Lead or writing intake state", async () => {
    vi.mocked(PageChatFlowModel.findOne).mockReturnValue({ lean: async () => ({ version: 1, goal: "Tư vấn", fields: [
      { key: "name", label: "Họ tên", required: true, question: "Tên?" },
      { key: "phone", label: "Số điện thoại", required: false, question: "Số?" },
    ], completionMessage: "Cảm ơn." }) } as never);
    vi.mocked(PageChatFlowStateModel.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ __lead_intent: true, name: "An" }) } as never);
    const reply = await pageIntakeFlow.process({ companyCode: "ACME", pageId: "OA", platform: "zalo", conversationId: "C",
      messageId: "PREVIEW", message: "Mình là An, muốn đăng ký", imageUrls: [], simulationMode: true });
    expect(reply?.leadIntake).toEqual({ goal: "Tư vấn", status: "just_completed", collected: { name: "An" }, missingRequiredFields: [] });
    expect(PageChatFlowStateModel.updateOne).not.toHaveBeenCalled();
    expect(upsertLeadFromIntake).not.toHaveBeenCalled();
  });
});
