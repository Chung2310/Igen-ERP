import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatTestSessionModel, ChatTestMessageModel } from "../model/chat-test.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadContractModel, LeadContractPhotoModel } from "../model/lead-contract.model";
import { LeadIntakeProfileModel } from "../model/lead-intake-profile.model";
import { TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";
import { MessengerBackgroundJobModel } from "../model/messenger-background-job.model";
import { PageChatFlowStateModel } from "../model/page-chat-flow.model";
import { ChatVisualMemoryModel } from "../model/chat-visual-memory.model";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { prepareChatPreview } from "./chat-preview.service";
import { prepareChatReplyContext } from "./chat-reply-context.service";
import { generateReplyCompletion } from "./ai-reply-provider";
import { geminiService } from "../../shared/service/gemini.service";
import { prepareChatImages, parseChatVisualReply } from "./chat-visual-context";
import {
  addChatTestMessage, createChatTestSession, deleteChatTestSession, failChatTestMessage,
  processChatTestMessage, readChatTestSession, readChatTestState, retryChatTestMessage,
  saveChatTestConfig, previewChatTestReply,
  changeChatTestDomain,
} from "./chat-test.service";

vi.mock("./ai-auto-reply.service", () => ({ resolveAutoReplyOwner: vi.fn() }));
vi.mock("./chat-preview.service", () => ({ prepareChatPreview: vi.fn() }));
vi.mock("./chat-reply-context.service", () => ({
  prepareChatReplyContext: vi.fn(), commitChatVisualContext: vi.fn(),
  buildChatConversationInstructions: (value: string) => value,
}));
vi.mock("../../shared/service/gemini.service", () => ({ geminiService: { chat: vi.fn() } }));
vi.mock("./ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));
vi.mock("../../shared/socket", () => ({ broadcastEvent: vi.fn() }));

const companyCode = "TEST_BUSINESS";
const userId = new mongoose.Types.ObjectId().toString();
const fields = [
  { key: "name", label: "Họ tên", question: "Tên?", type: "text", required: true },
  { key: "phone", label: "Số điện thoại", question: "Số liên hệ?", type: "phone", required: true },
  { key: "contract", label: "Mã hợp đồng", question: "Mã hợp đồng?", type: "text", required: false },
];
let mongo: MongoMemoryReplSet;
const models = [ChatTestSessionModel, ChatTestMessageModel, CRMTicketModel, LeadContractModel, LeadContractPhotoModel,
  LeadIntakeProfileModel, TelecomInvoiceSettingsModel, MessengerBackgroundJobModel, PageChatFlowStateModel, ChatVisualMemoryModel, UserModel, SocialIntegrationModel];

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all(models.map(model => model.init()));
}, 60_000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
afterEach(async () => { for (const model of models) await model.collection.deleteMany({}); });
beforeEach(async () => {
  vi.resetAllMocks();
  await UserModel.collection.insertOne({
    _id: new mongoose.Types.ObjectId(userId), companyCode,
    aiAutoReplyConfig: { enabled: true, advancedInstructions: "Tư vấn tự nhiên", trainingKnowledge: "Tri thức đã lưu" },
  });
  vi.mocked(prepareChatPreview).mockImplementation(async () => ({
    aiConfig: { ...(await UserModel.findById(userId).lean())!.aiAutoReplyConfig },
    history: [], sourceMessages: [], channel: "facebook", sessionId: undefined, platformId: undefined, pageId: undefined,
  }));
  vi.mocked(prepareChatReplyContext).mockResolvedValue({
    ragContext: { contextText: "Giá gói từ kho tri thức", matches: 1 },
    memoryImages: [], sourceMessageId: "source", sourceTimestamp: new Date(), resetMemory: false,
  });
  vi.mocked(geminiService.chat).mockResolvedValue({ text: "Anh An cho em xin số liên hệ nhé.", isMock: false });
  vi.mocked(generateReplyCompletion).mockImplementation(async input => {
    const text = input.operation === "lead_contract_ocr"
      ? { kind: "document", fields: {
        name: { status: "readable", text: "Nguyễn An" }, phone: { status: "readable", text: "0901234567" },
        contract: { status: "readable", text: "HD001" },
      } }
      : JSON.parse(String(input.messages.at(-1)?.content)).message.includes("0901234567")
        ? { __lead_intent: true, phone: "0901234567" }
        : { __lead_intent: true, name: "An" };
    return { text: JSON.stringify(text) } as Awaited<ReturnType<typeof generateReplyCompletion>>;
  });
  await LeadIntakeProfileModel.create({
    companyCode, version: 1, status: "active", fields, goal: "Tư vấn", completionMessage: "Cảm ơn",
  });
});

function start(ocrEnabled = false, documentDomain: "general" | "telecom" = "general") {
  return createChatTestSession(companyCode, userId, {
    channel: "facebook", ocrEnabled, documentDomain, ...(ocrEnabled ? { contractFieldKey: "contract", provider: "FPT" } : {}),
  });
}
function send(sessionId: string, text: string, clientMessageId = mongoose.Types.ObjectId.createFromTime(Date.now() / 1000).toString(), imageData?: string) {
  return addChatTestMessage({ companyCode, userId, sessionId, clientMessageId, text, imageData });
}

describe("Persistent chatbot test sessions", () => {
  it("changes only the owned conversation mode and refuses changes while a turn is pending", async () => {
    const session = await start();
    const changed = await changeChatTestDomain(companyCode, userId, session.id, "telecom");
    expect(changed).toMatchObject({ id: session.id, documentDomain: "telecom", leadSetup: { ready: false } });
    expect(await ChatTestSessionModel.countDocuments()).toBe(1);
    expect(await ChatTestMessageModel.countDocuments()).toBe(0);
    await expect(changeChatTestDomain("OTHER", userId, session.id, "general")).rejects.toMatchObject({ status: 404 });
    await expect(changeChatTestDomain(companyCode, "other-user", session.id, "general")).rejects.toMatchObject({ status: 404 });
    await expect(changeChatTestDomain(companyCode, userId, session.id, "invalid")).rejects.toMatchObject({ status: 400 });
    await send(session.id, "Xin tư vấn", "pending-mode-message");
    await expect(changeChatTestDomain(companyCode, userId, session.id, "general")).rejects.toMatchObject({ status: 409 });
    expect((await readChatTestSession(companyCode, userId, session.id)).documentDomain).toBe("telecom");
  });

  it("blocks photo-only descriptions when all Lead profiles are archived, then saves after the existing Lead columns are applied", async () => {
    await LeadIntakeProfileModel.updateMany({ companyCode }, { $set: { status: "archived" } });
    const session = await start();
    const changed = await changeChatTestDomain(companyCode, userId, session.id, "telecom");
    expect(changed.leadSetup).toMatchObject({ ready: false, message: expect.stringContaining("đang áp dụng") });
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: "white" } }).png().toBuffer();
    const imageData = `data:image/png;base64,${bytes.toString("base64")}`;
    const input = { companyCode, userId, sessionId: session.id, clientMessageId: "apply-columns-photo", text: "", imageData };
    await expect(addChatTestMessage(input)).rejects.toMatchObject({ code: "CHAT_TEST_LEAD_SETUP_REQUIRED", status: 400 });
    expect(await ChatTestMessageModel.countDocuments()).toBe(0);
    expect(await MessengerBackgroundJobModel.countDocuments()).toBe(0);
    expect(await CRMTicketModel.countDocuments()).toBe(0);
    expect(geminiService.chat).not.toHaveBeenCalled();
    await LeadIntakeProfileModel.create({ companyCode, status: "active", version: 2, goal: "Đọc ảnh nhà mạng", completionMessage: "Đã nhận",
      fields: [...fields.slice(0, 2), { key: "account", label: "Mã thuê bao", question: "Account?", type: "text", required: true }],
    });
    vi.mocked(generateReplyCompletion).mockImplementation(async () => ({ text: JSON.stringify({ kind: "document", fields: {
      account: { status: "readable", text: "subscriber_001" }, name: { status: "readable", text: "Nguyễn An" }, phone: { status: "readable", text: "0901234567" },
    } }) }) as never);
    const messageId = await addChatTestMessage(input);
    await processChatTestMessage({ sessionId: session.id, messageId });
    const state = await readChatTestState(companyCode, userId, session.id);
    expect(state.session).toMatchObject({ id: session.id, documentDomain: "telecom", leadSetup: { ready: true } });
    expect(state.messages[0].status).toBe("completed");
    expect(state.leads).toHaveLength(1);
    expect(await CRMTicketModel.findById(state.leads[0].id).lean()).toMatchObject({
      companyCode, telecomSubscriberCode: "SUBSCRIBER_001", telecomConversationId: session.id, phone: "0901234567", customerName: "Nguyễn An",
    });
    expect(await LeadIntakeProfileModel.countDocuments({ companyCode, version: 1, status: "archived" })).toBe(1);
  });

  it("requires a subscriber column only for telecom photo intake", async () => {
    const session = await start(false, "telecom");
    const state = await readChatTestState(companyCode, userId, session.id);
    expect(state.session.leadSetup).toMatchObject({ ready: false, message: expect.stringContaining("Account") });
    await expect(send(session.id, "", "no-account-column", "data:image/png;base64,AA==")).rejects.toMatchObject({ code: "CHAT_TEST_LEAD_SETUP_REQUIRED" });
    await changeChatTestDomain(companyCode, userId, session.id, "general");
    expect((await readChatTestState(companyCode, userId, session.id)).session.leadSetup).toEqual({ ready: true });
    await expect(send(session.id, "", "general-no-account", "data:image/png;base64,AA==")).resolves.toEqual(expect.any(String));
  });

  it("does not fall back to generic image chat if the Lead profile is archived after the upload was queued", async () => {
    await LeadIntakeProfileModel.updateOne({ companyCode }, { $push: { fields: {
      key: "account", label: "Account", question: "Mã?", type: "text", required: true,
    } } });
    const session = await start(false, "telecom");
    const messageId = await send(session.id, "", "profile-archived-after-send", "data:image/png;base64,AA==");
    await LeadIntakeProfileModel.updateMany({ companyCode }, { $set: { status: "archived" } });
    let failure: unknown;
    try { await processChatTestMessage({ sessionId: session.id, messageId }); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: "CHAT_TEST_LEAD_SETUP_REQUIRED" });
    await failChatTestMessage({ sessionId: session.id, messageId }, failure);
    const state = await readChatTestState(companyCode, userId, session.id);
    expect(state.messages[0]).toMatchObject({ status: "failed", phase: "lead", errorCode: "CHAT_TEST_LEAD_SETUP_REQUIRED",
      error: expect.stringContaining("Thiết lập Lead") });
    expect(geminiService.chat).not.toHaveBeenCalled();
    expect(generateReplyCompletion).not.toHaveBeenCalled();
    expect(await CRMTicketModel.countDocuments()).toBe(0);
  });

  it("answers two documents with no Lead profile through the real visual parser without a sample-selection crash", async () => {
    await LeadIntakeProfileModel.deleteMany({ companyCode });
    await UserModel.updateOne({ _id: userId }, { $set: { "aiAutoReplyConfig.imageReplyEnabled": true } });
    const imageFiles = await Promise.all(["red", "blue"].map(async color => ({
      data: `data:image/png;base64,${(await sharp({ create: { width: 3, height: 3, channels: 3, background: color } }).png().toBuffer()).toString("base64")}`,
    })));
    const session = await start();
    const messageId = await addChatTestMessage({ companyCode, userId, sessionId: session.id, clientMessageId: "documents-without-profile", text: "", imageFiles });
    const loaded = await prepareChatImages(imageFiles.map(image => ({ dataUrl: image.data, messageId })));
    const visualInput = { images: loaded.images, messageId, sourceMessageIds: [messageId], customerMessage: "[Ảnh]" };
    vi.mocked(prepareChatReplyContext).mockResolvedValue({
      ragContext: { visualInput }, visualInput, memoryImages: [], sourceMessageId: messageId, sourceTimestamp: new Date(), resetMemory: false,
    });
    vi.mocked(geminiService.chat).mockImplementation(async (_message, _history, _config, context) => ({
      ...parseChatVisualReply({ replyDraft: "Bạn muốn kiểm tra thông tin nào trên hai ảnh này?", visual: {
        subjectType: "document", readable: true, needsSelection: false, selectedImageId: "", summary: "Hai ảnh tài liệu",
        facts: loaded.images.map(image => ({ key: "document", value: "Thông tin hồ sơ", confidence: "high", imageId: image.id })),
        customerRequests: [], uncertainties: [],
      } }, context!.visualInput!), isMock: false,
    }));
    await processChatTestMessage({ sessionId: session.id, messageId });
    const state = await readChatTestState(companyCode, userId, session.id);
    expect(state.messages[0]).toMatchObject({ status: "completed", imageCount: 2 });
    expect(state.messages[0].ocr).toBeUndefined();
    expect(state.leads).toHaveLength(0);
    expect(geminiService.chat).toHaveBeenCalledTimes(1);
  });

  it("stores safe failure diagnostics and clears them when retrying without exposing provider text", async () => {
    const session = await start();
    const messageId = await send(session.id, "Xin tư vấn", "diagnostic-message");
    await failChatTestMessage({ sessionId: session.id, messageId }, Object.assign(new Error("Invalid visual fact source"), { status: 502 }));
    const state = await readChatTestState(companyCode, userId, session.id);
    expect(state.messages[0]).toMatchObject({ errorCode: "AI_VISUAL_REPLY_INVALID", error: expect.stringContaining("phân tích ảnh") });
    await retryChatTestMessage(companyCode, userId, session.id, messageId);
    expect((await readChatTestState(companyCode, userId, session.id)).messages[0].errorCode).toBeUndefined();
    await failChatTestMessage({ sessionId: session.id, messageId }, new Error("private provider response sk-or-example"));
    const failed = (await readChatTestState(companyCode, userId, session.id)).messages[0];
    expect(failed.errorCode).toBe("CHAT_TEST_PROCESSING_FAILED");
    expect(failed.error).not.toContain("private provider");
  });
  it("reads three images as one turn, merges the same subscriber, separates others and reuses OCR on retry", async () => {
    await LeadIntakeProfileModel.updateOne({ companyCode }, { $set: { fields: [...fields.slice(0, 2),
      { key: "account", label: "Account", question: "Mã?", type: "text", required: true },
      { key: "address", label: "Địa chỉ", question: "Địa chỉ?", type: "text", required: false },
    ] } });
    const imageFiles = await Promise.all(["red", "green", "blue"].map(async (color, index) => ({
      data: `data:image/png;base64,${(await sharp({ create: { width: 3, height: 3, channels: 3, background: color } }).png().toBuffer()).toString("base64")}`,
      fileName: `image-${index}.png`,
    })));
    const rows = [
      { account: "subscriber_a", name: "Nguyễn An", phone: "0901234567" },
      { account: "SUBSCRIBER_A", address: "Địa chỉ của An" },
      { account: "subscriber_b", name: "Trần Bình", phone: "0907654321" },
    ];
    vi.mocked(generateReplyCompletion).mockImplementation(async input => ({ text: JSON.stringify(input.operation === "lead_document_ocr"
      ? { kind: "document", fields: Object.fromEntries(Object.entries(rows.shift()!).map(([key, text]) => [key, { status: "readable", text }])) }
      : { __lead_intent: false }) }) as never);
    const session = await start(false, "telecom");
    const messageId = await addChatTestMessage({ companyCode, userId, sessionId: session.id, text: "", clientMessageId: "three-photos-one-turn", imageFiles });
    vi.mocked(geminiService.chat).mockRejectedValueOnce(new Error("Temporary reply failure"));
    await expect(processChatTestMessage({ sessionId: session.id, messageId })).rejects.toThrow("Temporary reply failure");
    await failChatTestMessage({ sessionId: session.id, messageId });
    await retryChatTestMessage(companyCode, userId, session.id, messageId);
    await processChatTestMessage({ sessionId: session.id, messageId });
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({ imageCount: 3, hasImage: true, status: "completed" });
    expect(result.messages[0]).not.toHaveProperty("imageFiles");
    expect(result.leads).toHaveLength(2);
    expect(await CRMTicketModel.findOne({ companyCode, telecomSubscriberCode: "SUBSCRIBER_A" }).lean()).toMatchObject({
      customerName: "Nguyễn An", phone: "0901234567", answers: { address: "Địa chỉ của An" },
    });
    expect(await CRMTicketModel.findOne({ companyCode, telecomSubscriberCode: "SUBSCRIBER_B" }).lean()).toMatchObject({
      customerName: "Trần Bình", phone: "0907654321",
    });
    expect(vi.mocked(generateReplyCompletion).mock.calls.filter(([input]) => input.operation === "lead_document_ocr")).toHaveLength(3);
    expect((await ChatTestMessageModel.findById(messageId).lean())?.imageFiles).toBeUndefined();
    expect((await ChatTestMessageModel.findById(messageId).select("+imageFiles").lean())?.imageFiles).toHaveLength(3);
  });

  it("does not assign a third unidentified image to either subscriber in a multi-image turn", async () => {
    await LeadIntakeProfileModel.updateOne({ companyCode }, { $set: { fields: [...fields.slice(0, 2),
      { key: "account", label: "Account", question: "Mã?", type: "text", required: true },
      { key: "terminal", label: "Mã kết cuối", question: "Mã?", type: "text", required: false },
    ] } });
    const imageFiles = await Promise.all(["red", "green", "blue"].map(async color => ({
      data: `data:image/png;base64,${(await sharp({ create: { width: 3, height: 3, channels: 3, background: color } }).png().toBuffer()).toString("base64")}`,
    })));
    const rows = [{ account: "subscriber_a", name: "An" }, { account: "subscriber_b", name: "Bình" }, { terminal: "TRAM-01" }];
    vi.mocked(generateReplyCompletion).mockImplementation(async () => ({ text: JSON.stringify({ kind: "document",
      fields: Object.fromEntries(Object.entries(rows.shift()!).map(([key, text]) => [key, { status: "readable", text }])),
    }) }) as never);
    const session = await start(false, "telecom");
    const messageId = await addChatTestMessage({ companyCode, userId, sessionId: session.id, text: "", clientMessageId: "different-customers-images", imageFiles });
    await processChatTestMessage({ sessionId: session.id, messageId });
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.leads).toHaveLength(2);
    expect(result.leads.every(lead => !lead.answers?.terminal)).toBe(true);
    expect(result.messages[0].ocr?.issue).toContain("ảnh 3");
    expect((await ChatTestMessageModel.findById(messageId).lean())?.leadSubscriberCode).toBeUndefined();
  });

  it("chats across turns and writes the normal company Lead table", async () => {
    const session = await start();
    expect(prepareChatPreview).toHaveBeenCalledWith(expect.objectContaining({ userId, companyCode, platformId: undefined }), expect.any(Function));
    const firstId = await send(session.id, "Tôi muốn tư vấn, tôi tên An", "first-message-1");
    expect(await MessengerBackgroundJobModel.countDocuments({ kind: "chat-test", status: "pending" })).toBe(1);
    await processChatTestMessage({ sessionId: session.id, messageId: firstId });
    await processChatTestMessage({ sessionId: session.id, messageId: firstId });
    expect(geminiService.chat).toHaveBeenCalledTimes(1);
    const initial = await readChatTestState(companyCode, userId, session.id);
    expect(initial.leads).toHaveLength(1);
    expect(initial.leads[0]).toMatchObject({ customerName: "An", answers: { name: "An" }, collectionStatus: "collecting" });
    expect(initial.messages[0]).toMatchObject({ status: "completed", reply: "Anh An cho em xin số liên hệ nhé." });
    expect(await CRMTicketModel.countDocuments({ companyCode })).toBe(1);
    expect(await CRMTicketModel.findById(initial.leads[0].id).lean()).toMatchObject({
      companyCode, sourceAccountId: `chat-test:${session.id}`, sourceConversationId: session.id,
    });

    const secondId = await send(session.id, "0901234567", "second-message-2");
    await processChatTestMessage({ sessionId: session.id, messageId: secondId });
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.session.pending).toBe(false);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({ id: initial.leads[0].id, phone: "0901234567", collectionStatus: "complete" });
    expect(prepareChatReplyContext).toHaveBeenLastCalledWith(expect.objectContaining({
      companyCode, history: [
        expect.objectContaining({ sender: "user", text: "Tôi muốn tư vấn, tôi tên An" }),
        { sender: "model", text: "Anh An cho em xin số liên hệ nhé." },
      ],
    }));
    expect(geminiService.chat).toHaveBeenLastCalledWith("0901234567", expect.any(Array),
      expect.objectContaining({ advancedInstructions: "Tư vấn tự nhiên" }),
      expect.objectContaining({ contextText: "Giá gói từ kho tri thức",
        leadIntake: expect.objectContaining({ collected: { name: "An", phone: "0901234567" } }) }));
    await expect(readChatTestState("OTHER", userId, session.id)).rejects.toMatchObject({ status: 404 });
    await expect(readChatTestState(companyCode, "other-user", session.id)).rejects.toMatchObject({ status: 404 });
  });

  it("deduplicates a retried send and serializes turns until processing finishes", async () => {
    const session = await start();
    const [firstId, duplicateId] = await Promise.all([
      send(session.id, "Xin tư vấn", "same-client-message"), send(session.id, "Xin tư vấn", "same-client-message"),
    ]);
    expect(duplicateId).toBe(firstId);
    expect(await ChatTestMessageModel.countDocuments()).toBe(1);
    expect(await MessengerBackgroundJobModel.countDocuments()).toBe(1);
    await expect(send(session.id, "Tin tiếp", "another-client-message")).rejects.toMatchObject({ status: 409 });
    await expect(deleteChatTestSession(companyCode, userId, session.id)).rejects.toMatchObject({ status: 409 });
    await failChatTestMessage({ sessionId: session.id, messageId: firstId });
    await retryChatTestMessage(companyCode, userId, session.id, firstId);
    await processChatTestMessage({ sessionId: session.id, messageId: firstId });
    expect((await readChatTestState(companyCode, userId, session.id)).messages[0].status).toBe("completed");
    expect(await ChatTestMessageModel.countDocuments()).toBe(1);
  });

  it("runs uploaded images through production OCR and fills an existing Lead with the same contract", async () => {
    const liveLead = await CRMTicketModel.create({ companyCode, customerName: "Khách thật", answers: { contract: "HD001" } });
    await LeadContractModel.create({ companyCode, provider: "FPT", code: "HD001", leadId: liveLead._id, firstSeenAt: new Date() });
    const session = await start(true);
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: "white" } }).png().toBuffer();
    const image = `data:image/png;base64,${bytes.toString("base64")}`;
    // The image is handled independently of text intake, matching the live OCR job.
    vi.mocked(generateReplyCompletion).mockImplementation(async input => ({
      text: JSON.stringify(input.operation === "lead_contract_ocr" ? {
        kind: "document", fields: {
          name: { status: "readable", text: "Nguyễn An" },
          phone: { status: "readable", text: "0901234567" }, contract: { status: "readable", text: "HD001" },
        },
      } : { __lead_intent: false }),
    }) as Awaited<ReturnType<typeof generateReplyCompletion>>);
    const messageId = await send(session.id, "", "image-client-message", image);
    await processChatTestMessage({ sessionId: session.id, messageId });
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.messages[0].ocr).toMatchObject({ status: "recorded", values: { name: "Nguyễn An", contract: "HD001" } });
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].id).toBe(String(liveLead._id));
    expect(await CRMTicketModel.findById(liveLead._id).lean()).toMatchObject({
      companyCode, customerName: "Khách thật", phone: "0901234567", answers: { contract: "HD001", name: "Nguyễn An" },
    });
    await deleteChatTestSession(companyCode, userId, session.id);
    expect(await LeadContractPhotoModel.countDocuments({ companyCode })).toBe(1);
    expect(await ChatTestMessageModel.countDocuments({ sessionId: session.id })).toBe(1);
    expect((await readChatTestSession(companyCode, userId, session.id)).archived).toBe(true);
    expect(await CRMTicketModel.findById(liveLead._id)).toBeTruthy();
  });
  it("applies saved inbox rules to the next turn and keeps preview read-only", async () => {
    const session = await start();
    await saveChatTestConfig(companyCode, userId, session.id, { enabled: true, advancedInstructions: "Rule mới" });
    expect((await UserModel.findById(userId).lean())?.aiAutoReplyConfig?.advancedInstructions).toBe("Rule mới");
    await previewChatTestReply(companyCode, userId, session.id, "Tôi là An", []);
    expect(await CRMTicketModel.countDocuments({ companyCode })).toBe(0);
    const messageId = await send(session.id, "Tôi là An", "new-rules-message");
    await processChatTestMessage({ sessionId: session.id, messageId });
    expect(geminiService.chat).toHaveBeenLastCalledWith("Tôi là An", expect.any(Array),
      expect.objectContaining({ advancedInstructions: "Rule mới" }), expect.any(Object));
    expect(await CRMTicketModel.countDocuments({ companyCode })).toBe(1);
  });
  it("honors the AI switch and reads Lead field changes without a new conversation", async () => {
    const session = await start();
    await saveChatTestConfig(companyCode, userId, session.id, { enabled: false, advancedInstructions: "Tạm tắt" });
    const pausedId = await send(session.id, "Xin tư vấn", "paused-chat-message");
    await processChatTestMessage({ sessionId: session.id, messageId: pausedId });
    expect(geminiService.chat).not.toHaveBeenCalled();
    expect(await CRMTicketModel.countDocuments({ companyCode })).toBe(0);
    expect((await readChatTestState(companyCode, userId, session.id)).messages[0].error).toContain("Chatbot đang tắt");
    await saveChatTestConfig(companyCode, userId, session.id, { enabled: true, advancedInstructions: "Tư vấn" });
    await LeadIntakeProfileModel.updateOne({ companyCode, status: "active" }, { $set: {
      version: 2, fields: [...fields, { key: "email", label: "Email", question: "Email?", type: "email", required: true }],
    } });
    const activeId = await send(session.id, "Tôi là An", "resumed-chat-message");
    await processChatTestMessage({ sessionId: session.id, messageId: activeId });
    expect(geminiService.chat).toHaveBeenLastCalledWith("Tôi là An", expect.any(Array), expect.any(Object),
      expect.objectContaining({ leadIntake: expect.objectContaining({
        missingRequiredFields: expect.arrayContaining([expect.objectContaining({ label: "Email" })]),
      }) }));
    expect(await CRMTicketModel.countDocuments({ companyCode })).toBe(1);
  });
  it("saves rules to the selected Page and writes its normal Lead worksheet", async () => {
    const account = await SocialIntegrationModel.create({
      companyCode, platform: "Facebook", username: "PAGE-123", displayName: "Page hiện tại", createdBy: userId,
      isConnected: true, aiAutoReplyConfig: { enabled: true, advancedInstructions: "Rule Page" },
    });
    vi.mocked(prepareChatPreview).mockImplementation(async () => ({
      aiConfig: { ...(await SocialIntegrationModel.findById(account._id).lean())!.aiAutoReplyConfig },
      history: [], sourceMessages: [], channel: "facebook", sessionId: undefined, platformId: "PAGE-123", pageId: "PAGE-123",
    }));
    const session = await createChatTestSession(companyCode, userId, { channel: "facebook", sourceAccountId: "PAGE-123", ocrEnabled: false });
    await saveChatTestConfig(companyCode, userId, session.id, { enabled: true, advancedInstructions: "Rule Page mới" });
    expect((await SocialIntegrationModel.findById(account._id).lean())?.aiAutoReplyConfig?.advancedInstructions).toBe("Rule Page mới");
    expect((await UserModel.findById(userId).lean())?.aiAutoReplyConfig?.advancedInstructions).toBe("Tư vấn tự nhiên");
    const messageId = await send(session.id, "Tôi là An", "page-config-message");
    await processChatTestMessage({ sessionId: session.id, messageId });
    expect(await CRMTicketModel.findOne({ companyCode }).lean()).toMatchObject({
      sourceAccountId: "PAGE-123", sourceConversationId: session.id,
    });
  });
  it("automatically reads an image into the configured Lead fields without OCR settings or a contract field", async () => {
    await LeadIntakeProfileModel.updateOne({ companyCode, status: "active" }, { $set: { fields: fields.slice(0, 2) } });
    const session = await start();
    expect(await TelecomInvoiceSettingsModel.countDocuments({ companyCode })).toBe(0);
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: "white" } }).png().toBuffer();
    const image = `data:image/png;base64,${bytes.toString("base64")}`;
    vi.mocked(generateReplyCompletion).mockImplementation(async input => ({
      text: JSON.stringify(input.operation === "lead_document_ocr" ? {
        kind: "document", fields: {
          name: { status: "readable", text: "Nguyễn An" },
          phone: { status: "readable", text: "0901234567" },
          unknown_column: { status: "readable", text: "Không lấy trường ngoài cấu hình" },
        },
      } : { __lead_intent: false }),
    }) as Awaited<ReturnType<typeof generateReplyCompletion>>);
    const messageId = await send(session.id, "", "automatic-image-message", image);
    await processChatTestMessage({ sessionId: session.id, messageId });
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      customerName: "Nguyễn An", phone: "0901234567", collectionStatus: "complete",
      answers: { name: "Nguyễn An", phone: "0901234567" },
    });
    expect(result.leads[0].answers).not.toHaveProperty("unknown_column");
    expect(result.leads[0].intakeFields.map(field => field.key)).toEqual(["name", "phone"]);
    expect(geminiService.chat).toHaveBeenLastCalledWith("[Ảnh]", expect.any(Array), expect.any(Object),
      expect.objectContaining({ leadIntake: expect.objectContaining({ collected: {
        name: "Nguyễn An", phone: "0901234567",
      }, missingRequiredFields: [] }) }));
    expect(await TelecomInvoiceSettingsModel.countDocuments({ companyCode })).toBe(0);
  });
  it("keeps different subscriber screenshots separate, reuses an existing Lead, and isolates follow-up context", async () => {
    const subscriberFields = [...fields.slice(0, 2),
      { key: "account", label: "Account", question: "Account chính?", type: "text", required: true },
      { key: "address", label: "Địa chỉ lắp đặt", question: "Địa chỉ?", type: "text", required: false },
      { key: "technician_phone", label: "Số điện thoại người xử lý", question: "Số nhân viên?", type: "phone", required: false },
    ];
    await LeadIntakeProfileModel.updateOne({ companyCode }, { $set: { fields: subscriberFields } });
    const existing = await CRMTicketModel.create({ companyCode, customerName: "Khách Duy", answers: { account: "bnh_gftth_duynd15" } });
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: "white" } }).png().toBuffer();
    const image = `data:image/png;base64,${bytes.toString("base64")}`;
    const rows = [
      { account: "bnh_gftth_duynd15", name: "NGUYỄN ĐẮC DUY", phone: "0358294461", technician_phone: "0969928992" },
      { account: "bnh_gftth_thuyltt4", name: "LÊ THỊ THU THỦY", phone: "0869901418" },
      { account: "bnh_gftth_duynd15", address: "Tòa K phòng 310" },
    ];
    vi.mocked(generateReplyCompletion).mockImplementation(async input => ({ text: JSON.stringify(input.operation === "lead_document_ocr"
      ? { kind: "document", fields: Object.fromEntries(Object.entries(rows.shift()!).map(([key, text]) => [key, { status: "readable", text }])) }
      : { __lead_intent: true, address: "Địa chỉ bổ sung" }) }) as never);
    const session = await start(false, "telecom");
    for (let i = 0; i < 2; i++) {
      const messageId = await send(session.id, "", `subscriber-photo-${i}`, image);
      await processChatTestMessage({ sessionId: session.id, messageId });
    }
    const followUp = await send(session.id, "Địa chỉ bổ sung", "subscriber-follow-up");
    await processChatTestMessage({ sessionId: session.id, messageId: followUp });
    expect(geminiService.chat).toHaveBeenLastCalledWith("Địa chỉ bổ sung", [
      expect.objectContaining({ sender: "user", text: "[Ảnh]" }), expect.objectContaining({ sender: "model" }),
    ], expect.any(Object), expect.objectContaining({ leadIntake: expect.objectContaining({ collected: expect.objectContaining({
      account: "BNH_GFTTH_THUYLTT4", name: "LÊ THỊ THU THỦY", phone: "0869901418",
    }) }) }));
    const lastImage = await send(session.id, "", "subscriber-photo-3", image);
    await processChatTestMessage({ sessionId: session.id, messageId: lastImage });
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.leads).toHaveLength(2);
    expect(await CRMTicketModel.findById(existing._id).lean()).toMatchObject({
      customerName: "NGUYỄN ĐẮC DUY", phone: "0358294461", telecomSubscriberCode: "BNH_GFTTH_DUYND15",
      answers: { account: "BNH_GFTTH_DUYND15", address: "Tòa K phòng 310", technician_phone: "0969928992" },
    });
    const other = await CRMTicketModel.findOne({ companyCode, telecomSubscriberCode: "BNH_GFTTH_THUYLTT4" }).lean();
    expect(other).toMatchObject({ customerName: "LÊ THỊ THU THỦY", phone: "0869901418", answers: { address: "Địa chỉ bổ sung" } });
    // A new internal chat can add to the same company Lead without creating a duplicate.
    rows.push({ account: "bnh_gftth_duynd15", address: "Tòa K phòng 310" });
    const nextSession = await start(false, "telecom");
    const nextMessage = await send(nextSession.id, "", "another-session-photo", image);
    await processChatTestMessage({ sessionId: nextSession.id, messageId: nextMessage });
    expect(await CRMTicketModel.countDocuments({ companyCode })).toBe(2);
    expect((await readChatTestState(companyCode, userId, session.id)).leads).toHaveLength(2);
    expect(prepareChatReplyContext).toHaveBeenLastCalledWith(expect.objectContaining({ uploadedImages: [],
      aiConfig: expect.objectContaining({ imageReplyEnabled: false }) }));
  });
  it("does not attach an infrastructure-only or ambiguous-account image to the previous customer", async () => {
    await LeadIntakeProfileModel.updateOne({ companyCode }, { $set: { fields: [...fields.slice(0, 2),
      { key: "account", label: "Mã thuê bao", question: "Mã?", type: "text", required: true },
      { key: "terminal", label: "Mã kết cuối", question: "Mã kết cuối?", type: "text", required: false },
    ] } });
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: "white" } }).png().toBuffer();
    const image = `data:image/png;base64,${bytes.toString("base64")}`;
    const session = await start(false, "telecom");
    const rows = [
      { account: { status: "readable", text: "subscriber_1" }, name: { status: "readable", text: "Khách Một" } },
      { terminal: { status: "readable", text: "BNH0683-GN51-SN11-SP01" } },
      { account: { status: "unclear", text: "subscriber_1, subscriber_2" } },
    ];
    vi.mocked(generateReplyCompletion).mockImplementation(async () => ({ text: JSON.stringify({ kind: "document", fields: rows.shift() }) }) as never);
    for (let i = 0; i < 3; i++) {
      const messageId = await send(session.id, "", `ambiguous-photo-${i}`, image);
      await processChatTestMessage({ sessionId: session.id, messageId });
    }
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].answers).not.toHaveProperty("terminal");
    expect(result.messages[1].ocr?.issue).toContain("Chưa ghi ảnh vào Lead");
    expect(result.messages[2].ocr?.issue).toContain("Chưa ghi ảnh vào Lead");
    expect(geminiService.chat).toHaveBeenLastCalledWith("[Ảnh]", [], expect.any(Object),
      expect.objectContaining({ leadIntake: expect.objectContaining({ goal: expect.stringContaining("chưa ghi vào Lead") }) }));
  });
  it("can associate a pending infrastructure image after the user explicitly supplies its account", async () => {
    await LeadIntakeProfileModel.updateOne({ companyCode }, { $set: { fields: [
      { key: "account", label: "Mã thuê bao", question: "Mã?", type: "text", required: true },
      { key: "terminal", label: "Mã kết cuối", question: "Mã kết cuối?", type: "text", required: false },
    ] } });
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: "white" } }).png().toBuffer();
    const image = `data:image/png;base64,${bytes.toString("base64")}`;
    vi.mocked(generateReplyCompletion).mockImplementation(async input => ({ text: JSON.stringify(input.operation === "lead_document_ocr"
      ? { kind: "document", fields: { terminal: { status: "readable", text: "BNH0683-GN51-SN11-SP01" } } }
      : { __lead_intent: false }) }) as never);
    const session = await start(false, "telecom");
    const messageId = await send(session.id, "", "pending-infra-image", image);
    await processChatTestMessage({ sessionId: session.id, messageId });
    expect(await CRMTicketModel.countDocuments({ companyCode })).toBe(0);
    const confirmId = await send(session.id, "account bnh_gftth_phuongntl4", "pending-infra-account");
    await processChatTestMessage({ sessionId: session.id, messageId: confirmId });
    expect(await CRMTicketModel.findOne({ companyCode }).lean()).toMatchObject({
      telecomSubscriberCode: "BNH_GFTTH_PHUONGNTL4", answers: { account: "BNH_GFTTH_PHUONGNTL4", terminal: "BNH0683-GN51-SN11-SP01" },
    });
  });
  it("keeps ordinary Lead collection on its conversation even when its columns include Account", async () => {
    await LeadIntakeProfileModel.updateOne({ companyCode }, { $set: { fields: [...fields.slice(0, 2),
      { key: "account", label: "Account", question: "Tài khoản?", type: "text", required: false },
    ] } });
    const bytes = await sharp({ create: { width: 3, height: 3, channels: 3, background: "white" } }).png().toBuffer();
    const image = `data:image/png;base64,${bytes.toString("base64")}`;
    const rows = [{ name: { status: "readable", text: "Nguyễn An" } }, { account: { status: "readable", text: "client-account" } }];
    vi.mocked(generateReplyCompletion).mockImplementation(async () => ({ text: JSON.stringify({ kind: "document", fields: rows.shift() }) }) as never);
    // Omitted domain is the backwards-compatible, non-telecom default.
    const session = await createChatTestSession(companyCode, userId, { channel: "facebook", ocrEnabled: false });
    expect(session.documentDomain).toBe("general");
    for (let i = 0; i < 2; i++) {
      const messageId = await send(session.id, "", `general-account-photo-${i}`, image);
      await processChatTestMessage({ sessionId: session.id, messageId });
    }
    const result = await readChatTestState(companyCode, userId, session.id);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].answers).toMatchObject({ name: "Nguyễn An", account: "client-account" });
    const lead = await CRMTicketModel.findOne({ companyCode }).lean();
    expect(lead?.sourceConversationId).toBe(session.id);
    expect(lead?.telecomSubscriberCode).toBeUndefined();
    expect(await ChatTestMessageModel.countDocuments({ sessionId: session.id, leadDocumentMode: true })).toBe(0);
    for (const [request] of vi.mocked(generateReplyCompletion).mock.calls) {
      expect(String(request.messages[0].content)).not.toContain("Với ảnh nghiệp vụ viễn thông");
    }
  });
});
