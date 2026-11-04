/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty, prefer-const */
import { resolveAutoReplyOwner } from "./ai-auto-reply.service.ts";
import { aiKnowledgeService } from "../../knowledge/service/ai-knowledge.service.ts";
import { geminiService } from "../../shared/service/gemini.service.ts";
import { fbMessengerService } from "./fb-messenger.service.ts";
import { AIReplyLogModel } from "../model/ai-reply-log.model.ts";
import { FacebookCommentDeliveryModel } from "../model/facebook-comment-delivery.model";
import { randomUUID } from "node:crypto";
import { withAiUsage } from "../../shared/service/ai-subscription.service";

const processingComments = new Set<string>();
const MAX_PUBLIC_ATTEMPTS = 5;
const MAX_PRIVATE_ATTEMPTS = 3;
const COMMENT_LOCK_MS = 5 * 60_000;
let commentWorkerRunning = false;
let commentWorkerTimer: ReturnType<typeof setInterval> | undefined;

function retryDelayMs(attempt: number) {
  return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000);
}

export const facebookCommentService = {
  async enqueueIncomingComment(pageId: string, commentData: any) {
    const senderId = String(commentData?.from?.id || commentData?.sender_id || "").trim();
    const normalizedPageId = String(pageId || "").trim();
    const commentId = String(commentData?.comment_id || "").trim();
    const commentText = String(commentData?.message || "").trim();
    if (commentData?.verb !== "add" || !normalizedPageId || !commentId || !commentText || senderId === normalizedPageId) return;

    const ownerInfo = await resolveAutoReplyOwner("facebook", normalizedPageId);
    if (!ownerInfo.companyCode || !ownerInfo.aiConfig?.enabled || !ownerInfo.aiConfig?.commentReplyEnabled) return;

    await FacebookCommentDeliveryModel.init();
    try {
      await FacebookCommentDeliveryModel.updateOne(
        { companyCode: ownerInfo.companyCode, pageId: normalizedPageId, commentId },
        { $setOnInsert: {
          companyCode: ownerInfo.companyCode,
          pageId: normalizedPageId,
          commentId,
          status: "pending",
          commentText,
          senderId,
          postId: String(commentData?.post_id || ""),
          attemptCount: 0,
          nextAttemptAt: new Date(),
          privateReplyStatus: "none",
          privateReplyAttempts: 0,
          privateReplyRetryable: false,
        } },
        { upsert: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  },

  startWorker() {
    if (commentWorkerTimer) return;
    void this.processPendingComments();
    commentWorkerTimer = setInterval(() => void this.processPendingComments(), 5_000);
    commentWorkerTimer.unref();
  },

  async processPendingComments() {
    if (commentWorkerRunning) return;
    commentWorkerRunning = true;
    try {
      await FacebookCommentDeliveryModel.init();
      while (true) {
        const now = new Date();
        const lockId = randomUUID();
        const claimed = await FacebookCommentDeliveryModel.findOneAndUpdate(
          { $or: [
            { status: "pending", nextAttemptAt: { $lte: now } },
            { status: "failed", attemptCount: { $lt: MAX_PUBLIC_ATTEMPTS }, nextAttemptAt: { $lte: now } },
            { status: "private_failed", privateReplyRetryable: true, privateReplyAttempts: { $lt: MAX_PRIVATE_ATTEMPTS }, nextAttemptAt: { $lte: now } },
            { status: "processing", lockExpiresAt: { $lte: now }, attemptCount: { $lt: MAX_PUBLIC_ATTEMPTS } },
          ] },
          { $set: { status: "processing", lockId, lockExpiresAt: new Date(Date.now() + COMMENT_LOCK_MS) }, $inc: { attemptCount: 1 }, $unset: { nextAttemptAt: 1 } },
          { sort: { createdAt: 1 }, returnDocument: "after" },
        );
        if (!claimed) break;

        const claimedData = claimed.toObject ? claimed.toObject() : claimed;
        if (claimedData.publicReplyStatus === "sent" && claimedData.privateReplyText && claimedData.privateReplyRetryable) {
          await this.retryPrivateReply(claimedData);
          continue;
        }

        await this.handleIncomingComment(String(claimedData.pageId), {
          verb: "add",
          comment_id: claimedData.commentId,
          post_id: claimedData.postId,
          message: claimedData.commentText,
          from: { id: claimedData.senderId },
        }, claimedData);
      }
    } catch (error) {
      console.error("[FB Comment Worker] Lỗi khi xử lý hàng đợi comment:", (error as Error)?.message || error);
    } finally {
      commentWorkerRunning = false;
    }
  },

  async retryPrivateReply(delivery: any) {
    const { companyCode, pageId, commentId, lockId } = delivery;
    let requestStarted = false;
    const attempt = Number(delivery.privateReplyAttempts || 0) + 1;
    try {
      const counted = await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId, status: "processing" },
        { $inc: { privateReplyAttempts: 1 } },
      );
      if (counted.modifiedCount !== 1) return;
      const token = await fbMessengerService.getPageAccessTokenByPageId(pageId);
      if (!token) throw new Error(`Không tìm thấy Access Token cho Fanpage ID: ${pageId}`);
      const sending = await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId, status: "processing" },
        { $set: { status: "sending", privateReplyStatus: "sending" } },
      );
      if (sending.modifiedCount !== 1) return;
      requestStarted = true;
      const response = await (globalThis as any).fetch(`https://graph.facebook.com/v25.0/me/messages?access_token=${token}`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: delivery.privateReplyText } }),
      });
      if (response.ok) {
        const result = await response.json();
        await FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId },
          { $set: { status: "sent", privateReplyStatus: "sent", privateReplyRetryable: false }, $unset: { lockId: 1, lockExpiresAt: 1, nextAttemptAt: 1 } },
        );
        await AIReplyLogModel.updateOne(
          { companyCode, channel: "facebook_comment", commentId },
          { $set: {
            status: "sent",
            aiResponse: `[Bình luận] ${delivery.publicReplyText}\n[Inbox] ${delivery.privateReplyText} | [Inbox retry thành công]`,
          } },
        );
        console.log(`[FB Comment Worker] Đã retry inbox cho comment ${commentId}, messageId=${result.message_id || "unknown"}`);
        return;
      }

      const errorText = await response.text();
      const retryable = response.status === 429 || response.status >= 500;
      const canRetry = retryable && attempt < MAX_PRIVATE_ATTEMPTS;
      const nextAttemptAt = canRetry ? new Date(Date.now() + retryDelayMs(attempt)) : undefined;
      await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId },
        { $set: {
          status: canRetry ? "private_failed" : "sent",
          privateReplyStatus: "failed",
          privateReplyRetryable: canRetry,
          lastError: `Facebook Graph API private reply ${response.status}: ${errorText.slice(0, 500)}`,
          ...(nextAttemptAt ? { nextAttemptAt } : {}),
        }, $unset: { lockId: 1, lockExpiresAt: 1, ...(!nextAttemptAt ? { nextAttemptAt: 1 } : {}) } },
      );
    } catch (error) {
      const retryableBeforeRequest = !requestStarted && attempt < MAX_PRIVATE_ATTEMPTS;
      const nextAttemptAt = retryableBeforeRequest ? new Date(Date.now() + retryDelayMs(Math.max(1, attempt))) : undefined;
      await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId },
        { $set: {
          status: requestStarted ? "unknown" : retryableBeforeRequest ? "private_failed" : "sent",
          privateReplyStatus: requestStarted ? "unknown" : "failed",
          privateReplyRetryable: retryableBeforeRequest,
          ...(nextAttemptAt ? { nextAttemptAt } : {}),
          lastError: String((error as Error)?.message || error).slice(0, 500),
        }, $unset: { lockId: 1, lockExpiresAt: 1, ...(!nextAttemptAt ? { nextAttemptAt: 1 } : {}) } },
      ).catch(() => undefined);
    }
  },

  /**
   * Xử lý bình luận mới từ Facebook Webhook và tự động trả lời bằng AI
   */
  async handleIncomingComment(pageId: string, commentData: any, claimedDelivery?: any) {
    let companyCode = "";
    let commentId = "";
    let postId = "";
    let messageText = "";
    let replyText = "";
    let effectiveRagContext: any = { contextText: "", matches: 0 };
    let aiConfig: any = null;
    const startedAt = Date.now();
    let ownsLocalLock = false;
    let deliveryLockId = String(claimedDelivery?.lockId || "");
    let deliveryStarted = false;
    let deliveryAttemptCount = Number(claimedDelivery?.attemptCount || 0);
    let deliveryFinalized = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    try {
      const senderId = commentData.from?.id || commentData.sender_id;
      const {
        comment_id: commentIdVal,
        post_id: postIdVal,
        verb,
        message,
      } = commentData;

      commentId = commentIdVal;
      postId = postIdVal;
      messageText = message;

      if (verb !== "add") {
        return;
      }

      // Tránh lặp vô hạn nếu Page tự trả lời chính mình
      const cleanSenderId = String(senderId || "").trim();
      const cleanPageId = String(pageId || "").trim();
      if (cleanSenderId === cleanPageId) {
        return;
      }

      if (!commentIdVal || !message || !String(message).trim()) {
        return;
      }

      // Tránh xử lý trùng lặp nếu bình luận này đã được phản hồi trước đó
      if (commentIdVal) {
        if (processingComments.has(commentIdVal)) {
          console.log(`[FB Comment Webhook] Bình luận ${commentIdVal} đang được xử lý, bỏ qua.`);
          return;
        }

        processingComments.add(commentIdVal);
        ownsLocalLock = true;
      }

      console.log(`[FB Comment Webhook] Nhận bình luận mới: pageId=${pageId}, commentId=${commentId}, message="${message}"`);

      // Xác định Owner và kiểm tra cấu hình AI Auto-Reply
      const ownerInfo = await resolveAutoReplyOwner("facebook", pageId);
      companyCode = ownerInfo.companyCode;
      aiConfig = ownerInfo.aiConfig;

      if (!companyCode || !aiConfig) {
        if (deliveryLockId) await FacebookCommentDeliveryModel.updateOne(
          { companyCode: claimedDelivery.companyCode, pageId, commentId, lockId: deliveryLockId },
          { $set: { status: "skipped", lastError: "Facebook comment auto-reply is not configured." }, $unset: { lockId: 1, lockExpiresAt: 1 } },
        );
        return;
      }

      // Kiểm tra xem cấu hình tự động trả lời bình luận có được bật riêng không
      if (!aiConfig.enabled || !aiConfig.commentReplyEnabled) {
        if (deliveryLockId) await FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId: deliveryLockId },
          { $set: { status: "skipped", lastError: "Facebook comment auto-reply is disabled." }, $unset: { lockId: 1, lockExpiresAt: 1 } },
        );
        return;
      }

      // Failed pre-send attempts may be retried. The durable delivery claim below
      // still blocks sent/sending/unknown outcomes, including a failed private reply.
      if (await AIReplyLogModel.findOne({ companyCode, channel: "facebook_comment", commentId, status: "sent" })) {
        if (deliveryLockId) await FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId: deliveryLockId },
          { $set: { status: "sent" }, $unset: { lockId: 1, lockExpiresAt: 1, nextAttemptAt: 1 } },
        );
        return;
      }

      if (!deliveryLockId) {
        const proposedLockId = randomUUID();
        try {
          await FacebookCommentDeliveryModel.init();
          const claimed = await FacebookCommentDeliveryModel.findOneAndUpdate(
            { companyCode, pageId, commentId,
              $or: [{ status: "pending" }, { status: "failed" }, { status: "processing", lockExpiresAt: { $lte: new Date() } }] },
            { $set: { status: "processing", lockId: proposedLockId, lockExpiresAt: new Date(Date.now() + COMMENT_LOCK_MS) }, $inc: { attemptCount: 1 } },
            { upsert: true, returnDocument: "after" },
          );
          if (!claimed) return;
          deliveryAttemptCount = Number(claimed.attemptCount || 1);
        } catch (error) {
          if ((error as { code?: number }).code === 11000) return;
          throw error;
        }
        deliveryLockId = proposedLockId;
      }
      heartbeat = setInterval(() => {
        void FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId: deliveryLockId, status: "processing" },
          { $set: { lockExpiresAt: new Date(Date.now() + 5 * 60_000) } },
        ).catch(error => console.error("[FB Comment lease]", error));
      }, 30_000);
      heartbeat.unref();

      // Truy xuất ngữ cảnh RAG
      const [ragContext, scenarioContext] = await Promise.all([
        aiKnowledgeService.searchRelevantContext({
          companyCode,
          query: message,
          channel: "facebook",
          pageId,
          topK: 5,
        }),
        aiKnowledgeService.searchScenarioContext({
          companyCode,
          query: message,
          channel: "facebook",
          pageId,
          topK: 5,
        }),
      ]);

      effectiveRagContext = aiKnowledgeService.buildEffectiveRagContext({
        companyCode,
        ragContext,
        scenarioContext,
        trainingKnowledge: aiConfig.trainingKnowledge,
      });

      // Gọi Gemini sinh câu trả lời dành riêng cho comment (bao gồm comment công khai và inbox riêng tư)
      const aiResponse = await withAiUsage({ companyCode }, () => geminiService.chatComment(message, aiConfig, effectiveRagContext));

      if (!aiResponse || (!aiResponse.publicComment && !(aiResponse as any).text)) {
        const canRetry = deliveryAttemptCount < MAX_PUBLIC_ATTEMPTS;
        await FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId: deliveryLockId },
          { $set: { status: "failed", lastError: "Gemini returned no comment reply.", ...(canRetry ? { nextAttemptAt: new Date(Date.now() + retryDelayMs(deliveryAttemptCount)) } : {}) }, $unset: { lockId: 1, lockExpiresAt: 1, ...(!canRetry ? { nextAttemptAt: 1 } : {}) } },
        );
        console.error(`[FB Comment Webhook] Không nhận được nội dung trả lời từ Gemini cho comment ID ${commentId}`);
        await AIReplyLogModel.create({
          companyCode,
          channel: "facebook_comment",
          commentId,
          postId,
          customerMessage: message,
          aiResponse: "[FAILED] Không nhận được nội dung trả lời từ Gemini",
          contextPreview: [effectiveRagContext.contextText, effectiveRagContext.scenarioContextText].filter(Boolean).join("\n\n"),
          contextMatches: effectiveRagContext.matches || 0,
          mode: aiConfig.trainingKnowledge || effectiveRagContext.scenarioContextText ? "trained" : "default",
          latencyMs: Date.now() - startedAt,
          status: "failed",
        });
        return;
      }

      const publicComment = (aiResponse.publicComment || (aiResponse as any).text || "").trim();
      const privateInbox = (aiResponse.privateInbox || "").trim();

      console.log(`[FB Comment Webhook] Đã sinh câu trả lời công khai: "${publicComment}"`);
      if (privateInbox) {
        console.log(`[FB Comment Webhook] Đã sinh tin nhắn inbox riêng tư: "${privateInbox}"`);
      }

      // Lấy page access token tương ứng
      const token = await fbMessengerService.getPageAccessTokenByPageId(pageId);
      if (!token) {
        throw new Error(`Không tìm thấy Access Token cho Fanpage ID: ${pageId}`);
      }

      const sending = await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId: deliveryLockId, status: "processing", lockExpiresAt: { $gt: new Date() } },
        { $set: { status: "sending", publicReplyStatus: "sending", publicReplyText: publicComment, privateReplyText: privateInbox, privateReplyStatus: privateInbox ? "pending" : "none", privateReplyRetryable: false } },
      );
      if (sending.modifiedCount !== 1) { deliveryStarted = false; return; }
      deliveryStarted = true;

      // 1. Đăng câu trả lời công khai lên Graph API của Facebook
      const commentUrl = `https://graph.facebook.com/v25.0/${commentId}/comments?access_token=${token}`;
      const commentResponse = await (globalThis as any).fetch(commentUrl, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: publicComment }),
      });

      if (!commentResponse.ok) {
        deliveryStarted = false;
        const errText = await commentResponse.text();
        throw new Error(`Facebook Graph API (Comment Reply) trả về lỗi: ${commentResponse.status} - ${errText}`);
      }

      const commentResult = await commentResponse.json();
      await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId: deliveryLockId },
        { $set: { publicReplyStatus: "sent", ...(commentResult.id ? { publicReplyId: commentResult.id } : {}) } },
      );
      console.log(`[FB Comment Webhook] Đã trả lời bình luận thành công, Graph Comment ID: ${commentResult.id}`);

      // 2. Gửi tin nhắn inbox riêng tư cho khách hàng (nếu có)
      let inboxSuccessStatus = "";
      let isInboxFailed = false;
      let privateRetryQueued = false;
      let privateOutcomeUnknown = false;
      let privateReplyError = "";
      let privateRetryAt: Date | undefined;
      if (privateInbox) {
        let privateRequestStarted = false;
        const privateAttempt = Number(claimedDelivery?.privateReplyAttempts || 0) + 1;
        try {
          const privateSending = await FacebookCommentDeliveryModel.updateOne(
            { companyCode, pageId, commentId, lockId: deliveryLockId, status: "sending" },
            { $set: { privateReplyStatus: "sending" }, $inc: { privateReplyAttempts: 1 } },
          );
          if (privateSending.modifiedCount !== 1) throw new Error("Lost the comment delivery lock before private reply.");
          const inboxUrl = `https://graph.facebook.com/v25.0/me/messages?access_token=${token}`;
          privateRequestStarted = true;
          const inboxResponse = await (globalThis as any).fetch(inboxUrl, {
            method: "POST",
            signal: AbortSignal.timeout(20_000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { comment_id: commentId },
              message: { text: privateInbox }
            }),
          });

          if (!inboxResponse.ok) {
            isInboxFailed = true;
            const errText = await inboxResponse.text();
            const retryable = inboxResponse.status === 429 || inboxResponse.status >= 500;
            privateRetryQueued = retryable && privateAttempt < MAX_PRIVATE_ATTEMPTS;
            privateRetryAt = privateRetryQueued ? new Date(Date.now() + retryDelayMs(privateAttempt)) : undefined;
            privateReplyError = `Facebook Graph API private reply ${inboxResponse.status}: ${errText.slice(0, 500)}`;
            let parsedError = errText;
            try {
              const errJson = JSON.parse(errText);
              if (errJson.error?.message) {
                parsedError = `(Mã ${errJson.error.code || "N/A"}) ${errJson.error.message}`;
              }
            } catch (e) {}
            console.error(`[FB Comment Webhook] Không thể gửi inbox riêng tư: ${inboxResponse.status} - ${errText}`);
            inboxSuccessStatus = ` | [Inbox Thất bại: ${parsedError}]`;
          } else {
            const inboxResult = await inboxResponse.json();
            await FacebookCommentDeliveryModel.updateOne(
              { companyCode, pageId, commentId, lockId: deliveryLockId },
              { $set: { privateReplyStatus: "sent", privateReplyRetryable: false }, $unset: { lastError: 1, nextAttemptAt: 1 } },
            );
            console.log(`[FB Comment Webhook] Đã gửi inbox riêng tư thành công, Message ID: ${inboxResult.message_id}`);
            inboxSuccessStatus = " | [Inbox Thành công]";
          }
        } catch (inboxErr: any) {
          isInboxFailed = true;
          privateReplyError = String(inboxErr.message || inboxErr).slice(0, 500);
          if (privateRequestStarted) {
            privateOutcomeUnknown = true;
          } else {
            privateRetryQueued = privateAttempt < MAX_PRIVATE_ATTEMPTS;
            privateRetryAt = privateRetryQueued ? new Date(Date.now() + retryDelayMs(privateAttempt)) : undefined;
          }
          console.error(`[FB Comment Webhook] Lỗi khi gọi API gửi inbox riêng tư:`, inboxErr.message || inboxErr);
          inboxSuccessStatus = ` | [Inbox Lỗi: ${inboxErr.message || inboxErr}]`;
        }
      }

      const combinedLogResponse = privateInbox
        ? `[Bình luận] ${publicComment}\n[Inbox] ${privateInbox}${inboxSuccessStatus}`
        : publicComment;

      // Ghi nhận log
      await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId: deliveryLockId },
        { $set: {
          status: privateOutcomeUnknown ? "unknown" : privateRetryQueued ? "private_failed" : "sent",
          privateReplyStatus: privateInbox ? (privateOutcomeUnknown ? "unknown" : isInboxFailed ? "failed" : "sent") : "none",
          privateReplyRetryable: privateRetryQueued,
          ...(privateRetryAt ? { nextAttemptAt: privateRetryAt } : {}),
          ...(privateReplyError ? { lastError: privateReplyError } : {}),
        }, $unset: { lockId: 1, lockExpiresAt: 1, ...(!privateRetryAt ? { nextAttemptAt: 1 } : {}) } },
      );
      deliveryFinalized = true;
      await AIReplyLogModel.create({
        companyCode,
        channel: "facebook_comment",
        commentId,
        postId,
        customerMessage: message,
        aiResponse: combinedLogResponse,
        contextPreview: [effectiveRagContext.contextText, effectiveRagContext.scenarioContextText].filter(Boolean).join("\n\n"),
        contextMatches: effectiveRagContext.matches || 0,
        mode: aiConfig.trainingKnowledge || effectiveRagContext.scenarioContextText ? "trained" : "default",
        latencyMs: Date.now() - startedAt,
        status: isInboxFailed ? "failed" : "sent",
      });
    } catch (error: any) {
      const errorStr = error.message || String(error);
      const graphStatus = errorStr.match(/Graph API \(Comment Reply\).*?: (\d{3})/i)?.[1];
      const retryableGraphFailure = !graphStatus || Number(graphStatus) === 429 || Number(graphStatus) >= 500;
      const canRetry = !deliveryStarted && retryableGraphFailure && deliveryAttemptCount < MAX_PUBLIC_ATTEMPTS;
      if (deliveryLockId && !deliveryFinalized) {
        await FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId: deliveryLockId },
          { $set: {
            status: deliveryStarted ? "unknown" : "failed",
            publicReplyStatus: deliveryStarted ? "unknown" : "pending",
            lastError: errorStr.slice(0, 500),
            ...(canRetry ? { nextAttemptAt: new Date(Date.now() + retryDelayMs(deliveryAttemptCount)) } : {}),
          }, $unset: { lockId: 1, lockExpiresAt: 1, ...(!canRetry ? { nextAttemptAt: 1 } : {}) } },
        ).catch(() => undefined);
      }
      console.error("[FB Comment Webhook] Lỗi khi xử lý trả lời bình luận:", error.message || error);
      
      // Gửi cảnh báo mất kết nối nếu do lỗi Token
      if (errorStr.includes("token") || errorStr.includes("190") || errorStr.includes("102") || errorStr.includes("OAuth")) {
        try {
          const { SocialIntegrationModel } = await import("../../shared/model/social-integration.model.ts");
          const integration = await SocialIntegrationModel.findOne({
            platform: "Facebook",
            username: pageId,
          });
          const { telegramService } = await import("../../shared/service/telegram.service.ts");
          await telegramService.sendIntegrationDisconnectAlert(
            "Facebook",
            integration?.displayName || "Facebook Page",
            pageId,
            companyCode,
            `Lỗi Token khi trả lời bình luận: ${errorStr.slice(0, 150)}`
          ).catch((e: any) => console.error("[FB Comment Webhook] Không thể gửi cảnh báo lỗi Token về Telegram:", e));
        } catch (tgErr) {
          console.error("[FB Comment Webhook] Lỗi khi require/gửi cảnh báo Token:", tgErr);
        }
      }

      // Ghi nhận log thất bại
      if (commentId) {
        await AIReplyLogModel.create({
          companyCode,
          channel: "facebook_comment",
          commentId,
          postId,
          customerMessage: messageText,
          aiResponse: `[FAILED] ${replyText || "[Không có phản hồi AI]"}\n\nError: ${error.message || error}`,
          contextPreview: [effectiveRagContext.contextText, effectiveRagContext.scenarioContextText].filter(Boolean).join("\n\n"),
          contextMatches: effectiveRagContext.matches || 0,
          mode: aiConfig ? (aiConfig.trainingKnowledge ? "trained" : "default") : "default",
          latencyMs: Date.now() - startedAt,
          status: "failed",
        }).catch((logErr) => {
          console.error("[FB Comment Webhook] Không thể ghi nhận log lỗi vào database:", logErr.message || logErr);
        });
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (commentId && ownsLocalLock) {
        processingComments.delete(commentId);
      }
    }
  }
};
