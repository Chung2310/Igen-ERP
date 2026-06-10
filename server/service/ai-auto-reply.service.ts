import { UserModel } from "../model/user.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { geminiService } from "./gemini.service";
import { zaloMessengerService } from "./zalo-messenger.service";
import { fbMessengerService } from "./fb-messenger.service";
import { aiKnowledgeService } from "./ai-knowledge.service";

// In-memory timeouts map to manage debouncing per conversation
const pendingReplies = new Map<string, NodeJS.Timeout>();

export const aiAutoReplyService = {
  /**
   * Cancel any pending AI auto-reply for a conversation (e.g. when an agent replies manually)
   */
  cancelPendingReply(conversationId: string) {
    const pending = pendingReplies.get(conversationId);
    if (pending) {
      clearTimeout(pending);
      pendingReplies.delete(conversationId);
      console.log(`[AI AutoReply] Đã hủy phản hồi tự động đang lên lịch cho cuộc hội thoại: ${conversationId} do có sự can thiệp từ nhân viên.`);
    }
  },

  /**
   * Triggers the AI auto-reply process. Debounces incoming messages to wait for the customer to finish typing.
   */
  async triggerAutoReply(channel: "facebook" | "zalo", platformId: string, conversationId: string, incomingText: string) {
    try {
      // Find the user who owns this integration
      const query = channel === "zalo" 
        ? { "zaloIntegration.isConnected": true, "zaloIntegration.oaId": platformId }
        : { "facebookIntegration.isConnected": true, "facebookIntegration.pageId": platformId };
      
      const user = await UserModel.findOne(query);
      if (!user) {
        console.warn(`[AI AutoReply] Không tìm thấy tích hợp ${channel} cho ID: ${platformId}`);
        return;
      }

      const aiConfig = user.aiAutoReplyConfig;
      if (!aiConfig || !aiConfig.enabled) {
        // AI auto-reply is disabled
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

            // Fetch last 10 messages for history context
            const dbMsgs = await ZaloMessageModel.find({ conversationId })
              .sort({ timestamp: -1 })
              .limit(10);
            
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

            const dbMsgs = await FBMessageModel.find({ conversationId })
              .sort({ timestamp: -1 })
              .limit(10);
            
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

          // Call Gemini Service
          const aiResponse = await geminiService.chat(incomingText, history, aiConfig, effectiveRagContext);

          if (!aiResponse || !aiResponse.text) {
            console.error(`[AI AutoReply] Không nhận được câu trả lời từ Gemini cho hội thoại: ${conversationId}`);
            return;
          }

          console.log(`[AI AutoReply] Đã sinh xong câu trả lời. Gửi tin nhắn thật qua ${channel}...`);

          // Send response using existing sendReply helper
          if (channel === "zalo") {
            await zaloMessengerService.sendReply(platformId, conversationId, aiResponse.text);
          } else {
            await fbMessengerService.sendReply(platformId, conversationId, aiResponse.text);
          }

          console.log(`[AI AutoReply] Gửi phản hồi tự động thành công cho hội thoại: ${conversationId}`);
        } catch (err) {
          console.error(`[AI AutoReply Timeout Execution] Thất bại khi thực hiện gửi phản hồi tự động:`, err);
        }
      }, delayMs);

      pendingReplies.set(conversationId, timeoutId);
    } catch (error) {
      console.error("[AI AutoReply triggerAutoReply] Lỗi xử lý trigger:", error);
    }
  }
};
