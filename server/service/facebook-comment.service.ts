import { resolveAutoReplyOwner } from "./ai-auto-reply.service";
import { aiKnowledgeService } from "./ai-knowledge.service";
import { geminiService } from "./gemini.service";
import { fbMessengerService } from "./fb-messenger.service";
import { AIReplyLogModel } from "../model/ai-reply-log.model";

export const facebookCommentService = {
  /**
   * Xử lý bình luận mới từ Facebook Webhook và tự động trả lời bằng AI
   */
  async handleIncomingComment(pageId: string, commentData: any) {
    let companyCode = "SYSTEM";
    let commentId = "";
    let postId = "";
    let messageText = "";
    let replyText = "";
    let effectiveRagContext: any = { contextText: "", matches: 0 };
    let aiConfig: any = null;
    const startedAt = Date.now();

    try {
      const {
        sender_id: senderId,
        comment_id: commentIdVal,
        post_id: postIdVal,
        verb,
        message,
      } = commentData;

      commentId = commentIdVal;
      postId = postIdVal;
      messageText = message;

      if (verb !== "add") {
        console.log(`[FB Comment Webhook] Bỏ qua hành động bình luận "${verb}" cho comment ID ${commentId}`);
        return;
      }

      // Tránh lặp vô hạn nếu Page tự trả lời chính mình
      const cleanSenderId = String(senderId || "").trim();
      const cleanPageId = String(pageId || "").trim();
      if (cleanSenderId === cleanPageId) {
        console.log(`[FB Comment Webhook] Bỏ qua bình luận từ chính Fanpage ID ${cleanPageId}`);
        return;
      }

      if (!message || !String(message).trim()) {
        console.log(`[FB Comment Webhook] Bỏ qua bình luận không có nội dung chữ cho comment ID ${commentId}`);
        return;
      }

      console.log(`[FB Comment Webhook] Nhận bình luận mới: pageId=${pageId}, commentId=${commentId}, message="${message}"`);

      // Xác định Owner và kiểm tra cấu hình AI Auto-Reply
      const ownerInfo = await resolveAutoReplyOwner("facebook", pageId);
      companyCode = ownerInfo.companyCode;
      const selectedUser = ownerInfo.selectedUser;
      aiConfig = ownerInfo.aiConfig;

      if (!selectedUser || !aiConfig || !aiConfig.enabled) {
        console.log(`[FB Comment Webhook] Tự động trả lời AI đang tắt hoặc không tìm thấy cấu hình cho Fanpage ID ${pageId}`);
        return;
      }

      // Kiểm tra xem cấu hình tự động trả lời bình luận có được bật riêng không
      if (!aiConfig.commentReplyEnabled) {
        console.log(`[FB Comment Webhook] Tự động trả lời bình luận đang TẮT (commentReplyEnabled=false) cho user ${selectedUser.email}`);
        return;
      }

      // Truy xuất ngữ cảnh RAG
      const ragContext = await aiKnowledgeService.searchRelevantContext({
        companyCode,
        query: message,
        channel: "facebook",
        topK: 5,
      });

      effectiveRagContext = aiKnowledgeService.buildEffectiveRagContext({
        companyCode,
        ragContext,
        trainingKnowledge: aiConfig.trainingKnowledge,
      });

      // Gọi Gemini sinh câu trả lời
      const history: any[] = []; // Bình luận thường độc lập, không cần gửi lịch sử chat trước đó
      const aiResponse = await geminiService.chat(message, history, aiConfig, effectiveRagContext);

      if (!aiResponse || !aiResponse.text) {
        console.error(`[FB Comment Webhook] Không nhận được nội dung trả lời từ Gemini cho comment ID ${commentId}`);
        await AIReplyLogModel.create({
          companyCode,
          channel: "facebook_comment",
          commentId,
          postId,
          customerMessage: message,
          aiResponse: "[FAILED] Không nhận được nội dung trả lời từ Gemini",
          contextPreview: effectiveRagContext.contextText || "",
          contextMatches: effectiveRagContext.matches || 0,
          mode: aiConfig.trainingKnowledge ? "trained" : "default",
          latencyMs: Date.now() - startedAt,
          status: "failed",
        });
        return;
      }

      replyText = aiResponse.text.trim();
      console.log(`[FB Comment Webhook] Đã sinh câu trả lời: "${replyText}"`);

      // Kiểm tra comment giả lập
      const isMockComment = commentId.startsWith("mock_") || commentId.includes("mock_") || commentId.includes("mock-") || commentId === "mock_comment";
      if (isMockComment) {
        console.log(`[FB Comment Webhook] Giả lập phản hồi thành công (Bỏ qua Graph API thực tế cho comment giả lập ID: ${commentId})`);
        await AIReplyLogModel.create({
          companyCode,
          channel: "facebook_comment",
          commentId,
          postId,
          customerMessage: message,
          aiResponse: replyText,
          contextPreview: effectiveRagContext.contextText || "",
          contextMatches: effectiveRagContext.matches || 0,
          mode: aiConfig.trainingKnowledge ? "trained" : "default",
          latencyMs: Date.now() - startedAt,
          status: "sent",
        });
        return;
      }

      // Lấy page access token tương ứng
      const token = await fbMessengerService.getPageAccessTokenByPageId(pageId);
      if (!token) {
        throw new Error(`Không tìm thấy Access Token cho Fanpage ID: ${pageId}`);
      }

      // Đăng câu trả lời lên Graph API của Facebook
      const url = `https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${token}`;
      const response = await (globalThis as any).fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Facebook Graph API trả về lỗi: ${response.status} - ${errText}`);
      }

      const resultData = await response.json();
      console.log(`[FB Comment Webhook] Đã trả lời bình luận thành công, Graph Comment ID: ${resultData.id}`);

      // Ghi nhận log thành công
      await AIReplyLogModel.create({
        companyCode,
        channel: "facebook_comment",
        commentId,
        postId,
        customerMessage: message,
        aiResponse: replyText,
        contextPreview: effectiveRagContext.contextText || "",
        contextMatches: effectiveRagContext.matches || 0,
        mode: aiConfig.trainingKnowledge ? "trained" : "default",
        latencyMs: Date.now() - startedAt,
        status: "sent",
      });
    } catch (error: any) {
      console.error("[FB Comment Webhook] Lỗi khi xử lý trả lời bình luận:", error.message || error);
      
      // Gửi cảnh báo mất kết nối nếu do lỗi Token
      const errorStr = error.message || String(error);
      if (errorStr.includes("token") || errorStr.includes("190") || errorStr.includes("102") || errorStr.includes("OAuth")) {
        try {
          const { SocialIntegrationModel } = require("../model/social-integration.model");
          const integration = await SocialIntegrationModel.findOne({
            platform: "Facebook",
            username: pageId,
          });
          const { telegramService } = require("./telegram.service");
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
          contextPreview: effectiveRagContext.contextText || "",
          contextMatches: effectiveRagContext.matches || 0,
          mode: aiConfig ? (aiConfig.trainingKnowledge ? "trained" : "default") : "default",
          latencyMs: Date.now() - startedAt,
          status: "failed",
        }).catch((logErr) => {
          console.error("[FB Comment Webhook] Không thể ghi nhận log lỗi vào database:", logErr.message || logErr);
        });
      }
    }
  }
};
