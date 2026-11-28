import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { ZaloConversationModel } from "../model/zalo-messenger.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { ZbsBatchModel, ZbsOaLockModel, ZbsReceiptModel, ZbsTemplateModel } from "./model";
import { buildZbsRows, normalizeZbsPhone, validateMapping } from "./core";
import { normalizeZbsTemplate, sendZbsRow } from "./provider";
import { confirmZbsBatch, createZbsDraft, getZbsBatch, publicBatch, syncZbsTemplates } from "./service";
import { processNextZbsMessage } from "./worker";
import { receiveZbsReceipt } from "./webhook";
import { getEffectivePermissions } from "../../../../middleware/auth";

vi.mock("../service/zalo-messenger.service", () => ({ zaloMessengerService: { getAccessTokenByOAId: vi.fn(async () => "test-token") } }));
vi.mock("../../../../middleware/auth", () => ({ getEffectivePermissions: vi.fn(async () => new Set(["omni-inbox:manage"])) }));
vi.mock("../../shared/access", () => ({ companyModuleEnabled: vi.fn(async () => true) }));
vi.mock("../../../../security/account-access", () => ({ assertAccountUsable: vi.fn() }));
const raw = { templateId: "123", templateName: "Báo giá", status: "ENABLE", price_uid: "200", price_sdt: "300",
  listParams: [{ name: "ten", require: true, type: "STRING", maxLength: 100 }, { name: "ma", require: true, type: "STRING", maxLength: 50 }],
  listButtons: [], previewUrl: "https://account.zalo.cloud/znspreview/example" };
const template = normalizeZbsTemplate(raw);
const mapping = { ten: { source: "lead" as const, key: "customerName" }, ma: { source: "answer" as const, key: "ma_yeu_cau" } };
const oaId = "123456789";
let mongo: MongoMemoryServer;
let userId: string;
let leadId: string;
const provider = vi.fn<typeof fetch>();
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([ZbsBatchModel.init(), ZbsTemplateModel.init(), ZbsReceiptModel.init(), ZbsOaLockModel.init()]);
}, 60000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  vi.stubEnv("ZALO_APP_ID", "456");
  vi.stubEnv("ZALO_APP_SECRET", "global-test-secret");
  provider.mockReset(); vi.stubGlobal("fetch", provider);
  vi.mocked(getEffectivePermissions).mockResolvedValue(new Set(["omni-inbox:manage"]));
  provider.mockImplementation(async (url) => {
    const path = String(url);
    return Response.json(path.includes("/template/info") ? { error: 0, data: raw } : path.includes("/template/all") ? { error: 0, data: [{ templateId: "123" }], metadata: { total: 1 } } : { error: 0, data: { message_id: "msg-1" } });
  });
  userId = String(new mongoose.Types.ObjectId());
  await UserModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(userId), companyCode: "ACME", role: "admin", email: "test@example.test" });
  await SocialIntegrationModel.collection.insertOne({ companyCode: "ACME", platform: "Zalo", username: oaId, isConnected: true, isMock: false });
  const conversation = await ZaloConversationModel.collection.insertOne({ oaId, recipientId: "0012345678901234567" });
  const lead = await CRMTicketModel.create({ companyCode: "ACME", customerName: "Khách A", phone: "0912345678", sourcePlatform: "zalo", sourceAccountId: oaId, sourceConversationId: String(conversation.insertedId), answers: { ma_yeu_cau: "BG001" } });
  leadId = String(lead._id);
});
const draft = (extra = {}) => createZbsDraft("ACME", userId, { name: "Đợt gửi", oaId, templateId: "123", method: "uid", leadIds: [leadId], mapping, ...extra });

describe("ZBS recipients and mapping", () => {
  it("normalizes Vietnamese numbers and preserves UID strings scoped to OA", () => {
    expect(normalizeZbsPhone("+84 912 345 678")).toBe("84912345678");
    expect(normalizeZbsPhone("0912.345.678")).toBe("84912345678");
    expect(normalizeZbsPhone("abc0912345678")).toBe("");
    const leads = [{ id: "a", customerName: "A", answers: { ma_yeu_cau: "BG" }, phone: "0912345678", zaloIdentity: { oaId, uid: "00123" } }];
    expect(buildZbsRows(template, "uid", mapping, leads, oaId)[0]).toMatchObject({ recipient: "00123", status: "pending" });
    expect(buildZbsRows(template, "uid", mapping, leads, "another")[0].status).toBe("blocked");
    expect(buildZbsRows(template, "phone", mapping, leads, oaId)[0].recipient).toBe("84912345678");
  });
  it("blocks missing data and duplicate recipients without letting an invalid duplicate consume the valid one", () => {
    const rows = buildZbsRows(template, "phone", mapping, [
      { id: "a", customerName: "A", phone: "0912345678" },
      { id: "b", customerName: "B", phone: "0912345678", answers: { ma_yeu_cau: "BG" } },
      { id: "c", customerName: "C", phone: "+84912345678", answers: { ma_yeu_cau: "BG" } },
    ], oaId);
    expect(rows.map(r => r.status)).toEqual(["blocked", "pending", "blocked"]);
    expect(rows[2].reason).toContain("Trùng");
    expect(() => validateMapping({ ten: { source: "lead", key: "companyCode" } }, template.params)).toThrow();
    expect(normalizeZbsTemplate({ ...raw, price_uid: undefined }).uidSupported).toBe(false);
  });
});
it("syncs templates from the provider and preserves approved mapping", async () => {
  await syncZbsTemplates("ACME", oaId);
  await ZbsTemplateModel.updateOne({ templateId: "123" }, { $set: { mapping } });
  await syncZbsTemplates("ACME", oaId);
  expect((await ZbsTemplateModel.findOne().lean())?.mapping).toEqual(mapping);
});
it("automatically refreshes multiple templates, caches successful sync and discovers newly approved templates", async () => {
  let added = false;
  provider.mockImplementation(async url => {
    const path = String(url);
    if (path.includes("/template/all")) return Response.json({ error: 0, data: [{ templateId: "123" }, ...(added ? [{ templateId: "456" }] : [])], metadata: { total: added ? 2 : 1 } });
    return Response.json({ error: 0, data: path.includes("template_id=456") ? { ...raw, templateId: "456", templateName: "Nhắc thanh toán" } : raw });
  });
  await Promise.all([syncZbsTemplates("ACME", oaId, false), syncZbsTemplates("ACME", oaId, false)]);
  expect(provider).toHaveBeenCalledTimes(2);
  await ZbsTemplateModel.updateOne({ templateId: "123" }, { $set: { mapping } });
  provider.mockClear();
  expect(await syncZbsTemplates("ACME", oaId, false)).toHaveLength(1);
  expect(provider).not.toHaveBeenCalled();
  added = true;
  await ZbsOaLockModel.updateMany({ _id: /^templates:/ }, { $set: { nextAt: new Date(0) } });
  const templates = await syncZbsTemplates("ACME", oaId, false);
  expect(templates.map(t => t.templateId).sort()).toEqual(["123", "456"]);
  expect(templates.find(t => t.templateId === "123")?.mapping).toEqual(mapping);
  const preview = await draft({ templateId: "456" });
  expect(preview).toMatchObject({ templateId: "456", templateName: "Nhắc thanh toán" });
  await confirmZbsBatch("ACME", userId, preview.id);
  provider.mockImplementation(async url => Response.json(String(url).includes("/template/info") ? { error: 0, data: { ...raw, templateId: "456", templateName: "Nhắc thanh toán" } } : { error: 0, data: { message_id: "selected-template-message" } }));
  await processNextZbsMessage();
  const send = provider.mock.calls.find(([url]) => String(url).includes("/message/template"));
  expect(JSON.parse(String(send?.[1]?.body))).toMatchObject({ template_id: "456" });
  const phonePreview = await draft({ templateId: "456", method: "phone" });
  await confirmZbsBatch("ACME", userId, phonePreview.id);
  await ZbsOaLockModel.updateOne({ _id: `456:${oaId}` }, { $set: { nextAt: new Date(0), until: new Date(0) } });
  provider.mockClear();
  await processNextZbsMessage();
  const phoneSend = provider.mock.calls.find(([url]) => String(url).includes("/message/template"));
  const phoneBody = JSON.parse(String(phoneSend?.[1]?.body));
  expect(phoneBody).toMatchObject({ template_id: "456", phone: "84912345678" });
  expect(phoneBody).not.toHaveProperty("user_id");
});
it("fetches all template pages and leaves the cached list untouched if a detail request fails", async () => {
  provider.mockImplementation(async url => {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/template/all") {
      const offset = Number(parsed.searchParams.get("offset"));
      return Response.json({ error: 0, data: Array.from({ length: offset === 0 ? 100 : 2 }, (_, index) => ({ templateId: String(offset + index + 1) })), metadata: { total: 102 } });
    }
    return Response.json({ error: 0, data: { ...raw, templateId: parsed.searchParams.get("template_id") } });
  });
  expect(await syncZbsTemplates("ACME", oaId)).toHaveLength(102);
  expect(provider.mock.calls.some(([url]) => String(url).includes("offset=100"))).toBe(true);
  provider.mockImplementation(async url => {
    if (String(url).includes("/template/all")) return Response.json({ error: 0, data: [{ templateId: "1" }, { templateId: "2" }], metadata: { total: 2 } });
    if (String(url).includes("template_id=2")) throw new Error("provider unavailable");
    return Response.json({ error: 0, data: { ...raw, templateId: "1", status: "DISABLE" } });
  });
  await expect(syncZbsTemplates("ACME", oaId)).rejects.toThrow();
  expect(await ZbsTemplateModel.countDocuments({ status: "ENABLE" })).toBe(102);
  const lock = await ZbsOaLockModel.findOne({ _id: /^templates:/ }).lean();
  expect(lock?.until?.getTime()).toBe(0);
}, 15000);
it("previews immutable Lead values, confirms once, dispatches one UID message and receives read/delivery events", async () => {
  const preview = await draft();
  expect(preview.rows[0]).toMatchObject({ recipient: "0012345678901234567", data: { ten: "Khách A", ma: "BG001" } });
  expect(preview.estimatedCost).toBe(200);
  await CRMTicketModel.updateOne({ _id: leadId }, { $set: { customerName: "Tên đổi sau xem trước" } });
  await Promise.all([confirmZbsBatch("ACME", userId, preview.id), confirmZbsBatch("ACME", userId, preview.id)]);
  provider.mockClear();
  await Promise.all([processNextZbsMessage(), processNextZbsMessage()]);
  const sends = provider.mock.calls.filter(([url]) => String(url).includes("/message/template"));
  expect(sends).toHaveLength(1);
  expect(JSON.parse(String(sends[0][1]?.body))).toEqual({ template_id: "123", user_id: "0012345678901234567", template_data: { ten: "Khách A", ma: "BG001" } });
  let batch = await getZbsBatch("ACME", preview.id);
  expect(batch.rows[0].status).toBe("accepted");
  const event = { app_id: "456", sender: { id: oaId }, recipient: { id: "0012345678901234567" }, event_name: "user_seen_message", timestamp: "1795840000000", message: { msg_ids: ["msg-1"] } };
  await receiveZbsReceipt(event);
  await receiveZbsReceipt(event);
  await receiveZbsReceipt({ ...event, event_name: "user_received_message", message: { msg_id: "msg-1" } });
  batch = await getZbsBatch("ACME", preview.id);
  expect(batch.rows[0].status).toBe("read");
  expect(await ZbsReceiptModel.countDocuments()).toBe(2);
  expect(publicBatch(batch)).not.toHaveProperty("createdBy");
});
it("never falls back to phone or retries an ambiguous send, including worker recovery", async () => {
  const preview = await draft(); await confirmZbsBatch("ACME", userId, preview.id);
  provider.mockImplementation(async url => { if (String(url).includes("/template/info")) return Response.json({ error: 0, data: raw }); throw new Error("timeout"); });
  await processNextZbsMessage();
  expect((await getZbsBatch("ACME", preview.id)).rows[0].status).toBe("unknown");
  await processNextZbsMessage();
  expect(provider.mock.calls.filter(([url]) => String(url).includes("/message/template"))).toHaveLength(1);
  await ZbsBatchModel.updateOne({ _id: preview.id }, { $set: { status: "running", "rows.0.status": "sending", leaseUntil: new Date(0) } });
  await ZbsOaLockModel.updateMany({}, { $set: { until: new Date(0), nextAt: new Date(0) } });
  await processNextZbsMessage();
  expect((await getZbsBatch("ACME", preview.id)).rows[0].status).toBe("unknown");
  expect(provider.mock.calls.filter(([url]) => String(url).includes("/message/template"))).toHaveLength(1);
});
it("isolates companies and rejects mismatched templates, expired drafts and unsupported development mode", async () => {
  await expect(createZbsDraft("OTHER", userId, { name: "x", oaId, templateId: "123", method: "uid", leadIds: [leadId], mapping })).rejects.toThrow();
  const preview = await draft();
  await expect(getZbsBatch("OTHER", preview.id)).rejects.toThrow();
  provider.mockResolvedValue(Response.json({ error: 0, data: { ...raw, status: "DISABLE" } }));
  await expect(confirmZbsBatch("ACME", userId, preview.id)).rejects.toThrow("thay đổi");
  await ZbsBatchModel.updateOne({ _id: preview.id }, { $set: { expiresAt: new Date(0) } });
  await expect(confirmZbsBatch("ACME", userId, preview.id)).rejects.toThrow("hết hạn");
  await expect(draft({ test: true, development: true })).rejects.toThrow("Development");
});
it("sends phone development payload separately and uses its tracking receipt without cross-OA updates", async () => {
  const preview = await draft({ method: "phone", test: true, development: true });
  const response = await sendZbsRow("ACME", oaId, "123", preview.rows[0], true);
  expect(response.error).toBe(0);
  const call = provider.mock.calls.at(-1)!;
  expect(JSON.parse(String(call[1]?.body))).toMatchObject({ phone: "84912345678", mode: "development", tracking_id: preview.rows[0].trackingId });
  await ZbsBatchModel.updateOne({ _id: preview.id }, { $set: { status: "completed", "rows.0.status": "unknown" } });
  const event = { app_id: "456", sender: { id: "99999" }, recipient: { id: "84912345678" }, event_name: "user_received_message", message: { msg_id: "phone-1", tracking_id: preview.rows[0].trackingId, delivery_time: "1795840000000" }, timestamp: "1795840001000" };
  await receiveZbsReceipt(event, "ZNS"); expect((await getZbsBatch("ACME", preview.id)).rows[0].status).toBe("unknown");
  await receiveZbsReceipt({ ...event, sender: { id: oaId } }, "ZNS");
  expect((await getZbsBatch("ACME", preview.id)).rows[0]).toMatchObject({ status: "delivered", deliveredAt: new Date(1795840000000).toISOString() });
});
it("retains receipts that arrive before the provider response and never downgrades delivery", async () => {
  const preview = await draft({ method: "phone" }); await confirmZbsBatch("ACME", userId, preview.id);
  provider.mockImplementation(async url => {
    if (String(url).includes("/template/info")) return Response.json({ error: 0, data: raw });
    await receiveZbsReceipt({ app_id: "456", sender: { id: oaId }, recipient: { id: "84912345678" }, event_name: "user_received_message", timestamp: "1795840000000",
      message: { msg_id: "early-1", tracking_id: preview.rows[0].trackingId, delivery_time: "1795840000000" } }, "ZNS");
    return Response.json({ error: 0, data: { msg_id: "early-1" } });
  });
  await processNextZbsMessage();
  expect((await getZbsBatch("ACME", preview.id)).rows[0]).toMatchObject({ status: "delivered", messageId: "early-1" });
});
it("pauses pending sends when permissions are revoked and makes no send request", async () => {
  const preview = await draft(); await confirmZbsBatch("ACME", userId, preview.id);
  vi.mocked(getEffectivePermissions).mockResolvedValue(new Set(["omni-inbox:read"]));
  provider.mockClear(); await processNextZbsMessage();
  expect((await getZbsBatch("ACME", preview.id)).status).toBe("paused");
  expect(provider).not.toHaveBeenCalled();
});
it("pauses the remaining recipients after a provider balance rejection", async () => {
  const other = await CRMTicketModel.create({ companyCode: "ACME", customerName: "B", phone: "0987654321", answers: { ma_yeu_cau: "BG2" } });
  const preview = await draft({ method: "phone", leadIds: [leadId, String(other._id)] });
  await confirmZbsBatch("ACME", userId, preview.id);
  provider.mockImplementation(async url => Response.json(String(url).includes("/template/info") ? { error: 0, data: raw } : { error: -137 }));
  await processNextZbsMessage();
  const result = await getZbsBatch("ACME", preview.id);
  expect(result.status).toBe("paused");
  expect(result.rows.map(row => row.status)).toEqual(["failed", "pending"]);
  await processNextZbsMessage();
  expect(provider.mock.calls.filter(([url]) => String(url).includes("/message/template"))).toHaveLength(1);
});
