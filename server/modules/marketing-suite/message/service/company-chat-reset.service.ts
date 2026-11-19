import type { ClientSession, Types } from "mongoose";
import { runInTransaction } from "../../../../config/database";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { AIReplyLogModel } from "../model/ai-reply-log.model";
import { CakeCheckoutModel } from "../model/cake-checkout.model";
import { CakeConsultationSessionModel, CakeCustomerMemoryModel } from "../model/cake-customer-memory.model";
import { ChatTestMessageModel, ChatTestSessionModel } from "../model/chat-test.model";
import { ChatVisualMemoryModel } from "../model/chat-visual-memory.model";
import { FacebookAutoReplyJobModel } from "../model/facebook-auto-reply-job.model";
import { FacebookFollowUpJobModel } from "../model/facebook-follow-up-job.model";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { MessengerBackgroundJobModel } from "../model/messenger-background-job.model";
import { PageChatFlowStateModel } from "../model/page-chat-flow.model";
import { TelecomInvoiceConversationModel, TelecomInvoiceModel } from "../model/telecom-invoice.model";
import { TikTokConversationModel, TikTokMessageModel } from "../model/tiktok-messenger.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";

const channels = [
  { platform: "Facebook", userField: "facebookIntegration.pageId", accountField: "pageId", conversations: FBConversationModel, messages: FBMessageModel },
  { platform: "Zalo", userField: "zaloIntegration.oaId", accountField: "oaId", conversations: ZaloConversationModel, messages: ZaloMessageModel },
  { platform: "TikTok", userField: "tiktokIntegration.username", accountField: "businessAccountId", conversations: TikTokConversationModel, messages: TikTokMessageModel },
] as const;

type ChatChannel = typeof channels[number];

async function resolveChatAccounts(companyCode: string, { platform, userField }: ChatChannel, session?: ClientSession) {
  const companyIds = await SocialIntegrationModel.distinct("username", { companyCode, platform }).setOptions({ session });
  const userIds = await UserModel.distinct(userField, { companyCode }).setOptions({ session });
  const ids = [...new Set([...companyIds, ...userIds].filter((id): id is string => typeof id === "string" && Boolean(id.trim())))];
  if (!ids.length) return ids;

  // Conversation records use a provider ID, so even a disconnected conflicting owner makes deletion unsafe.
  const otherCompany = { $ne: companyCode };
  const sharedIntegration = await SocialIntegrationModel.exists({ companyCode: otherCompany, platform, username: { $in: ids } }).setOptions({ session });
  const sharedUserIntegration = await UserModel.exists({ companyCode: otherCompany, [userField]: { $in: ids } }).setOptions({ session });
  if (sharedIntegration || sharedUserIntegration) {
    throw Object.assign(new Error(`Tài khoản ${platform} đang được ghi nhận ở nhiều doanh nghiệp. Hãy kiểm tra liên kết trước khi xóa dữ liệu chat.`), { statusCode: 409 });
  }
  return ids;
}

async function deleteChannelHistory({ conversations, messages, accountField }: ChatChannel, ids: string[], session?: ClientSession) {
  if (!ids.length) return { conversationCount: 0, messageCount: 0 };
  let conversationCount = 0;
  let messageCount = 0;
  const conversationFilter = { [accountField]: { $in: ids } };
  let after: Types.ObjectId | undefined;
  for (;;) {
    const records = await conversations.collection.find(
      { ...conversationFilter, ...(after && { _id: { $gt: after } }) },
      { session, projection: { _id: 1 }, sort: { _id: 1 }, limit: 500 },
    ).toArray();
    if (!records.length) break;
    const batch = records.map(record => record._id);
    messageCount += (await messages.collection.deleteMany({ conversationId: { $in: batch } }, { session })).deletedCount;
    conversationCount += (await conversations.collection.deleteMany({ ...conversationFilter, _id: { $in: batch } }, { session })).deletedCount;
    after = batch[batch.length - 1];
  }
  return { conversationCount, messageCount };
}

export async function resetCompanyChat(companyCode: string) {
  if (!companyCode.trim()) throw Object.assign(new Error("Không xác định được doanh nghiệp."), { statusCode: 403 });
  return runInTransaction(async session => {
    const accounts = new Map<ChatChannel["platform"], string[]>();
    for (const channel of channels) {
      accounts.set(channel.platform, await resolveChatAccounts(companyCode, channel, session));
    }
    const facebookIds = accounts.get("Facebook") ?? [];
    const zaloIds = accounts.get("Zalo") ?? [];
    const scope = { companyCode };
    const tests = await ChatTestSessionModel.find(scope).select("_id sandboxCompanyCode").setOptions({ session }).lean();
    const testIds = tests.map(test => test._id);
    const chatStateScope = { companyCode: { $in: [companyCode, ...tests.map(test => test.sandboxCompanyCode)] } };

    const background = { $or: [
      { kind: "facebook-webhook" as const, "payload.pageId": { $in: facebookIds } },
      { kind: "zalo-webhook" as const, "payload.oa_id": { $in: zaloIds } },
      { kind: { $in: ["lead-intake", "lead-contract-ocr"] as const }, "payload.companyCode": companyCode },
      { kind: "chat-test" as const, "payload.sessionId": { $in: testIds.map(String) } },
    ] };
    const autoReply = { $or: [
      scope,
      { companyCode: null, channel: { $in: ["facebook", null] as const }, pageId: { $in: facebookIds } },
      { companyCode: null, channel: "zalo" as const, pageId: { $in: zaloIds } },
    ] };
    const activeLease = { status: "processing" as const, leaseUntil: { $gt: new Date() } };
    async function checkActiveJobs() {
      if (await MessengerBackgroundJobModel.exists({ ...background, ...activeLease }).setOptions({ session })
        || await FacebookAutoReplyJobModel.exists({ ...autoReply, ...activeLease }).setOptions({ session })
        || await FacebookFollowUpJobModel.exists({ ...scope, ...activeLease }).setOptions({ session })) {
        throw Object.assign(new Error("Chatbot đang xử lý tin nhắn. Hãy đợi xử lý xong rồi thử xóa lại."), { statusCode: 409 });
      }
    }
    await checkActiveJobs();

    // Keep only the deduplication key so a retry of a discarded webhook cannot create the thread again.
    const inactive = { $nor: [activeLease] };
    await MessengerBackgroundJobModel.updateMany({ ...background, ...inactive }, {
      $set: { status: "completed", completedAt: new Date() },
      $unset: { payload: 1, leaseToken: 1, leaseUntil: 1, inboundCleanupAt: 1 },
    }, { session });
    await FacebookAutoReplyJobModel.deleteMany({ ...autoReply, ...inactive }, { session });
    await FacebookFollowUpJobModel.deleteMany({ ...scope, ...inactive }, { session });
    if (!session) await checkActiveJobs();

    let conversationCount = 0;
    let messageCount = 0;
    for (const channel of channels) {
      const deleted = await deleteChannelHistory(channel, accounts.get(channel.platform) ?? [], session);
      conversationCount += deleted.conversationCount;
      messageCount += deleted.messageCount;
    }
    const testMessages = await ChatTestMessageModel.deleteMany({ sessionId: { $in: testIds } }, { session });
    await ChatTestSessionModel.updateMany({ ...scope, _id: { $in: testIds } }, { $unset: { pendingMessageId: 1 } }, { session });
    await AIReplyLogModel.deleteMany({ ...chatStateScope, channel: { $in: ["facebook", "zalo", "tiktok", "test"] } }, { session });
    await ChatVisualMemoryModel.deleteMany(chatStateScope, { session });
    await PageChatFlowStateModel.deleteMany(chatStateScope, { session });
    await CakeCustomerMemoryModel.deleteMany(chatStateScope, { session });
    await CakeConsultationSessionModel.deleteMany(chatStateScope, { session });
    await CakeCheckoutModel.deleteMany({ ...chatStateScope, orderId: { $in: [null, ""] }, state: { $in: ["collecting", "awaiting_confirmation"] } }, { session });
    await TelecomInvoiceConversationModel.deleteMany(chatStateScope, { session });
    await TelecomInvoiceModel.deleteMany({ ...chatStateScope, status: "pending" }, { session });
    return { conversationCount, messageCount: messageCount + testMessages.deletedCount };
  });
}
