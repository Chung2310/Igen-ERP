import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadIntakeProfileModel } from "../model/lead-intake-profile.model";
import { TelecomInvoiceConversationModel, TelecomInvoiceModel, TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";
import { generateReplyCompletion } from "./ai-reply-provider";
import { downloadChatImage, isTrustedChatImageUrl } from "./chat-image-context";
import { isPendingTelecomConfirmation, markTelecomInvoiceReplyDelivered, processTelecomInvoiceTurn, splitTelecomInvoiceReply, type TelecomInvoiceReply } from "./telecom-invoice-flow";
import { normalizeInvoiceValue, parseInvoiceCommands } from "./telecom-invoice-values";

vi.mock("./ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));
vi.mock("./chat-image-context", async importOriginal => ({
  ...(await importOriginal<typeof import("./chat-image-context")>()), downloadChatImage: vi.fn(),
}));

const company = "TELCO";
const page = "PAGE-1";
const fields: LeadIntakeField[] = [
  { key: "ma_thue_bao", label: "Mã thuê bao", question: "Mã thuê bao?" },
  { key: "customer_name", label: "Tên khách hàng", question: "Tên khách hàng?" },
  { key: "invoice_number", label: "Mã hóa đơn", question: "Mã hóa đơn?" },
  { key: "amount_due", label: "Số tiền phải trả", question: "Số tiền phải trả?", type: "currency" },
];
const scope = { companyCode: company, pageId: page, platform: "facebook" as const, conversationId: "CHAT-1" };
const start = Date.now();
const time = (seconds: number) => new Date(start + seconds * 1000);
const imageMessage = (messageId: string, ...images: string[]) => ({
  messageId, direction: "inbound", attachments: images.map(url => ({ type: "image", url })),
});
const inbound = (messageId: string, text: string) => ({ messageId, direction: "inbound", text });
const outbound = (messageId: string, reply: TelecomInvoiceReply) => ({ messageId, direction: "outbound", text: reply.text });
const reading = (subscriberCode: string, invoiceNumber: string, amountDue = "289.000đ") => ({
  kind: "invoice", fields: {
    ma_thue_bao: { status: "readable", text: subscriberCode }, customer_name: { status: "readable", text: `Khách ${subscriberCode}` },
    invoice_number: { status: "readable", text: invoiceNumber }, amount_due: { status: "readable", text: amountDue },
  },
});
const pictures = new Map<string, unknown>();

let mongo: MongoMemoryReplSet;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([CRMTicketModel.init(), LeadIntakeProfileModel.init(), TelecomInvoiceModel.init(), TelecomInvoiceConversationModel.init(), TelecomInvoiceSettingsModel.init()]);
}, 45_000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(() => {
  vi.resetAllMocks();
  pictures.clear();
  vi.mocked(downloadChatImage).mockImplementation(async url => `data:image/png;base64,${Buffer.from(url).toString("base64")}`);
  vi.mocked(generateReplyCompletion).mockImplementation(async ({ messages }) => {
    const content = messages.at(-1)?.content;
    const part = Array.isArray(content) ? content[0] : undefined;
    if (part?.type !== "image_url") throw new Error("Expected one image input");
    const name = Buffer.from(part.image_url.url.split(",")[1], "base64").toString();
    return { text: JSON.stringify(pictures.get(name) || { kind: "other" }) } as Awaited<ReturnType<typeof generateReplyCompletion>>;
  });
});
afterEach(async () => {
  await Promise.all([CRMTicketModel.deleteMany(), LeadIntakeProfileModel.deleteMany(), TelecomInvoiceModel.deleteMany(), TelecomInvoiceConversationModel.deleteMany(), TelecomInvoiceSettingsModel.deleteMany()]);
});

async function createProfile(pageId: string, companyCode: string, platform: "facebook" | "zalo", leadFields = fields) {
  const version = 1 + await LeadIntakeProfileModel.countDocuments({ companyCode });
  await LeadIntakeProfileModel.create({ companyCode, platform, accountId: pageId, version, status: "active", fields: leadFields, goal: "Đọc hóa đơn", completionMessage: "Đã nhận" });
}

async function enable(pageId = page, companyCode = company) {
  await TelecomInvoiceSettingsModel.create({ companyCode, pageId, enabled: true });
  await createProfile(pageId, companyCode, "facebook");
}

describe("telecom invoice flow", () => {
  it("leaves the existing bot in control when disabled, on another Page, and for unrelated messages", async () => {
    await enable("PAGE-2");
    await enable(page, "OTHER");
    pictures.set("invoice", reading("001", "H01"));
    expect(await processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "photo", messages: [imageMessage("photo", "invoice")] })).toBeUndefined();
    expect(generateReplyCompletion).not.toHaveBeenCalled();
    await enable();
    expect(await processTelecomInvoiceTurn({ ...scope, messageAt: time(2), messageId: "normal", messages: [inbound("normal", "Cho em hỏi gói mạng nào rẻ?")] })).toBeUndefined();
    expect(generateReplyCompletion).not.toHaveBeenCalled();
    expect(await processTelecomInvoiceTurn({ ...scope, messageAt: time(3), messageId: "other", messages: [imageMessage("other", "product")] })).toBeUndefined();
    expect(await CRMTicketModel.countDocuments()).toBe(0);
  });

  it("saves clear images immediately by subscriber and asks for confirmation only for the incomplete image", async () => {
    await enable();
    pictures.set("a1", reading("001", "A1"));
    pictures.set("a2", reading("001", "A2", ""));
    pictures.set("b1", reading("002", "B1"));
    const photos = [imageMessage("photo1", "a1", "a2"), imageMessage("photo2", "b1")];
    const reply = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "photo2", messages: photos }))!;
    expect(reply.text).toContain("đã ghi nhận hóa đơn ảnh 1");
    expect(reply.text).toContain("đã ghi nhận hóa đơn ảnh 3");
    expect(reply.text).toMatch(/Ảnh 2 .*A2/);
    expect(reply.presentations).toHaveLength(1);
    expect(generateReplyCompletion).toHaveBeenCalledTimes(3);
    expect(await CRMTicketModel.countDocuments()).toBe(2);
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(2);

    const premature = inbound("early", "Xác nhận ảnh 2");
    expect((await processTelecomInvoiceTurn({ ...scope, messageAt: time(2), messageId: "early", messages: [...photos, premature] }))?.text).toContain("Ảnh 2");
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(2);
    expect(generateReplyCompletion).toHaveBeenCalledTimes(3);
    await markTelecomInvoiceReplyDelivered(reply, "preview", time(3));
    expect(await isPendingTelecomConfirmation(scope, "Xác nhận ảnh 2")).toBe(true);
    expect(await isPendingTelecomConfirmation(scope, "Xác nhận đặt gói mạng")).toBe(false);
    const bare = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(4), messageId: "bare", messages: [outbound("preview", reply), inbound("bare", "ok")] }))!;
    expect(bare.text).toContain("Số tiền phải trả: chưa đọc rõ");
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(2);

    const edit = inbound("edit", "Ảnh 1 đúng, ảnh 2 sửa thành 319.000đ");
    const afterEdit = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(5), messageId: "edit", messages: [outbound("preview", reply), edit] }))!;
    expect(afterEdit.text).toContain("Ảnh 2 · Mã thuê bao: 001");
    expect(afterEdit.text).toContain("319.000đ");
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(2);
    expect(await CRMTicketModel.countDocuments()).toBe(2);

    await markTelecomInvoiceReplyDelivered(afterEdit, "revised", time(6));
    const last = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(7), messageId: "confirm", messages: [outbound("revised", afterEdit), inbound("confirm", "Xác nhận ảnh 2 và 3")] }))!;
    expect(last.text).toContain("đã ghi nhận hóa đơn ảnh 2");
    expect((await processTelecomInvoiceTurn({ ...scope, messageAt: time(7), messageId: "confirm", messages: [outbound("revised", afterEdit), inbound("confirm", "Xác nhận ảnh 2")] }))?.text).toContain("đã ghi nhận hóa đơn ảnh 2");
    expect(await TelecomInvoiceModel.countDocuments({ subscriberCode: "001", status: "confirmed" })).toBe(2);
    expect(await TelecomInvoiceModel.countDocuments({ subscriberCode: "002", status: "confirmed" })).toBe(1);
    const leads = await CRMTicketModel.find().sort({ telecomSubscriberCode: 1 }).lean();
    expect(leads.map(lead => lead.telecomSubscriberCode)).toEqual(["001", "002"]);
    expect(leads.every(lead => !lead.sourceConversationId && lead.telecomConversationId === scope.conversationId)).toBe(true);
  });

  it("keeps incomplete images pending and updates an existing Lead by exact subscriber code across Pages", async () => {
    await enable();
    await enable("PAGE-2");
    const existing = await CRMTicketModel.create({ companyCode: company, customerName: "Tên đã xác minh", sourcePlatform: "facebook",
      sourceAccountId: page, sourceConversationId: scope.conversationId, answers: { ma_thue_bao: "000A" } });
    const otherCompany = await CRMTicketModel.create({ companyCode: "OTHER", customerName: "Khách công ty khác", telecomSubscriberCode: "000A" });
    pictures.set("bad", reading("", "H01"));
    const initial = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "img", messages: [imageMessage("img", "bad")] }))!;
    await markTelecomInvoiceReplyDelivered(initial, "preview", time(2));
    const incomplete = await processTelecomInvoiceTurn({ ...scope, messageAt: time(3), messageId: "yes", messages: [outbound("preview", initial), inbound("yes", "Xác nhận tất cả")] });
    expect(incomplete?.text).toContain("còn thiếu thông tin");
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(0);
    const corrected = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(4), messageId: "code", messages: [outbound("preview", initial), inbound("code", "Ảnh 1: mã thuê bao là 000a")] }))!;
    expect(corrected.text).toContain("Mã thuê bao: 000A");
    await markTelecomInvoiceReplyDelivered(corrected, "revised", time(5));
    await processTelecomInvoiceTurn({ ...scope, messageAt: time(6), messageId: "accept", messages: [outbound("revised", corrected), inbound("accept", "ok")] });

    const otherPage = { ...scope, pageId: "PAGE-2", conversationId: "CHAT-B" };
    pictures.set("dup", reading("000A", "H01"));
    const ack = await processTelecomInvoiceTurn({ ...otherPage, messageAt: time(7), messageId: "dup-photo", messages: [imageMessage("dup-photo", "dup")] });
    expect(ack?.text).toContain("hóa đơn đã được ghi nhận trước đó");
    expect(await CRMTicketModel.countDocuments()).toBe(2);
    expect(await CRMTicketModel.findById(existing._id).lean()).toMatchObject({ customerName: "Tên đã xác minh", sourceConversationId: scope.conversationId, telecomSubscriberCode: "000A" });
    expect((await CRMTicketModel.findById(otherCompany._id).lean())?.telecomConversationId).toBeUndefined();
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(1);
  });

  it("validates codes, currency and explicit confirmation without treating normal questions as commands", () => {
    expect(normalizeInvoiceValue("subscriberCode", " 000a ")).toBe("000A");
    expect(normalizeInvoiceValue("amountDue", "319,000 VND")).toBe("319000");
    expect(normalizeInvoiceValue("amountDue", "319.50")).toBeUndefined();
    expect(parseInvoiceCommands("Ảnh 1 đúng không?")).toEqual([]);
    expect(parseInvoiceCommands("Xác nhận ảnh 1, ảnh 2")).toEqual([{ type: "confirm", images: [1, 2] }]);
    expect(parseInvoiceCommands("Ảnh 1 đúng, ảnh 2 sửa thành 319,000đ")).toEqual([
      { type: "confirm", images: [1] }, { type: "edit", image: 2, field: "amountDue", value: "319000" },
    ]);
  });

  it("deduplicates simultaneous automatic saves of the same invoice from different photos", async () => {
    await enable();
    pictures.set("photo-a", reading("001", "SAME"));
    pictures.set("photo-b", reading("001", "SAME"));
    const other = { ...scope, conversationId: "CHAT-2" };
    const acknowledgements = await Promise.all([
      processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "photo-a", messages: [imageMessage("photo-a", "photo-a")] }),
      processTelecomInvoiceTurn({ ...other, messageAt: time(1), messageId: "photo-b", messages: [imageMessage("photo-b", "photo-b")] }),
    ]);
    expect(acknowledgements.map(reply => reply?.text).join("\n")).toContain("hóa đơn đã được ghi nhận trước đó");
    expect(await CRMTicketModel.countDocuments({ companyCode: company, telecomSubscriberCode: "001" })).toBe(1);
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(1);
  });

  it("uses the photo bytes to skip repeated images before OCR within a batch and in a later conversation", async () => {
    await enable();
    pictures.set("same-image", reading("0001", "H-01"));
    const first = await processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "first", messages: [imageMessage("first", "same-image", "same-image")] });
    expect(first?.text).toContain("đã bỏ qua 1 ảnh gửi trùng");
    expect(first?.text).toContain("đã ghi nhận hóa đơn ảnh 1");
    expect(first?.presentations).toEqual([]);
    expect(generateReplyCompletion).toHaveBeenCalledTimes(1);
    pictures.set("same-image", reading("0002", "H-02"));
    const again = await processTelecomInvoiceTurn({ ...scope, conversationId: "CHAT-OTHER", messageAt: time(2), messageId: "again", messages: [imageMessage("again", "same-image")] });
    expect(again?.text).toContain("đã bỏ qua 1 ảnh gửi trùng");
    expect(generateReplyCompletion).toHaveBeenCalledTimes(1);
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(1);
    expect(await CRMTicketModel.countDocuments({ telecomSubscriberCode: "0002" })).toBe(0);
  });

  it("keeps one review draft when an image with unclear content is resent", async () => {
    await enable();
    const profileFields = [...fields, { key: "vat", label: "VAT", question: "VAT?", required: false }];
    await LeadIntakeProfileModel.updateOne({ companyCode: company, platform: "facebook" }, { $set: { fields: profileFields } });
    const invoice = reading("0001", "H-01");
    pictures.set("unclear-optional", { ...invoice, fields: { ...invoice.fields, vat: { status: "unclear", text: "24.000đ" } } });
    const original = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "first", messages: [imageMessage("first", "unclear-optional")] }))!;
    await markTelecomInvoiceReplyDelivered(original, "preview", time(2));
    const resent = await processTelecomInvoiceTurn({ ...scope, messageAt: time(3), messageId: "again", messages: [outbound("preview", original), imageMessage("again", "unclear-optional")] });
    expect(resent?.text).toContain("đã bỏ qua 1 ảnh gửi trùng");
    expect(resent?.text).toContain("VAT: chưa đọc rõ");
    expect(resent?.presentations).toEqual(original.presentations);
    expect(generateReplyCompletion).toHaveBeenCalledTimes(1);
    expect(await TelecomInvoiceModel.countDocuments({ status: "pending" })).toBe(1);
    expect(await CRMTicketModel.countDocuments()).toBe(0);
  });

  it("allows the same image to be processed again after a temporary OCR failure", async () => {
    await enable();
    vi.mocked(generateReplyCompletion).mockRejectedValueOnce(new Error("temporary OCR failure"));
    pictures.set("retry", reading("001", "A1"));
    const failure = (await processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "first", messages: [imageMessage("first", "retry")] }))!;
    expect(failure.text).toContain("chưa đọc được ảnh lần này");
    const retried = await processTelecomInvoiceTurn({ ...scope, messageAt: time(2), messageId: "again", messages: [outbound("preview", failure), imageMessage("again", "retry")] });
    expect(retried?.text).toContain("đã ghi nhận hóa đơn");
    expect(await TelecomInvoiceModel.countDocuments({ status: "pending" })).toBe(0);
    expect(await TelecomInvoiceModel.countDocuments({ status: "confirmed" })).toBe(1);
  });

  it("automatically saves a Zalo OA image batch and keeps Facebook settings separate", async () => {
    const zalo = { ...scope, platform: "zalo" as const, conversationId: "ZALO-CHAT" };
    const oaImage = "https://s120-ava-talk.zadn.vn/image/hoa-don-a.jpg";
    expect(isTrustedChatImageUrl(oaImage)).toBe(true);
    pictures.set(oaImage, reading("001", "ZA1"));
    pictures.set("second", reading("001", "ZA2"));
    pictures.set("third", reading("002", "ZA3"));
    const images = [imageMessage("z-in-a", oaImage), imageMessage("z-in-b", "second", "third")]
      .map(message => ({ ...message, text: "[Hình ảnh]" }));
    await enable();
    expect(await processTelecomInvoiceTurn({ ...zalo, messageAt: time(1), messageId: "z-in-b", messages: images })).toBeUndefined();
    expect(downloadChatImage).not.toHaveBeenCalled();

    await createProfile(page, company, "zalo");
    await TelecomInvoiceSettingsModel.updateOne({ companyCode: company, pageId: page }, { $set: { enabled: false, zalo: { enabled: true } } });
    expect(await processTelecomInvoiceTurn({ ...scope, messageAt: time(1), messageId: "fb-in", messages: [imageMessage("fb-in", oaImage)] })).toBeUndefined();
    const summary = (await processTelecomInvoiceTurn({ ...zalo, messageAt: time(1), messageId: "z-in-b", messages: images }))!;
    expect(summary.text).toMatch(/hóa đơn ảnh 1[\s\S]*hóa đơn ảnh 2[\s\S]*hóa đơn ảnh 3/);
    expect(splitTelecomInvoiceReply(summary.text, "zalo")).toEqual([summary.text]);
    expect(summary.presentations).toEqual([]);
    expect(await TelecomInvoiceModel.countDocuments({ platform: "zalo", subscriberCode: "001", status: "confirmed" })).toBe(2);
    expect(await CRMTicketModel.findOne({ companyCode: company, telecomSubscriberCode: "001" }).lean()).toMatchObject({
      telecomSubscriberCode: "001", telecomPlatform: "zalo", sourcePlatform: "zalo", sourceAccountId: page,
    });
    expect(await CRMTicketModel.countDocuments({ companyCode: company, sourcePlatform: "zalo" })).toBe(2);
  });

  it("uses the active Lead columns and requires clear or corrected values when an image is blurry", async () => {
    const zalo = { ...scope, platform: "zalo" as const };
    const configured: LeadIntakeField[] = [
      { key: "line_reference", label: "Mã dịch vụ", question: "Mã dịch vụ?", required: false },
      { key: "due_on", label: "Hạn thanh toán", question: "Hạn thanh toán?", type: "date" },
      { key: "install_address", label: "Địa chỉ lắp đặt", question: "Địa chỉ?", required: false },
      { key: "vat", label: "VAT", question: "VAT?", required: false, type: "currency" },
    ];
    await createProfile(page, company, "zalo", configured);
    await TelecomInvoiceSettingsModel.create({ companyCode: company, pageId: page, zalo: { enabled: true, subscriberFieldKey: "line_reference" } });
    pictures.set("partly-blurry", { kind: "invoice", fields: {
      line_reference: { status: "readable", text: "00047" },
      due_on: { status: "unclear", text: "2026-11-03" },
      install_address: { status: "readable", text: "10 Nguyễn Huệ" },
      vat: { status: "missing" },
      invented: { status: "readable", text: "Không thuộc cấu hình Lead" },
    } });
    pictures.set("fully-blurry", { kind: "unclear", reason: "blurry", fields: { line_reference: { status: "readable", text: "999" } } });
    const preview = (await processTelecomInvoiceTurn({ ...zalo, messageId: "img", messageAt: time(1), messages: [imageMessage("img", "partly-blurry", "fully-blurry")] }))!;
    expect(preview.text).toContain("Hạn thanh toán: chưa đọc rõ");
    expect(preview.text).toContain("10 Nguyễn Huệ");
    expect(preview.text).toContain("Ảnh 2 · Ảnh bị mờ hoặc lóa");
    expect(preview.text).not.toContain("2026-11-03");
    expect(preview.text).not.toContain("999");
    await markTelecomInvoiceReplyDelivered(preview, "summary", time(2));
    await processTelecomInvoiceTurn({ ...zalo, messageId: "early", messageAt: time(3), messages: [outbound("summary", preview), inbound("early", "Xác nhận ảnh 1")] });
    expect(await CRMTicketModel.countDocuments()).toBe(0);
    await LeadIntakeProfileModel.updateOne({ companyCode: company, platform: "zalo" }, { $set: { fields } });
    const correction = (await processTelecomInvoiceTurn({ ...zalo, messageId: "edit", messageAt: time(4),
      messages: [outbound("summary", preview), inbound("edit", "Ảnh 1: Hạn thanh toán là 29/11/2026")] }))!;
    expect(correction.text).toContain("Hạn thanh toán: 29/11/2026");
    await markTelecomInvoiceReplyDelivered(correction, "corrected", time(5));
    await processTelecomInvoiceTurn({ ...zalo, messageId: "confirm", messageAt: time(6), messages: [outbound("corrected", correction), inbound("confirm", "Xác nhận ảnh 1")] });
    const stored = await TelecomInvoiceModel.findOne({ status: "confirmed" }).lean();
    expect(stored?.values).toEqual({ line_reference: "00047", due_on: "2026-11-29", install_address: "10 Nguyễn Huệ" });
    expect(stored?.leadFields?.map(field => field.label)).toEqual(configured.map(field => field.label));
    expect(await CRMTicketModel.findOne().lean()).toMatchObject({ telecomSubscriberCode: "00047", answers: { line_reference: "00047" } });
    expect(await TelecomInvoiceModel.countDocuments({ imageIssue: "blurry", status: "pending" })).toBe(1);
  });

  it("keeps existing invoice drafts confirmable and waits for a Lead profile before reading new images", async () => {
    await TelecomInvoiceSettingsModel.create({ companyCode: company, pageId: page, enabled: true });
    const previous = await TelecomInvoiceModel.create({ ...scope, sourceMessageId: "previous", sourceIndex: 0, imageNumber: 1,
      fields: ["subscriberCode", "invoiceNumber"], values: { subscriberCode: "0001", invoiceNumber: "INV-1" },
      status: "pending", revision: 1, presentedRevision: 1, presentedAt: time(1), presentedMessageId: "summary", expiresAt: time(3600),
    });
    await processTelecomInvoiceTurn({ ...scope, messageId: "confirm", messageAt: time(2), messages: [inbound("confirm", "Xác nhận ảnh 1")] });
    expect(await TelecomInvoiceModel.findById(previous._id).lean()).toMatchObject({ status: "confirmed", subscriberCode: "0001", invoiceKey: "INV-1" });
    const next = await processTelecomInvoiceTurn({ ...scope, messageId: "next", messageAt: time(3), messages: [imageMessage("next", "another-image")] });
    expect(next?.text).toContain("chưa thể đọc hóa đơn tự động");
    expect(generateReplyCompletion).not.toHaveBeenCalled();
  });
});
