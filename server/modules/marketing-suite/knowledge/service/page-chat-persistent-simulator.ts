import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { FBConversationModel, FBMessageModel } from "../../message/model/fb-messenger.model";
import { CakeCustomerMemoryModel } from "../../message/model/cake-customer-memory.model";
import { MessengerOrderModel } from "../../message/model/messenger-order.model";
import { PageChatFlowModel } from "../../message/model/page-chat-flow.model";
import { RetailOrderModel } from "../../../retail/models/retail-order.model";
import { CustomerModel } from "../../../customer-management/models/customer.model";
import { normalizePhone, phoneLookupVariants } from "../../../customer-management/customer-normalization";
import { chatOrderFlowRegistry } from "../../message/service/chat-ordering/registry";
import { simulatePageChat, type SimulatedTurn } from "./page-chat-simulator";

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function runPersistentPageChatTurn(input: {
  companyCode: string;
  pageId: string;
  conversationKey: string;
  turnId: string;
  message: string;
}) {
  const companyCode = input.companyCode.trim().toUpperCase();
  const pageId = input.pageId.trim();
  const conversationKey = input.conversationKey.trim();
  const turnId = input.turnId.trim();
  const message = input.message.trim();
  const integration = await SocialIntegrationModel.findOne({ companyCode, platform: "Facebook", username: pageId, isConnected: true })
    .select("displayName aiAutoReplyConfig").lean();
  if (!integration) throw Object.assign(new Error("Page chưa kết nối với doanh nghiệp này."), { statusCode: 404 });

  const activeConfiguration = await PageChatFlowModel.findOne({ companyCode, pageId, status: "active" }).select("flowKey goal fields completionMessage").lean();
  if (activeConfiguration?.flowKey !== "bakery-default") {
    throw Object.assign(new Error("Chế độ lưu đơn thật hiện được bật cho flow tiệm bánh. Hãy chọn flow tiệm bánh đang hoạt động trên Page."), { statusCode: 409 });
  }
  const flow = await chatOrderFlowRegistry.resolveForCompanyPage(companyCode, pageId);
  if (!flow || flow.key !== "bakery-default" || !await flow.isEnabled(pageId)) {
    throw Object.assign(new Error("Flow đặt bánh chưa sẵn sàng. Kiểm tra tài liệu giá và kết nối Page."), { statusCode: 409 });
  }

  const conversationHash = stableHash(`${companyCode}:${pageId}:${conversationKey}`);
  const conversationId = new Types.ObjectId(conversationHash.slice(0, 24));
  const recipientId = `SIM_${conversationHash.slice(0, 32)}`;
  const messageId = `SIM_IN_${stableHash(`${conversationHash}:${turnId}`).slice(0, 48)}`;
  const replyMessageId = `SIM_OUT_${stableHash(`${conversationHash}:${turnId}:reply`).slice(0, 48)}`;
  const now = new Date();

  let conversation = await FBConversationModel.findOne({ _id: conversationId, pageId }).lean();
  if (conversation && (conversation.isSimulation !== true || conversation.recipientId !== recipientId)) {
    throw Object.assign(new Error("Không thể mở phiên chạy thử này."), { statusCode: 409 });
  }
  if (!conversation) {
    conversation = await FBConversationModel.findOneAndUpdate({ _id: conversationId, pageId }, { $setOnInsert: {
      _id: conversationId, recipientId, facebookConversationId: `SIM_${conversationHash.slice(0, 32)}`,
      senderName: "Khách mô phỏng ERP", avatarUrl: "", pageId,
      lastMessageText: "", lastMessageAt: now, unreadCount: 0, status: "closed", tags: ["page-chat-simulation"], isVip: false, isSimulation: true,
    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  }

  const previousReply = await FBMessageModel.findOne({ conversationId, messageId: replyMessageId, direction: "outbound" }).lean();
  if (previousReply) {
    const prior = await readPersistedResult({ companyCode, conversationId, sourceMessageId: messageId, text: previousReply.text });
    return { text: previousReply.text, stage: prior.order ? "Đã lưu khách và đơn nháp" : "Đang tư vấn", nextStep: "",
      sources: prior.order ? ["Kho tri thức", "Module Khách hàng", "Module Bán hàng"] : ["Kho tri thức"], mode: "ai" as const,
      persisted: { customer: prior.customer, order: prior.order } };
  }

  await CakeCustomerMemoryModel.updateOne({ companyCode, pageId, recipientId }, { $setOnInsert: {
    companyCode, pageId, recipientId, conversationId: String(conversationId), purchaseCount: 0, revision: 0,
  } }, { upsert: true });
  const inbound = await FBMessageModel.findOneAndUpdate({ messageId }, { $setOnInsert: {
    conversationId, senderId: recipientId, recipientId: pageId, direction: "inbound", text: message,
    attachments: [], messageId, timestamp: now, status: "delivered",
  } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  if (String(inbound.conversationId) !== String(conversationId)) {
    throw Object.assign(new Error("Mã lượt chat đã được dùng trong một phiên khác."), { statusCode: 409 });
  }
  await FBConversationModel.updateOne({ _id: conversationId, isSimulation: true }, { $set: {
    lastMessageText: message, lastMessageAt: inbound.timestamp, lastSender: "user", unreadCount: 0, status: "closed",
  } });

  const scope = { companyCode, pageId, conversationId: String(conversationId) };
  const session = await flow.prepareSession(scope, messageId);
  const pageRule = [
    integration.aiAutoReplyConfig?.advancedInstructions,
    integration.aiAutoReplyConfig?.customerServiceScript,
    activeConfiguration.goal,
    ...(activeConfiguration.fields || []).map(field => `${field.label}: ${field.question}`),
    activeConfiguration.completionMessage,
  ].filter(value => typeof value === "string" && value.trim()).join("\n");
  const flowReply = await flow.process({
    ...scope, messageId, message, imageUrls: [], simulationMode: true, session,
    businessContext: [pageRule, flow.conversationInstructions, flow.consultationInstructions].filter(Boolean).join("\n\n"),
  });

  let replyText: string;
  let stage = "Đang tư vấn";
  let sources = ["Flow Page", "Kho tri thức"];
  let nextStep = "";
  if (flowReply) {
    replyText = flowReply.text;
    stage = flowReply.isSummary ? "Xác nhận thông tin đơn" : "Tư vấn và chốt đơn";
  } else {
    const priorRows = await FBMessageModel.find({ conversationId, messageId: { $ne: messageId } }).sort({ timestamp: 1 }).limit(40).lean();
    const history: SimulatedTurn[] = priorRows.map(row => ({ role: row.direction === "inbound" ? "customer" : "bot", text: row.text }));
    const fallback = await simulatePageChat({ companyCode, pageId, message, history, rule: pageRule });
    replyText = fallback.text;
    stage = fallback.stage;
    sources = fallback.sources;
    nextStep = fallback.nextStep;
  }

  const records = await readPersistedResult({ companyCode, conversationId, sourceMessageId: messageId, text: replyText });
  if (records.order) {
    const stockNotice = records.order.stockCheck?.status === "untracked"
      ? " Tồn kho mẫu này chưa được theo dõi trong ERP; tiệm cần xác nhận khả năng làm trước khi chốt."
      : records.order.stockCheck?.status === "unknown"
        ? " Chưa xác minh được tồn tại chi nhánh nhận bánh; tiệm cần xác nhận trước khi chốt."
        : records.order.stockCheck?.status === "available"
          ? ` Đã đối chiếu ${records.order.stockCheck.availableQuantity} chiếc tại kho; số lượng chưa được giữ.` : "";
    replyText = `Đơn thử ${records.order.orderCode} đã được lưu vào module Bán hàng dưới dạng nháp, chưa thanh toán.${stockNotice} Hồ sơ khách ${records.customer?.name || ""} đã được lưu vào module Khách hàng. Tin nhắn và mã cọc không được gửi ra Facebook.`;
    stage = "Đã lưu khách và đơn nháp";
    nextStep = "Kiểm tra đơn trong module Bán hàng trước khi dùng cho khách thật";
    sources = ["Kho tri thức", "Module Khách hàng", "Module Bán hàng"];
  }

  await FBMessageModel.create({ conversationId, senderId: pageId, recipientId, direction: "outbound", text: replyText,
    attachments: [], messageId: replyMessageId, consultationSessionId: session.sessionId, senderType: "ai", timestamp: new Date(), status: "sent" });
  await FBConversationModel.updateOne({ _id: conversationId, isSimulation: true }, { $set: {
    lastMessageText: replyText, lastMessageAt: new Date(), lastSender: "assistant", lastAssistantMessageAt: new Date(),
    lastAssistantMessageId: replyMessageId, unreadCount: 0, status: "closed",
  } });
  if (flowReply) await flow.markDelivered(flowReply);
  return { text: replyText, stage, nextStep, sources, mode: "ai" as const,
    persisted: { customer: records.customer, order: records.order } };
}

async function readPersistedResult(input: { companyCode: string; conversationId: Types.ObjectId; sourceMessageId: string; text: string }) {
  const order = await MessengerOrderModel.findOne({ companyCode: input.companyCode, conversationId: input.conversationId,
    sourceMessageId: input.sourceMessageId, isSimulation: true }).select("orderId customerName customerPhone items totalAmount depositRequired depositAmount checkoutSnapshot").lean();
  if (!order) return { text: input.text, stage: "Đang tư vấn", nextStep: "", sources: ["Kho tri thức"], mode: "ai" as const,
    customer: undefined, order: undefined };
  const retailOrder = await RetailOrderModel.findOne({ companyCode: input.companyCode, salesChannel: "facebook-page", externalOrderId: order.orderId })
    .select("_id orderCode status paymentStatus grandTotal customerId").lean();
  const normalizedPhone = normalizePhone(order.customerPhone);
  const customer = await CustomerModel.findOne({ companyCode: input.companyCode,
    $or: [{ normalizedPhone: { $in: phoneLookupVariants(normalizedPhone) } }, { phone: order.customerPhone }] })
    .select("_id name phone").lean();
  return { text: input.text,
    customer: customer ? { id: String(customer._id), name: customer.name, phone: customer.phone } : undefined,
    order: retailOrder ? { id: String(retailOrder._id), orderCode: retailOrder.orderCode || "", status: retailOrder.status,
      paymentStatus: retailOrder.paymentStatus, total: retailOrder.grandTotal, depositRequired: order.depositRequired, depositAmount: order.depositAmount,
      stockCheck: order.checkoutSnapshot?.stockCheck } : undefined,
  };
}
