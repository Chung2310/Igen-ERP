/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty, prefer-const */
import { ensureFacebookAutoReplyEnabled, resolveAutoReplyOwner } from "./ai-auto-reply.service.ts";
import { aiKnowledgeService } from "../../knowledge/service/ai-knowledge.service.ts";
import { geminiService } from "../../shared/service/gemini.service.ts";
import { fbMessengerService } from "./fb-messenger.service.ts";
import { AIReplyLogModel } from "../model/ai-reply-log.model.ts";
import { FacebookCommentDeliveryModel } from "../model/facebook-comment-delivery.model";
import { randomUUID } from "node:crypto";

const processingComments = new Set<string>();

export const facebookCommentService = {
  /**
   * Xử lý bình luận mới từ Facebook Webhook và tự động trả lời bằng AI
   */
  async handleIncomingComment(pageId: string, commentData: any) {
    let companyCode = "";
    let commentId = "";
    let postId = "";
    let messageText = "";
    let replyText = "";
    let effectiveRagContext: any = { contextText: "", matches: 0 };
    let aiConfig: any = null;
    const startedAt = Date.now();
    let ownsLocalLock = false;
    let deliveryLockId = "";
    let deliveryStarted = false;
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
        const existingLog = await AIReplyLogModel.findOne({ commentId: commentIdVal });
        if (existingLog) {
          return;
        }

      }

      console.log(`[FB Comment Webhook] Nhận bình luận mới: pageId=${pageId}, commentId=${commentId}, message="${message}"`);

      // Xác định Owner và kiểm tra cấu hình AI Auto-Reply
      const ownerInfo = await ensureFacebookAutoReplyEnabled(
        await resolveAutoReplyOwner("facebook", pageId)
      );
      companyCode = ownerInfo.companyCode;
      aiConfig = ownerInfo.aiConfig;

      if (!companyCode || !aiConfig) {
        return;
      }

      // Kiểm tra xem cấu hình tự động trả lời bình luận có được bật riêng không
      if (!aiConfig.enabled || !aiConfig.commentReplyEnabled) {
        return;
      }

      const proposedLockId = randomUUID();
      try {
        await FacebookCommentDeliveryModel.init();
        const claimed = await FacebookCommentDeliveryModel.findOneAndUpdate(
          { companyCode, pageId, commentId,
            $or: [{ status: "failed" }, { status: "processing", lockExpiresAt: { $lte: new Date() } }] },
          { $set: { status: "processing", lockId: proposedLockId, lockExpiresAt: new Date(Date.now() + 5 * 60_000) } },
          { upsert: true, returnDocument: "after" },
        );
        if (!claimed) return;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return;
        throw error;
      }
      deliveryLockId = proposedLockId;
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
      const aiResponse = await geminiService.chatComment(message, aiConfig, effectiveRagContext);

      if (!aiResponse || (!aiResponse.publicComment && !(aiResponse as any).text)) {
        await FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId: deliveryLockId },
          { $set: { status: "failed" }, $unset: { lockId: 1, lockExpiresAt: 1 } },
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

      deliveryStarted = true;
      const sending = await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId: deliveryLockId, status: "processing", lockExpiresAt: { $gt: new Date() } },
        { $set: { status: "sending" } },
      );
      if (sending.modifiedCount !== 1) { deliveryStarted = false; return; }

      // 1. Đăng câu trả lời công khai lên Graph API của Facebook
      const commentUrl = `https://graph.facebook.com/v25.0/${commentId}/comments?access_token=${token}`;
      const commentResponse = await (globalThis as any).fetch(commentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: publicComment }),
      });

      if (!commentResponse.ok) {
        const errText = await commentResponse.text();
        throw new Error(`Facebook Graph API (Comment Reply) trả về lỗi: ${commentResponse.status} - ${errText}`);
      }

      const commentResult = await commentResponse.json();
      await FacebookCommentDeliveryModel.updateOne(
        { companyCode, pageId, commentId, lockId: deliveryLockId },
        { $set: { publicReplyId: commentResult.id } },
      );
      console.log(`[FB Comment Webhook] Đã trả lời bình luận thành công, Graph Comment ID: ${commentResult.id}`);

      // 2. Gửi tin nhắn inbox riêng tư cho khách hàng (nếu có)
      let inboxSuccessStatus = "";
      let isInboxFailed = false;
      if (privateInbox) {
        try {
          const inboxUrl = `https://graph.facebook.com/v25.0/me/messages?access_token=${token}`;
          const inboxResponse = await (globalThis as any).fetch(inboxUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { comment_id: commentId },
              message: { text: privateInbox }
            }),
          });

          if (!inboxResponse.ok) {
            isInboxFailed = true;
            const errText = await inboxResponse.text();
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
            console.log(`[FB Comment Webhook] Đã gửi inbox riêng tư thành công, Message ID: ${inboxResult.message_id}`);
            inboxSuccessStatus = " | [Inbox Thành công]";
          }
        } catch (inboxErr: any) {
          isInboxFailed = true;
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
        { $set: { status: "sent" }, $unset: { lockId: 1, lockExpiresAt: 1 } },
      );
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
      if (deliveryLockId) {
        await FacebookCommentDeliveryModel.updateOne(
          { companyCode, pageId, commentId, lockId: deliveryLockId },
          { $set: { status: deliveryStarted ? "unknown" : "failed" }, $unset: { lockId: 1, lockExpiresAt: 1 } },
        ).catch(() => undefined);
      }
      console.error("[FB Comment Webhook] Lỗi khi xử lý trả lời bình luận:", error.message || error);
      
      // Gửi cảnh báo mất kết nối nếu do lỗi Token
      const errorStr = error.message || String(error);
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
