import mongoose from "mongoose";
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
const HUMAN_INTERVENTION_GUARD_ENABLED = false;

function normalizeIncomingText(text: string) {
  return String(text || "").trim();
}

async function collectCandidateUsers(
  channel: "facebook" | "zalo",
  resolvedPlatformId: string
) {
  const candidateUsers: any[] = [];

  const userLevelQuery = channel === "zalo"
    ? { "zaloIntegration.isConnected": true, "zaloIntegration.oaId": resolvedPlatformId }
    : { "facebookIntegration.isConnected": true, "facebookIntegration.pageId": resolvedPlatformId };

  console.log(`[AI AutoReply] Dang tim tich hop ca nhan cho ${channel} bang query:`, JSON.stringify(userLevelQuery));
  const userLevelOwners = await UserModel.find(userLevelQuery);
  if (userLevelOwners.length > 0) {
    console.log(`[AI AutoReply] Tim thay ${userLevelOwners.length} users lien ket ca nhan:`, userLevelOwners.map((u) => u.email));
    candidateUsers.push(...userLevelOwners);
  }

  const companyIntegrations = await SocialIntegrationModel.find({
    platform: channel === "zalo" ? "Zalo" : "Facebook",
    username: resolvedPlatformId,
    isConnected: true
  }).lean();

  if (companyIntegrations.length > 0) {
    console.log(`[AI AutoReply] Tim thay ${companyIntegrations.length} tich hop doanh nghiep.`);
    for (const integration of companyIntegrations) {
      if (integration.createdBy) {
        const creator = mongoose.Types.ObjectId.isValid(integration.createdBy)
          ? await UserModel.findById(integration.createdBy)
          : await UserModel.findOne({ email: integration.createdBy });
        if (creator) {
          candidateUsers.push(creator);
        }
      }

      const companyUsers = await UserModel.find({ companyCode: integration.companyCode });
      if (companyUsers.length > 0) {
        candidateUsers.push(...companyUsers);
      }
    }
  }

  const uniqueCandidatesMap = new Map<string, any>();
  for (const candidate of candidateUsers) {
    uniqueCandidatesMap.set(candidate._id.toString(), candidate);
  }

  const uniqueCandidates = Array.from(uniqueCandidatesMap.values());
  console.log(
    `[AI AutoReply] Danh sach ung vien duy nhat:`,
    uniqueCandidates.map((u) => `${u.email} (AIEnabled: ${!!u.aiAutoReplyConfig?.enabled})`)
  );

  return {
    userLevelOwners,
    companyIntegrations,
    uniqueCandidates,
  };
}

async function logAutoReplyFailure(params: {
  companyCode?: string;
  channel: "facebook" | "zalo";
  conversationId: string;
  customerMessage: string;
  reason: string;
  details?: Record<string, any>;
}) {
  const detailsText = params.details ? ` | details=${JSON.stringify(params.details)}` : "";
  console.warn(`[AI AutoReply] SKIPPED: ${params.reason}${detailsText}`);
  await aiKnowledgeService.createReplyLog({
    companyCode: params.companyCode || "SYSTEM",
    channel: params.channel,
    conversationId: params.conversationId,
    customerMessage: params.customerMessage || "[EMPTY_MESSAGE]",
    aiResponse: `[SKIPPED] ${params.reason}${detailsText}`,
    latencyMs: 0,
    status: "failed",
  }).catch((err) => {
    console.error("[AI AutoReply] Failed to persist skipped reply log:", err);
  });
}

export const aiAutoReplyService = {
  /**
   * Cancel any pending AI auto-reply for a conversation (e.g. when an agent replies manually)
   */
  cancelPendingReply(conversationId: string, reason: "debounce" | "human_reply" = "debounce") {
    if (reason === "human_reply" && !HUMAN_INTERVENTION_GUARD_ENABLED) {
      console.log(`[AI AutoReply] Human intervention guard is temporarily disabled. Keeping pending auto-reply for conversationId=${conversationId}.`);
      return;
    }

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
      const normalizedIncomingText = normalizeIncomingText(incomingText);
      console.log(`[AI AutoReply] Trigger start: channel=${channel}, platformId=${platformId} (resolved="${resolvedPlatformId}"), conversationId=${conversationId}, messageId=${incomingMessageId || "n/a"}, textLength=${normalizedIncomingText.length}`);

      // 1. Cancel any existing pending reply for this conversation immediately to debounce
      this.cancelPendingReply(conversationId);

      const messageKey = incomingMessageId || `${conversationId}:${normalizedIncomingText}:${Date.now()}`;
      const existingPending = pendingReplies.get(conversationId);
      if (existingPending?.messageKey === messageKey) {
        console.log(`[AI AutoReply] Đã có lịch phản hồi cho message ${messageKey}, bỏ qua trigger trùng.`);
        return;
      }

      // Find the user who owns this integration or the company-level integration
      let user = null;
      let aiConfig = null;

      const {
        userLevelOwners,
        companyIntegrations,
        uniqueCandidates,
      } = await collectCandidateUsers(channel, resolvedPlatformId);

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
        await logAutoReplyFailure({
          channel,
          conversationId,
          customerMessage: normalizedIncomingText,
          reason: `No integration owner found for ${channel} platform ID ${resolvedPlatformId}`,
          details: {
            platformId: resolvedPlatformId,
            candidateCount: uniqueCandidates.length,
            userLevelOwnerCount: userLevelOwners.length,
            companyIntegrationCount: companyIntegrations.length,
          },
        });
        return;
      }

      user = selectedUser;
      aiConfig = selectedUser.aiAutoReplyConfig;
      console.log(
        `[AI AutoReply] Owner selected: channel=${channel}, platformId=${resolvedPlatformId}, ` +
        `conversationId=${conversationId}, user=${user.email}, company=${user.companyCode || "SYSTEM"}, enabled=${!!aiConfig?.enabled}`
      );

      if (!aiConfig || !aiConfig.enabled) {
        await logAutoReplyFailure({
          companyCode: user.companyCode || "SYSTEM",
          channel,
          conversationId,
          customerMessage: normalizedIncomingText,
          reason: `AI auto-reply is disabled for selected user ${user.email}`,
          details: {
            selectedUserEmail: user.email,
            companyCode: user.companyCode || "SYSTEM",
            enabled: !!aiConfig?.enabled,
          },
        });
        return;
      }

      if (!normalizedIncomingText) {
        await logAutoReplyFailure({
          companyCode: user.companyCode || "SYSTEM",
          channel,
          conversationId,
          customerMessage: "[EMPTY_MESSAGE]",
          reason: "Inbound message has no text content",
          details: {
            selectedUserEmail: user.email,
            platformId: resolvedPlatformId,
            messageId: incomingMessageId || null,
          },
        });
        return;
      }

      const delayMs = (aiConfig.replyDelay || 15) * 1000;
      console.log(
        `[AI AutoReply] Schedule reply: channel=${channel}, conversationId=${conversationId}, ` +
        `delayMs=${delayMs}, model=${aiConfig.model || "n/a"}, user=${user.email}`
      );
      console.log(`[AI AutoReply] 🕒 LÊN LỊCH: Đang lên lịch phản hồi tự động sau ${aiConfig.replyDelay}s cho hội thoại: ${conversationId} (User: ${user.email})`);

      const timeoutId = setTimeout(async () => {
        try {
          pendingReplies.delete(conversationId); // Remove from pending list since we are processing it now

          if (generatingReplies.has(conversationId)) {
            console.log(`[AI AutoReply] ⚠️ BỎ QUA: Bỏ qua tự động phản hồi hội thoại ${conversationId} vì đang có tiến trình sinh câu trả lời đang chạy.`);
            await aiKnowledgeService.createReplyLog({
              companyCode: user.companyCode || "SYSTEM",
              channel,
              conversationId,
              customerMessage: normalizedIncomingText,
              aiResponse: `[SKIPPED] Đang có tiến trình sinh câu trả lời cho cuộc hội thoại này`,
              latencyMs: 0,
              status: "failed",
            }).catch(() => {});
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
              await aiKnowledgeService.createReplyLog({
                companyCode: user.companyCode || "SYSTEM",
                channel,
                conversationId,
                customerMessage: normalizedIncomingText,
                aiResponse: `[FAILED] Không tìm thấy cuộc hội thoại Zalo trong DB`,
                latencyMs: 0,
                status: "failed",
              }).catch(() => {});
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
              (!incomingMessageId && lastMsg.direction === "inbound" && normalizeIncomingText(lastMsg.text) === normalizedIncomingText)
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
              await aiKnowledgeService.createReplyLog({
                companyCode: user.companyCode || "SYSTEM",
                channel,
                conversationId,
                customerMessage: normalizedIncomingText,
                aiResponse: `[FAILED] Không tìm thấy cuộc hội thoại FB trong DB`,
                latencyMs: 0,
                status: "failed",
              }).catch(() => {});
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
              (!incomingMessageId && lastMsg.direction === "inbound" && normalizeIncomingText(lastMsg.text) === normalizedIncomingText)
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
          if (HUMAN_INTERVENTION_GUARD_ENABLED && lastMessageDirection === "outbound") {
            await logAutoReplyFailure({
              companyCode: user.companyCode || "SYSTEM",
              channel,
              conversationId,
              customerMessage: normalizedIncomingText,
              reason: "Latest message is outbound, likely handled by a human agent",
              details: {
                latestMessageId: latestDbMessage?.messageId || null,
                latestMessageAt: latestDbMessage?.timestamp || null,
              },
            });
            return;
          }

          // Security check 2: if a newer message has arrived from the customer, abort this task (since it was debounced and a newer task will execute instead)
          const isLatest = latestDbMessage && (
            (incomingMessageId && latestDbMessage.messageId === incomingMessageId) ||
            (!incomingMessageId && latestDbMessage.direction === "inbound" && normalizeIncomingText(latestDbMessage.text) === normalizedIncomingText)
          );
          if (!isLatest) {
            await logAutoReplyFailure({
              companyCode: user.companyCode || "SYSTEM",
              channel,
              conversationId,
              customerMessage: normalizedIncomingText,
              reason: "A newer message exists in the conversation",
              details: {
                incomingMessageId: incomingMessageId || null,
                latestMessageId: latestDbMessage?.messageId || null,
                latestDirection: latestDbMessage?.direction || null,
              },
            });
            return;
          }

          console.log(`[AI AutoReply] 🤖 KHỞI CHẠY: Bắt đầu gọi Gemini sinh câu trả lời cho hội thoại: ${conversationId} (${channel.toUpperCase()})`);
          console.log(`[AI AutoReply] Gemini start: conversationId=${conversationId}, channel=${channel}, historyCount=${history.length}`);
          generatingReplies.add(conversationId);

          try {
            const startedAt = Date.now();
            const companyCode = user.companyCode || "SYSTEM";
            const queryText = `${history.map((h) => h.text).join("\n")}\n${normalizedIncomingText}`.trim();
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
              `[AI AutoReply] Context ready: conversationId=${conversationId}, channel=${channel}, ` +
              `matches=${effectiveRagContext.matches}, contextLength=${effectiveRagContext.contextText?.length || 0}`
            );

            console.log(
              `[AI AutoReply] 📚 TRUY XUẤT RAG: Context ready cho conversation=${conversationId}, matches=${effectiveRagContext.matches}, ` +
              `contextLength=${effectiveRagContext.contextText?.length || 0}`
            );

            // Call Gemini Service
            console.log(`[AI AutoReply] 🧠 GEMINI CALL: Đang gửi request tới Gemini cho conversation=${conversationId}...`);
            console.log(`[AI AutoReply] Gemini call: conversationId=${conversationId}, channel=${channel}`);
            const aiResponse = await geminiService.chat(normalizedIncomingText, history, aiConfig, effectiveRagContext);

            if (!aiResponse || !aiResponse.text) {
              console.error(`[AI AutoReply] ❌ LỖI API: Không nhận được câu trả lời từ Gemini cho hội thoại: ${conversationId}`);
              await aiKnowledgeService.createReplyLog({
                companyCode: user.companyCode || "SYSTEM",
                channel,
                conversationId,
                customerMessage: normalizedIncomingText,
                aiResponse: `[FAILED] Không nhận được câu trả lời từ Gemini (aiResponse trống)`,
                latencyMs: 0,
                status: "failed",
              }).catch(() => {});
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

            if (HUMAN_INTERVENTION_GUARD_ENABLED && preSendDirection === "outbound") {
              console.log(`[AI AutoReply] ⚠️ CAN THIỆP PHÚT CUỐI: Nhân viên đã gửi tin nhắn thủ công trong thời gian Gemini sinh câu trả lời cho conversationId=${conversationId}. Huỷ bỏ việc gửi câu trả lời AI.`);
              await aiKnowledgeService.createReplyLog({
                companyCode: user.companyCode || "SYSTEM",
                channel,
                conversationId,
                customerMessage: normalizedIncomingText,
                aiResponse: `[SKIPPED] Nhân viên đã gửi tin nhắn thủ công trước khi AI gửi đi`,
                latencyMs: 0,
                status: "failed",
              }).catch(() => {});
              return;
            }

            console.log(`[AI AutoReply] 💬 GEMINI OK: Đã sinh xong câu trả lời (độ dài: ${aiResponse.text.length} ký tự). Tiến hành gửi qua ${channel}...`);

            console.log(`[AI AutoReply] Gemini ok: conversationId=${conversationId}, channel=${channel}, replyLength=${aiResponse.text.length}`);
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
                customerMessage: normalizedIncomingText,
                aiResponse: aiResponse.text,
                contextText: effectiveRagContext.contextText,
                contextMatches: effectiveRagContext.matches,
                latencyMs: Date.now() - startedAt,
                status: "sent",
              });
              console.log(`[AI AutoReply] Reply sent: conversationId=${conversationId}, channel=${channel}, latencyMs=${Date.now() - startedAt}`);
              console.log(`[AI AutoReply] ✅ THÀNH CÔNG: Đã gửi phản hồi tự động thành công cho hội thoại: ${conversationId} trong ${Date.now() - startedAt}ms`);
            } catch (sendErr: any) {
              console.error(`[AI AutoReply] ❌ LỖI GỬI TIN: Thất bại khi gửi tin nhắn qua API ${channel.toUpperCase()}:`, sendErr.message || sendErr);
              await aiKnowledgeService.createReplyLog({
                companyCode,
                channel,
                conversationId,
                customerMessage: normalizedIncomingText,
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
          console.error(`[AI AutoReply Timeout Execution] ❌ LỖI NGHIÊM TRỌNG khi thực hiện gửi phản hồi tự động:`, err.message || err);
          try {
            await aiKnowledgeService.createReplyLog({
              companyCode: user?.companyCode || "SYSTEM",
              channel,
              conversationId,
              customerMessage: normalizedIncomingText,
              aiResponse: `[ERROR] ${err.message || String(err)}`,
              latencyMs: 0,
              status: "failed",
            });
          } catch (logErr) {
            console.error(`[AI AutoReply] Không thể lưu log lỗi:`, logErr);
          }
        }
      }, delayMs);

      pendingReplies.set(conversationId, { timeout: timeoutId, messageKey });
    } catch (error: any) {
      console.error("[AI AutoReply triggerAutoReply] ❌ LỖI HỆ THỐNG khi xử lý trigger:", error.message || error);
    }
  }
};
