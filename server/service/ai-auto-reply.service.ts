import { UserModel } from "../model/user.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { SocialIntegrationModel } from "../model/social-integration.model";
import { geminiService } from "./gemini.service";
import { zaloMessengerService } from "./zalo-messenger.service";
import { fbMessengerService } from "./fb-messenger.service";
import { aiKnowledgeService } from "./ai-knowledge.service";

// In-memory timeouts map to manage debouncing per conversation.
// messageKey prevents polling/sync from pushing the same inbound message forever.
const pendingReplies = new Map<string, { timeout: NodeJS.Timeout; messageKey: string }>();
const generatingReplies = new Set<string>();

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
      const resolvedPlatformId = String(platformId).trim();
      console.log(`[AI AutoReply] Bắt đầu triggerAutoReply: channel=${channel}, platformId=${platformId} (ép kiểu string: "${resolvedPlatformId}"), conversationId=${conversationId}, messageId=${incomingMessageId || "n/a"}`);

      // 1. Cancel any existing pending reply for this conversation immediately to debounce
      this.cancelPendingReply(conversationId);

      const messageKey = incomingMessageId || `${conversationId}:${incomingText}:${Date.now()}`;
      const existingPending = pendingReplies.get(conversationId);
      if (existingPending?.messageKey === messageKey) {
        console.log(`[AI AutoReply] Đã có lịch phản hồi cho message ${messageKey}, bỏ qua trigger trùng.`);
        return;
      }

      // Find the user who owns this integration or the company-level integration
      let user = null;
      let aiConfig = null;

      const candidateUsers: any[] = [];

      // A. Tìm theo cấu hình tích hợp cá nhân (UserModel)
      const userLevelQuery = channel === "zalo"
        ? { "zaloIntegration.isConnected": true, "zaloIntegration.oaId": resolvedPlatformId }
        : { "facebookIntegration.isConnected": true, "facebookIntegration.pageId": resolvedPlatformId };

      console.log(`[AI AutoReply] Đang tìm tích hợp cá nhân cho ${channel} bằng query:`, JSON.stringify(userLevelQuery));
      const userLevelOwners = await UserModel.find(userLevelQuery);
      if (userLevelOwners && userLevelOwners.length > 0) {
        console.log(`[AI AutoReply] Tìm thấy ${userLevelOwners.length} users liên kết cá nhân:`, userLevelOwners.map(u => u.email));
        candidateUsers.push(...userLevelOwners);
      }

      // B. Tìm theo cấu hình tích hợp doanh nghiệp (SocialIntegrationModel)
      const companyIntegrations = await SocialIntegrationModel.find({
        platform: channel === "zalo" ? "Zalo" : "Facebook",
        username: resolvedPlatformId,
        isConnected: true
      }).lean();

      if (companyIntegrations && companyIntegrations.length > 0) {
        console.log(`[AI AutoReply] Tìm thấy ${companyIntegrations.length} tích hợp doanh nghiệp.`);
        for (const integration of companyIntegrations) {
          console.log(`  - Tích hợp: companyCode=${integration.companyCode}, createdBy=${integration.createdBy}`);
          
          if (integration.createdBy) {
            const creator = await UserModel.findById(integration.createdBy);
            if (creator) {
              console.log(`    - Thêm người tạo tích hợp doanh nghiệp làm ứng viên: ${creator.email}`);
              candidateUsers.push(creator);
            }
          }

          const companyUsers = await UserModel.find({ companyCode: integration.companyCode });
          if (companyUsers && companyUsers.length > 0) {
            console.log(`    - Thêm các thành viên trong công ty làm ứng viên:`, companyUsers.map(u => u.email));
            candidateUsers.push(...companyUsers);
          }
        }
      }

      // C. Lọc trùng lặp danh sách ứng viên
      const uniqueCandidatesMap = new Map<string, any>();
      for (const u of candidateUsers) {
        uniqueCandidatesMap.set(u._id.toString(), u);
      }
      const uniqueCandidates = Array.from(uniqueCandidatesMap.values());
      console.log(`[AI AutoReply] Danh sách tất cả ứng viên duy nhất:`, uniqueCandidates.map(u => `${u.email} (AIEnabled: ${!!u.aiAutoReplyConfig?.enabled})`));

      // D. Chọn user phù hợp nhất (ưu tiên người dùng đã BẬT AI tự động trả lời)
      let selectedUser = uniqueCandidates.find(u => u.aiAutoReplyConfig?.enabled === true);
      if (selectedUser) {
        console.log(`[AI AutoReply] Chọn được user đang BẬT AI: ${selectedUser.email}`);
      } else {
        selectedUser = uniqueCandidates[0];
        if (selectedUser) {
          console.log(`[AI AutoReply] Không có user nào bật AI. Chọn user dự phòng đầu tiên: ${selectedUser.email}`);
        }
      }

      if (!selectedUser) {
        console.warn(`[AI AutoReply] ❌ THẤT BẠI: Không tìm thấy bất kỳ cấu hình tích hợp nào cho ${channel} ID (Page/OA ID): "${resolvedPlatformId}". Bỏ qua auto reply.`);
        return;
      }

      user = selectedUser;
      aiConfig = selectedUser.aiAutoReplyConfig;

      if (!aiConfig || !aiConfig.enabled) {
        console.log(`[AI AutoReply] ⚠️ TỪ CHỐI: Tự động trả lời AI đang bị TẮT cho user=${user.email}, conversationId=${conversationId}`);
        return;
      }

      const delayMs = (aiConfig.replyDelay || 15) * 1000;
      console.log(`[AI AutoReply] 🕒 LÊN LỊCH: Đang lên lịch phản hồi tự động sau ${aiConfig.replyDelay}s cho hội thoại: ${conversationId} (User: ${user.email})`);

      const timeoutId = setTimeout(async () => {
        try {
          pendingReplies.delete(conversationId); // Remove from pending list since we are processing it now

          if (generatingReplies.has(conversationId)) {
            console.log(`[AI AutoReply] ⚠️ BỎ QUA: Bỏ qua tự động phản hồi hội thoại ${conversationId} vì đang có tiến trình sinh câu trả lời đang chạy.`);
            return;
          }

          // Fetch the conversation to ensure it still exists and check if the last message is still inbound
          let lastMessageDirection = "inbound";
          let history: any[] = [];
          let latestDbMessage: any = null;

          if (channel === "zalo") {
            const conv = await ZaloConversationModel.findById(conversationId);
            if (!conv) {
              console.error(`[AI AutoReply] ❌ LỖI: Không tìm thấy cuộc hội thoại Zalo ${conversationId} trong DB.`);
              return;
            }

            // Fetch last 15 messages for history context
            const dbMsgs = await ZaloMessageModel.find({ conversationId })
              .sort({ timestamp: -1 })
              .limit(15);
            
            dbMsgs.reverse();
            
            if (dbMsgs.length > 0) {
              latestDbMessage = dbMsgs[dbMsgs.length - 1];
              lastMessageDirection = latestDbMessage.direction;
            }

            // Deduplicate history context
            const lastMsg = dbMsgs[dbMsgs.length - 1];
            const isSameMessage = lastMsg && (
              (incomingMessageId && lastMsg.messageId === incomingMessageId) ||
              (!incomingMessageId && lastMsg.direction === "inbound" && lastMsg.text === incomingText)
            );
            if (isSameMessage) {
              dbMsgs.pop();
            }

            history = dbMsgs.map(m => ({
              sender: m.direction === "inbound" ? "user" : "model",
              text: m.text || ""
            }));
          } else {
            const conv = await FBConversationModel.findById(conversationId);
            if (!conv) {
              console.error(`[AI AutoReply] ❌ LỖI: Không tìm thấy cuộc hội thoại FB ${conversationId} trong DB.`);
              return;
            }

            // Fetch last 15 messages for history context
            const dbMsgs = await FBMessageModel.find({ conversationId })
              .sort({ timestamp: -1 })
              .limit(15);
            
            dbMsgs.reverse();

            if (dbMsgs.length > 0) {
              latestDbMessage = dbMsgs[dbMsgs.length - 1];
              lastMessageDirection = latestDbMessage.direction;
            }

            // Deduplicate history context
            const lastMsg = dbMsgs[dbMsgs.length - 1];
            const isSameMessage = lastMsg && (
              (incomingMessageId && lastMsg.messageId === incomingMessageId) ||
              (!incomingMessageId && lastMsg.direction === "inbound" && lastMsg.text === incomingText)
            );
            if (isSameMessage) {
              dbMsgs.pop();
            }

            history = dbMsgs.map(m => ({
              sender: m.direction === "inbound" ? "user" : "model",
              text: m.text || ""
            }));
          }

          // Security check 1: if the last message in DB is outbound (meaning human agent replied in the meantime),
          // we do not auto-reply anymore.
          if (lastMessageDirection === "outbound") {
            console.log(`[AI AutoReply] ⚠️ BỎ QUA: Bỏ qua tự động phản hồi hội thoại ${conversationId} vì tin nhắn gần nhất trong DB là "outbound" (nhân viên đã trả lời thủ công).`);
            return;
          }

          // Security check 2: if a newer message has arrived from the customer, abort this task (since it was debounced and a newer task will execute instead)
          const isLatest = latestDbMessage && (
            (incomingMessageId && latestDbMessage.messageId === incomingMessageId) ||
            (!incomingMessageId && latestDbMessage.direction === "inbound" && latestDbMessage.text === incomingText)
          );
          if (!isLatest) {
            console.log(`[AI AutoReply] ⚠️ BỎ QUA: Bỏ qua tự động phản hồi cho message ${incomingMessageId || incomingText} vì đã có tin nhắn mới hơn trong cuộc hội thoại.`);
            return;
          }

          console.log(`[AI AutoReply] 🤖 KHỞI CHẠY: Bắt đầu gọi Gemini sinh câu trả lời cho hội thoại: ${conversationId} (${channel.toUpperCase()})`);
          generatingReplies.add(conversationId);

          try {
            const startedAt = Date.now();
            const companyCode = user.companyCode || "SYSTEM";
            const queryText = `${history.map((h) => h.text).join("\n")}\n${incomingText}`.trim();
            const ragContext = await aiKnowledgeService.searchRelevantContext({
              companyCode,
              query: queryText,
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
              `[AI AutoReply] 📚 TRUY XUẤT RAG: Context ready cho conversation=${conversationId}, matches=${effectiveRagContext.matches}, ` +
              `contextLength=${effectiveRagContext.contextText?.length || 0}`
            );

            // Call Gemini Service
            console.log(`[AI AutoReply] 🧠 GEMINI CALL: Đang gửi request tới Gemini cho conversation=${conversationId}...`);
            const aiResponse = await geminiService.chat(incomingText, history, aiConfig, effectiveRagContext);

            if (!aiResponse || !aiResponse.text) {
              console.error(`[AI AutoReply] ❌ LỖI API: Không nhận được câu trả lời từ Gemini cho hội thoại: ${conversationId}`);
              return;
            }

            // Pre-send check: verify if a human agent has replied during the Gemini inference
            let preSendDirection = "inbound";
            if (channel === "zalo") {
              const latestMsg = await ZaloMessageModel.findOne({ conversationId }).sort({ timestamp: -1 });
              if (latestMsg) preSendDirection = latestMsg.direction;
            } else {
              const latestMsg = await FBMessageModel.findOne({ conversationId }).sort({ timestamp: -1 });
              if (latestMsg) preSendDirection = latestMsg.direction;
            }

            if (preSendDirection === "outbound") {
              console.log(`[AI AutoReply] ⚠️ CAN THIỆP PHÚT CUỐI: Nhân viên đã gửi tin nhắn thủ công trong thời gian Gemini sinh câu trả lời cho conversationId=${conversationId}. Huỷ bỏ việc gửi câu trả lời AI.`);
              return;
            }

            console.log(`[AI AutoReply] 💬 GEMINI OK: Đã sinh xong câu trả lời (độ dài: ${aiResponse.text.length} ký tự). Tiến hành gửi qua ${channel}...`);

            try {
              // Send response using existing sendReply helper
              if (channel === "zalo") {
                await zaloMessengerService.sendReply(resolvedPlatformId, conversationId, aiResponse.text);
              } else {
                await fbMessengerService.sendReply(resolvedPlatformId, conversationId, aiResponse.text);
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
              console.log(`[AI AutoReply] ✅ THÀNH CÔNG: Đã gửi phản hồi tự động thành công cho hội thoại: ${conversationId} trong ${Date.now() - startedAt}ms`);
            } catch (sendErr: any) {
              console.error(`[AI AutoReply] ❌ LỖI GỬI TIN: Thất bại khi gửi tin nhắn qua API ${channel.toUpperCase()}:`, sendErr.message || sendErr);
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

          } finally {
            generatingReplies.delete(conversationId);
          }
        } catch (err: any) {
          console.error(`[AI AutoReply Timeout Execution] ❌ LỖI NGHÊM TRỌNG khi thực hiện gửi phản hồi tự động:`, err.message || err);
        }
      }, delayMs);

      pendingReplies.set(conversationId, { timeout: timeoutId, messageKey });
    } catch (error: any) {
      console.error("[AI AutoReply triggerAutoReply] ❌ LỖI HỆ THỐNG khi xử lý trigger:", error.message || error);
    }
  }
};
