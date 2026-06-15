import { UserModel } from "../model/user.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { geminiService } from "./gemini.service";
import { zaloMessengerService } from "./zalo-messenger.service";
import { fbMessengerService } from "./fb-messenger.service";
import { aiKnowledgeService } from "./ai-knowledge.service";

// In-memory timeouts map to manage debouncing per conversation.
// messageKey prevents polling/sync from pushing the same inbound message forever.
const pendingReplies = new Map<string, { timeout: NodeJS.Timeout; messageKey: string }>();

export const aiAutoReplyService = {
  /**
   * Cancel any pending AI auto-reply for a conversation (e.g. when an agent replies manually)
   */
  cancelPendingReply(conversationId: string) {
    const pending = pendingReplies.get(conversationId);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingReplies.delete(conversationId);
      console.log(`[AI AutoReply] Đã hủy phản hồi tự động đang lên lịch cho cuộc hội thoại: ${conversationId} do có sự can thiệp từ nhân viên.`);
    }
  },

  /**
   * Triggers the AI auto-reply process. Debounces incoming messages to wait for the customer to finish typing.
   */
  async triggerAutoReply(channel: "facebook" | "zalo", platformId: string, conversationId: string, incomingText: string, incomingMessageId?: string) {
    try {
      console.log(`[AI AutoReply] Trigger received channel=${channel}, platformId=${platformId}, conversationId=${conversationId}, messageId=${incomingMessageId || "n/a"}`);
      const messageKey = incomingMessageId || `${conversationId}:${incomingText}:${Date.now()}`;
      const existingPending = pendingReplies.get(conversationId);
      if (existingPending?.messageKey === messageKey) {
        console.log(`[AI AutoReply] Đã có lịch phản hồi cho message ${messageKey}, bỏ qua trigger trùng.`);
        return;
      }

      // Find the user who owns this integration or the company-level integration
      let user = null;
      let aiConfig = null;

      if (channel === "facebook" || channel === "zalo") {
        const { SocialIntegrationModel } = require("../model/social-integration.model");
        const companyIntegration = await SocialIntegrationModel.findOne({
          platform: channel === "zalo" ? "Zalo" : "Facebook",
          username: platformId, // pageId or oaId is stored in username
          isConnected: true
        }).lean();

        if (companyIntegration) {
          const companyCode = companyIntegration.companyCode;
          console.log(`[AI AutoReply] Found company integration for ${channel}. companyCode=${companyCode}, displayName=${companyIntegration.displayName || "n/a"}`);
          user = await UserModel.findOne({
            companyCode,
            "aiAutoReplyConfig.enabled": true,
          });
          if (!user) {
            user = await UserModel.findOne({ companyCode });
          }
          if (user) {
            aiConfig = user.aiAutoReplyConfig;
            console.log(`[AI AutoReply] Loaded AI config from company user=${user.email}, enabled=${!!aiConfig?.enabled}, delay=${aiConfig?.replyDelay ?? "n/a"}s`);
          }
        }
      }

      // Fallback/Legacy query if user or config not found
      if (!user) {
        const query = channel === "zalo" 
          ? { "zaloIntegration.isConnected": true, "zaloIntegration.oaId": platformId }
          : { "facebookIntegration.isConnected": true, "facebookIntegration.pageId": platformId };
        
        user = await UserModel.findOne(query);
        if (user) {
          aiConfig = user.aiAutoReplyConfig;
          console.log(`[AI AutoReply] Loaded legacy ${channel} config from user=${user.email}, enabled=${!!aiConfig?.enabled}, delay=${aiConfig?.replyDelay ?? "n/a"}s`);
        }
      }

      if (!user) {
        console.warn(`[AI AutoReply] Không tìm thấy tích hợp ${channel} cho ID: ${platformId}`);
        return;
      }

      if (!aiConfig || !aiConfig.enabled) {
        console.log(`[AI AutoReply] AI auto-reply is disabled for user=${user.email}, conversationId=${conversationId}`);
        return;
      }

      // Cancel any existing pending reply for this conversation to debounce (customer is still typing)
      this.cancelPendingReply(conversationId);

      const delayMs = (aiConfig.replyDelay || 15) * 1000;
      console.log(`[AI AutoReply] Đang lên lịch phản hồi tự động sau ${aiConfig.replyDelay}s cho hội thoại: ${conversationId}`);

      const timeoutId = setTimeout(async () => {
        try {
          pendingReplies.delete(conversationId); // Remove from pending list since we are processing it now

          // Fetch the conversation to ensure it still exists and check if the last message is still inbound
          let lastMessageDirection = "inbound";
          let history: any[] = [];

          if (channel === "zalo") {
            const conv = await ZaloConversationModel.findById(conversationId);
            if (!conv) return;

            // Fetch last 15 messages for history context
            const dbMsgs = await ZaloMessageModel.find({ conversationId })
              .sort({ timestamp: -1 })
              .limit(15);
            
            dbMsgs.reverse();
            
            if (dbMsgs.length > 0) {
              lastMessageDirection = dbMsgs[dbMsgs.length - 1].direction;
            }

            history = dbMsgs.map(m => ({
              sender: m.direction === "inbound" ? "user" : "model",
              text: m.text || ""
            }));
          } else {
            const conv = await FBConversationModel.findById(conversationId);
            if (!conv) return;

            // Fetch last 15 messages for history context
            const dbMsgs = await FBMessageModel.find({ conversationId })
              .sort({ timestamp: -1 })
              .limit(15);
            
            dbMsgs.reverse();

            if (dbMsgs.length > 0) {
              lastMessageDirection = dbMsgs[dbMsgs.length - 1].direction;
            }

            history = dbMsgs.map(m => ({
              sender: m.direction === "inbound" ? "user" : "model",
              text: m.text || ""
            }));
          }

          // Security check: if the last message in DB is outbound (meaning human agent replied in the meantime),
          // we do not auto-reply anymore.
          if (lastMessageDirection === "outbound") {
            console.log(`[AI AutoReply] Bỏ qua tự động phản hồi hội thoại ${conversationId} vì tin nhắn gần nhất là outbound (nhân viên đã trả lời).`);
            return;
          }

          console.log(`[AI AutoReply] Bắt đầu gọi Gemini sinh câu trả lời cho hội thoại: ${conversationId}`);

          const startedAt = Date.now();
          const companyCode = user.companyCode || "SYSTEM";
          const ragContext = await aiKnowledgeService.searchRelevantContext({
            companyCode,
            query: `${history.map((h) => h.text).join("\n")}\n${incomingText}`,
            channel,
            topK: 5,
          });

          let effectiveRagContext = { ...ragContext, companyCode };
          if (!ragContext.contextText && aiConfig.trainingKnowledge) {
            effectiveRagContext = {
              contextText: String(aiConfig.trainingKnowledge).slice(0, 4500),
              matches: 0,
              companyCode,
            };
          }

          console.log(
            `[AI AutoReply] Context ready for conversation=${conversationId}, matches=${effectiveRagContext.matches}, ` +
            `contextLength=${effectiveRagContext.contextText?.length || 0}`
          );

          // Call Gemini Service
          const aiResponse = await geminiService.chat(incomingText, history, aiConfig, effectiveRagContext);

          if (!aiResponse || !aiResponse.text) {
            console.error(`[AI AutoReply] Không nhận được câu trả lời từ Gemini cho hội thoại: ${conversationId}`);
            return;
          }

          console.log(`[AI AutoReply] Đã sinh xong câu trả lời. Gửi tin nhắn thật qua ${channel}...`);

          try {
            // Send response using existing sendReply helper
            if (channel === "zalo") {
              await zaloMessengerService.sendReply(platformId, conversationId, aiResponse.text);
            } else {
              await fbMessengerService.sendReply(platformId, conversationId, aiResponse.text);
            }

            await aiKnowledgeService.createReplyLog({
              companyCode,
              channel,
              conversationId,
              customerMessage: incomingText,
              aiResponse: aiResponse.text,
              contextText: effectiveRagContext.contextText,
              contextMatches: effectiveRagContext.matches,
              latencyMs: Date.now() - startedAt,
              status: "sent",
            });
          } catch (sendErr: any) {
            await aiKnowledgeService.createReplyLog({
              companyCode,
              channel,
              conversationId,
              customerMessage: incomingText,
              aiResponse: `[SEND_FAILED] ${aiResponse.text}\n\nError: ${sendErr?.message || sendErr}`,
              contextText: effectiveRagContext.contextText,
              contextMatches: effectiveRagContext.matches,
              latencyMs: Date.now() - startedAt,
              status: "failed",
            });
            throw sendErr;
          }

          console.log(`[AI AutoReply] Gửi phản hồi tự động thành công cho hội thoại: ${conversationId}`);
        } catch (err) {
          console.error(`[AI AutoReply Timeout Execution] Thất bại khi thực hiện gửi phản hồi tự động:`, err);
        }
      }, delayMs);

      pendingReplies.set(conversationId, { timeout: timeoutId, messageKey });
    } catch (error) {
      console.error("[AI AutoReply triggerAutoReply] Lỗi xử lý trigger:", error);
    }
  }
};
