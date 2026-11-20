import { getChatMemberId } from "../service/chat-identity";
import { errorDetails } from "../../shared/error-details";
import type { IChatAttachment } from "../interface/chat-message.interface";
import type { ChatReportStatus } from "../interface/chat-report.interface";
import { assertAiSharingConsent } from "../service/ai-sharing.service";
import { logger } from "../config/logger";
import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { sourceUploadFinalizer } from "../service/source-upload-finalizer.service";
import { resourceIndexingService } from "../service/resource-indexing.service";
import { chatService } from "../service/chat.service";
import { chatModerationService } from "../service/chat-moderation.service";
import { linkPreviewService } from "../service/link-preview.service";
import { emitToUser, isUserOnline } from "../socket";
import { pushService } from "../service/push.service";
import { ChatbotService } from "../service/chatbot.service";
import { ChatMessageModel } from "../model/chat-message.model";
import mongoose from "mongoose";
import { ChatRoomModel } from "../model/chat-room.model";
import { canNotifyChatMessage } from "../service/chat-notification.service";

export const chatController = {
  async setNotificationsMuted(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const roomId = String(req.params.roomId);
      const result = await ChatRoomModel.updateOne(
        { _id: roomId, companyCode, "members.userId": uid },
        { $set: { "members.$.notificationsMuted": req.body.muted, "members.$.notificationsChangedAt": new Date() } },
      );
      if (!result.matchedCount) return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
      const room = await chatService.getRoomById(roomId, uid, companyCode);
      emitToUser(uid, "internal_room_updated", room);
      return res.json({ status: "success", data: room });
    } catch {
      return res.status(500).json({ message: "Không thể cập nhật thông báo." });
    }
  },
  /**
   * GET /api/v1/chat/link-preview?url=...
   * Lấy thông tin xem trước (OG metadata) của một liên kết.
   */
  async getLinkPreview(req: AuthenticatedRequest, res: Response) {
    try {
      const url = (req.query.url as string) || "";
      const data = await linkPreviewService.fetchPreview(url);
      return res.status(200).json({ status: "success", data });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      return res
        .status(400)
        .json({ status: "error", message: failure.message || "Không lấy được xem trước liên kết." });
    }
  },

  /**
   * GET /api/v1/chat/rooms
   */
  async getRooms(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";

      const rooms = await chatService.getRooms(userId, companyCode);
      return res.status(200).json({
        status: "success",
        data: rooms,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.getRooms] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi lấy danh sách phòng trò chuyện.",
        details: failure.message,
      });
    }
  },

  /**
   * GET /api/v1/chat/rooms/:roomId
   */
  async getRoomById(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;

      const room = await chatService.getRoomById(roomId, userId, companyCode);
      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.getRoomById] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi lấy thông tin chi tiết phòng trò chuyện.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms
   */
  async createRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const creatorId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { isGroup, memberIds, name, avatarURL } = req.body;

      let room;
      if (isGroup) {
        room = await chatService.createGroupRoom(creatorId, name, memberIds, companyCode, avatarURL);
      } else {
        // Chat 1-1, memberIds should contain the recipient ID
        const targetUserId = memberIds[0];
        if (!targetUserId) {
          return res.status(400).json({
            status: "error",
            message: "Mã thành viên nhận tin nhắn chat 1-1 là bắt buộc.",
          });
        }
        room = await chatService.getOrCreatePrivateRoom(creatorId, targetUserId, companyCode);
      }

      // Phát sự kiện tới tất cả thành viên trong phòng về việc có phòng chat mới được tạo/kết nối
      room.members.forEach((member) => {
        emitToUser(getChatMemberId(member.userId), "internal_room_updated", room);
      });

      return res.status(201).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.createRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi tạo phòng trò chuyện mới.",
      });
    }
  },

  /**
   * PATCH /api/v1/chat/rooms/:roomId
   */
  async updateRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { name, avatarURL, onlyAdminsCanMessage } = req.body;

      const room = await chatService.updateGroupRoom(
        roomId,
        userId,
        { name, avatarURL, onlyAdminsCanMessage },
        companyCode,
      );

      // Phát sự kiện cập nhật tới các thành viên
      room.members.forEach((member) => {
        emitToUser(getChatMemberId(member.userId), "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.updateRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi cập nhật thông tin phòng.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/members
   */
  async addMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { memberIds } = req.body;

      const room = await chatService.addMembersToGroup(roomId, userId, memberIds, companyCode);

      // Phát sự kiện cập nhật phòng mới cho mọi thành viên (kể cả thành viên vừa được thêm)
      room.members.forEach((member) => {
        emitToUser(getChatMemberId(member.userId), "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.addMembers] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi thêm thành viên vào nhóm.",
      });
    }
  },

  /**
   * DELETE /api/v1/chat/rooms/:roomId/members/:userId
   */
  async removeMember(req: AuthenticatedRequest, res: Response) {
    try {
      const adminId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId, userId: targetUserId } = req.params;

      const room = await chatService.removeMemberFromGroup(roomId, adminId, targetUserId, companyCode);

      // Gửi sự kiện tới người bị xóa trước khi cập nhật những người còn lại
      emitToUser(targetUserId, "internal_room_deleted", { roomId });

      // Phát sự kiện cập nhật tới các thành viên còn lại
      room.members.forEach((member) => {
        emitToUser(getChatMemberId(member.userId), "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.removeMember] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi xóa thành viên khỏi nhóm.",
      });
    }
  },

  /**
   * DELETE /api/v1/chat/rooms/:roomId/leave
   */
  async leaveRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;

      const room = await chatService.leaveGroup(roomId, userId, companyCode);

      // Thông báo cho chính người rời đi
      emitToUser(userId, "internal_room_deleted", { roomId });

      if (room) {
        // Thông báo cho các thành viên còn lại
        room.members.forEach((member) => {
          emitToUser(getChatMemberId(member.userId), "internal_room_updated", room);
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Bạn đã rời khỏi nhóm chat thành công.",
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.leaveRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi rời khỏi nhóm chat.",
      });
    }
  },

  /**
   * DELETE /api/v1/chat/rooms/:roomId
   */
  async deleteRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;

      // Lấy danh sách thành viên trước khi xóa để gửi tin Socket
      const roomDetails = await chatService.getRoomById(roomId, userId, companyCode);
      const memberIds = roomDetails.members.map((m) => getChatMemberId(m.userId));

      await chatService.deleteGroup(roomId, userId, companyCode);

      // Gửi socket đến tất cả thành viên báo phòng đã bị xóa/giải tán
      memberIds.forEach((id) => {
        emitToUser(id, "internal_room_deleted", { roomId });
      });

      return res.status(200).json({
        status: "success",
        message: "Giải tán nhóm chat thành công.",
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.deleteRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi giải tán nhóm chat.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/messages
   */
  async sendMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const senderId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { content, attachments, replyTo } = req.body;

      // 1. Lấy chi tiết phòng trò chuyện hiện tại để kiểm tra quyền và lấy danh sách thành viên đầy đủ
      const room = await chatService.getRoomById(roomId, senderId, companyCode);

      // Kiểm tra chặn người dùng trong trò chuyện trực tiếp (UGC Guideline 1.2)
      if (!room.isGroup) {
        const otherMember = room.members.find((m) => getChatMemberId(m.userId) !== senderId);
        if (otherMember) {
          const otherId = getChatMemberId(otherMember.userId);
          const isBlocked = await chatModerationService.isBlockedEitherWay(senderId, otherId);
          if (isBlocked) {
            return res.status(403).json({
              status: "error",
              message: "Không thể gửi tin nhắn vì cuộc trò chuyện đã bị chặn.",
            });
          }
        }
      }
      // 2. Kiểm tra nếu chỉ Trưởng/Phó nhóm mới được nhắn tin
      if (room.isGroup && room.onlyAdminsCanMessage) {
        const member = room.members.find((m) => {
          const mId = getChatMemberId(m.userId);
          return mId === senderId;
        });
        if (!member || (member.role !== "admin" && member.role !== "deputy")) {
          return res.status(403).json({
            status: "error",
            message: "Chỉ Trưởng nhóm hoặc Phó nhóm mới được phép gửi tin nhắn trong phòng trò chuyện này.",
          });
        }
      }

      if (room.isChatbot) await assertAiSharingConsent(senderId, "company");
      const message = await chatService.sendMessage(roomId, senderId, content, attachments, companyCode, replyTo);
      const sourceAudienceIds = room.members.map((member) => String(getChatMemberId(member.userId)));
      await sourceUploadFinalizer.finalize(
        {
          companyCode,
          branchId: req.user?.branchId,
          actorId: senderId,
          actorName: message.senderName || req.user?.email,
        },
        {
          expectedSourceType: "chat.attachment",
          entityType: "chat-room",
          entityId: roomId,
          entityLabel: String(room.name || "Cuộc trò chuyện"),
          sourceRecordId: String(message._id),
          sourceAudienceIds,
          uploads: ((attachments || []) as IChatAttachment[]).map((attachment, index) => ({
            uploadToken: attachment.uploadToken,
            sourceField: `attachments.${index}`,
          })),
        },
      );

      // Phát sự kiện tin nhắn mới (internal_new_message) đến toàn bộ các thành viên trong phòng
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_new_message", {
          roomId,
          message,
          roomUpdate: room, // Gửi kèm room update để client cập nhật thứ tự phòng và preview message
        });
      });

      // Đẩy Web Push cho các thành viên đang offline (đã đóng web) — chạy nền, không chặn phản hồi
      void (async () => {
        try {
          const isActivity = content && content.startsWith("LUXCAREROOMACTIVITY:");
          const cleanContent = isActivity ? content.replace(/^LUXCAREROOMACTIVITY:\s*/, "") : content;
          const senderName = message.senderName || "Đồng nghiệp";
          const preview =
            cleanContent && String(cleanContent).trim() ? String(cleanContent).slice(0, 120) : "Đã gửi tệp đính kèm";

          const hasMentionAll =
            content && (content.toLowerCase().includes("@all") || content.toLowerCase().includes("@tất cả"));

          await Promise.all(
            room.members.map(async (member) => {
              const memId = getChatMemberId(member.userId);
              if (!memId || memId === senderId) return;
              if (!(await canNotifyChatMessage(String(message._id), memId, companyCode))) return;
              if (await isUserOnline(memId)) return; // Đang mở web — socket + Notification API đã lo

              const memberUser = member.userId as unknown as { displayName?: string } | null;
              const hasPersonalMention =
                content &&
                memberUser &&
                typeof memberUser === "object" &&
                memberUser.displayName &&
                content.includes(`@${memberUser.displayName}`);
              const isMentioned = !isActivity && room.isGroup && (hasMentionAll || hasPersonalMention);

              const pushTitle = isActivity
                ? room.isGroup && room.name
                  ? room.name
                  : "Thông báo nhóm"
                : isMentioned
                  ? `📢 [Nhắc đến bạn] ${senderName} — ${room.name || "Nhóm"}`
                  : room.isGroup && room.name
                    ? `${senderName} — ${room.name}`
                    : `Tin nhắn mới từ ${senderName}`;

              await pushService.sendToUser(memId, {
                title: pushTitle,
                body: preview,
                url: "/tro-chuyen",
                tag: `chat-${roomId}`,
              });
            }),
          );
        } catch (pushError) {
          logger.error("[chatController.sendMessage] Lỗi gửi Web Push:", pushError);
        }
      })();

      // 3. Nếu là phòng Chatbot, xử lý phản hồi từ chatbot bất đồng bộ
      if (room.isChatbot) {
        const CHATBOT_SENDER_ID = new mongoose.Types.ObjectId("6582a82d6b38c201a4e21bc5");
        void (async () => {
          try {
            // 3.1. Phát trạng thái đang nhập (typing)
            emitToUser(senderId, "internal_typing_status", {
              roomId,
              userId: CHATBOT_SENDER_ID.toString(),
              displayName: "Trợ lý AI",
              isTyping: true,
            });

            // 3.2. Lấy 20 tin nhắn gần nhất và đảo thứ tự để làm context
            const history = await chatService.getMessages(roomId, senderId, companyCode, 20);
            const chatbotMessages = history
              .slice()
              .reverse()
              .map((msg) => {
                const isUser = msg.senderId.toString() === senderId;
                return {
                  role: isUser ? ("user" as const) : ("assistant" as const),
                  content: msg.content || "",
                };
              });

            // 3.3. Gọi AI
            const assistantResponse = await ChatbotService.getResponse(req.user!, chatbotMessages);

            // 3.4. Lưu tin nhắn của AI
            const botMessage = new ChatMessageModel({
              roomId,
              senderId: CHATBOT_SENDER_ID,
              senderName: "Trợ lý AI",
              senderPhoto: "ai-avatar",
              content: assistantResponse.reply,
              citations: assistantResponse.citations,
              attachments: [],
              readBy: [senderId],
            });
            const savedBotMessage = await botMessage.save();

            // Cập nhật lastMessage phòng
            room.lastMessage = savedBotMessage._id;
            await room.save();

            // 3.5. Tắt trạng thái đang nhập
            emitToUser(senderId, "internal_typing_status", {
              roomId,
              userId: CHATBOT_SENDER_ID.toString(),
              displayName: "Trợ lý AI",
              isTyping: false,
            });

            // 3.6. Gửi tin nhắn mới qua socket
            const fullRoom = await chatService.getFullRoom(roomId);
            emitToUser(senderId, "internal_new_message", {
              roomId,
              message: savedBotMessage,
              roomUpdate: fullRoom,
            });
          } catch (err) {
            logger.error("[Chatbot AI Response Error]:", err);
            emitToUser(senderId, "internal_ai_error", {
              roomId,
              code: (err as { code?: string })?.code,
              resetAt: (err as { resetAt?: Date })?.resetAt?.toISOString(),
              message: err instanceof Error ? err.message : "Không thể hoàn tất yêu cầu AI.",
            });
            emitToUser(senderId, "internal_typing_status", {
              roomId,
              userId: CHATBOT_SENDER_ID.toString(),
              displayName: "Trợ lý AI",
              isTyping: false,
            });
          }
        })();
      }

      return res.status(201).json({
        status: "success",
        data: message,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.sendMessage] Error:", error);
      const statusCode = failure.statusCode ?? 500;
      return res.status([400, 403, 409, 422, 503].includes(statusCode) ? statusCode : 500).json({
        status: "error",
        code: failure.code,
        message: failure.message || "Lỗi khi gửi tin nhắn.",
      });
    }
  },

  /**
   * GET /api/v1/chat/rooms/:roomId/messages
   */
  async getMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const beforeDate = req.query.beforeDate ? new Date(req.query.beforeDate as string) : undefined;

      const messages = await chatService.getMessages(roomId, userId, companyCode, limit, beforeDate);
      return res.status(200).json({
        status: "success",
        data: messages,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.getMessages] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi lấy lịch sử tin nhắn.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;

      await chatService.markAsRead(roomId, userId, companyCode);

      // Emit read status event to all other room members
      const room = await chatService.getRoomById(roomId, userId, companyCode);
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        if (memId && memId !== userId) {
          emitToUser(memId, "internal_messages_read", { roomId, userId });
        }
      });

      return res.status(200).json({
        status: "success",
        message: "Đã đánh dấu các tin nhắn đã đọc.",
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.markAsRead] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi cập nhật trạng thái đọc tin nhắn.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/transfer-admin
   */
  async transferAdmin(req: AuthenticatedRequest, res: Response) {
    try {
      const currentAdminId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { newAdminId } = req.body;

      if (!newAdminId) {
        return res.status(400).json({
          status: "error",
          message: "Vui lòng cung cấp ID của thành viên được nhận quyền Trưởng nhóm.",
        });
      }

      const room = await chatService.transferAdmin(roomId, currentAdminId, newAdminId, companyCode);

      // Thông báo cập nhật phòng đến tất cả thành viên
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.transferAdmin] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi chuyển quyền Trưởng nhóm.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/members/:userId/role
   */
  async updateMemberRole(req: AuthenticatedRequest, res: Response) {
    try {
      const currentAdminId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId, userId } = req.params;
      const { role } = req.body;

      const room = await chatService.updateMemberRole(roomId, currentAdminId, userId, role, companyCode);

      // Thông báo cập nhật phòng đến tất cả thành viên
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.updateMemberRole] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi cập nhật vai trò thành viên.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/pin
   */
  async pinMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const adminId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { messageId } = req.body;

      const room = await chatService.pinMessage(roomId, adminId, messageId, companyCode);

      // Thông báo cập nhật phòng đến tất cả thành viên
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.pinMessage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi ghim tin nhắn.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/unpin
   */
  async unpinMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const adminId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { messageId } = req.body;

      const room = await chatService.unpinMessage(roomId, adminId, messageId, companyCode);

      // Thông báo cập nhật phòng đến tất cả thành viên
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.unpinMessage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi bỏ ghim tin nhắn.",
      });
    }
  },

  /**
   * DELETE /api/v1/chat/rooms/:roomId/messages/:messageId
   */
  async deleteMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId, messageId } = req.params;

      const message = await chatService.deleteMessage(roomId, messageId, userId, companyCode);
      await resourceIndexingService.trashSourceRecordResources(companyCode, "chat.attachment", messageId);

      // Lấy chi tiết phòng trò chuyện hiện tại để gửi thông tin cập nhật
      const room = await chatService.getRoomById(roomId, userId, companyCode);

      // Phát sự kiện tin nhắn bị thu hồi (internal_message_deleted) đến toàn bộ thành viên
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_message_deleted", {
          roomId,
          messageId,
          message,
          roomUpdate: room,
        });
      });

      return res.status(200).json({
        status: "success",
        data: message,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.deleteMessage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi thu hồi tin nhắn.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/messages/:messageId/react
   * Bật/tắt reaction emoji trên một tin nhắn.
   */
  async reactToMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId, messageId } = req.params;
      const { emoji } = req.body;

      const message = await chatService.toggleReaction(roomId, messageId, userId, companyCode, emoji);

      // Phát sự kiện cập nhật reaction đến toàn bộ thành viên phòng
      const room = await chatService.getRoomById(roomId, userId, companyCode);
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_message_reaction", { roomId, messageId, message });
      });

      return res.status(200).json({ status: "success", data: message });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.reactToMessage] Error:", error);
      return res.status(400).json({
        status: "error",
        message: failure.message || "Lỗi khi thả cảm xúc.",
      });
    }
  },

  /**
   * PATCH /api/v1/chat/rooms/:roomId/messages/:messageId
   * Sửa nội dung tin nhắn (chỉ người gửi).
   */
  async editMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId, messageId } = req.params;
      const { content } = req.body;

      const message = await chatService.editMessage(roomId, messageId, userId, companyCode, content);

      // Phát sự kiện tin nhắn đã sửa đến toàn bộ thành viên phòng
      const room = await chatService.getRoomById(roomId, userId, companyCode);
      room.members.forEach((member) => {
        const memId = getChatMemberId(member.userId);
        emitToUser(memId, "internal_message_edited", { roomId, messageId, message });
      });

      return res.status(200).json({ status: "success", data: message });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.editMessage] Error:", error);
      return res.status(400).json({
        status: "error",
        code: failure.code,
        message: failure.message || "Lỗi khi sửa tin nhắn.",
      });
    }
  },

  /**
   * GET /api/v1/chat/rooms/:roomId/search
   */
  async searchMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const query = (req.query.query as string) || "";
      const type = (typeof req.query.type === "string" ? req.query.type : "all") as Parameters<
        typeof chatService.searchMessages
      >[4];

      const results = await chatService.searchMessages(roomId, userId, companyCode, query, type);

      return res.status(200).json({
        status: "success",
        data: results,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.searchMessages] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi tìm kiếm lịch sử tin nhắn.",
      });
    }
  },

  /**
   * POST /api/v1/chat/rooms/:roomId/toggle-pin
   */
  async togglePinRoom(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { roomId } = req.params;

      const room = await chatService.togglePinRoom(roomId, userId, companyCode);
      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.togglePinRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: failure.message || "Lỗi khi ghim/bỏ ghim cuộc trò chuyện.",
      });
    }
  },
  /**
   * POST /api/v1/chat/reports
   * Báo cáo nội dung hoặc người dùng vi phạm (UGC Guideline 1.2)
   */
  async reportMessageOrUser(req: AuthenticatedRequest, res: Response) {
    try {
      const reporterId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { reportedUserId, roomId, messageId, reason, details } = req.body;

      const report = await chatModerationService.createReport({
        companyCode,
        reporterId,
        reportedUserId,
        roomId,
        messageId,
        reason,
        details,
      });

      return res.status(201).json({
        status: "success",
        message:
          "Báo cáo của bạn đã được ghi nhận. Đội ngũ kiểm duyệt sẽ xử lý trong vòng 24 giờ theo tiêu chuẩn cộng đồng.",
        data: report,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.reportMessageOrUser] Error:", error);
      return res.status(400).json({ status: "error", message: failure.message || "Không thể gửi báo cáo vi phạm." });
    }
  },

  /**
   * POST /api/v1/chat/blocks
   * Chặn người dùng xấu (UGC Guideline 1.2)
   */
  async blockUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const companyCode = req.user!.companyCode || "SYSTEM";
      const { blockedUserId, reason } = req.body;

      const block = await chatModerationService.blockUser(userId, blockedUserId, companyCode, reason);

      return res.status(200).json({
        status: "success",
        message: "Đã chặn người dùng thành công.",
        data: block,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.blockUser] Error:", error);
      return res.status(400).json({ status: "error", message: failure.message || "Không thể chặn người dùng." });
    }
  },

  /**
   * DELETE /api/v1/chat/blocks/:targetUserId
   * Bỏ chặn người dùng
   */
  async unblockUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { targetUserId } = req.params;

      const result = await chatModerationService.unblockUser(userId, targetUserId);

      return res.status(200).json({
        status: "success",
        message: result.message,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.unblockUser] Error:", error);
      return res.status(400).json({ status: "error", message: failure.message || "Không thể bỏ chặn người dùng." });
    }
  },

  /**
   * GET /api/v1/chat/blocks
   * Lấy danh sách người dùng bị chặn
   */
  async getBlockedUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const blocks = await chatModerationService.getBlockedUsers(userId);

      return res.status(200).json({
        status: "success",
        data: blocks,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.getBlockedUsers] Error:", error);
      return res
        .status(500)
        .json({ status: "error", message: failure.message || "Không thể lấy danh sách người dùng bị chặn." });
    }
  },

  /**
   * GET /api/v1/chat/reports
   * Danh sách báo cáo vi phạm (Dành cho Quản trị viên xử lý trong 24h)
   */
  async getReports(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user!.companyCode || "SYSTEM";
      const status = req.query.status as ChatReportStatus | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

      const data = await chatModerationService.getReports(companyCode, status, limit, skip);

      return res.status(200).json({
        status: "success",
        data: data.reports,
        total: data.total,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.getReports] Error:", error);
      return res.status(500).json({ status: "error", message: failure.message || "Không thể tải danh sách báo cáo." });
    }
  },

  /**
   * PATCH /api/v1/chat/reports/:reportId
   * Cập nhật trạng thái xử lý báo cáo
   */
  async updateReportStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const adminUserId = req.user!.id;
      const { reportId } = req.params;
      const { status, adminNotes, removeMessage } = req.body;
      const companyCode = req.user!.companyCode || "SYSTEM";
      if (removeMessage) {
        const removed = await chatModerationService.removeReportedMessage(reportId, companyCode);
        const room = await ChatRoomModel.findOne({ _id: removed.roomId, companyCode }).lean();
        if (room) {
          const roomUpdate = await chatService.getFullRoom(String(removed.roomId));
          for (const member of room.members)
            emitToUser(getChatMemberId(member.userId), "internal_message_deleted", {
              roomId: String(removed.roomId),
              messageId: String(removed._id),
              message: removed,
              roomUpdate,
            });
        }
      }
      const report = await chatModerationService.updateReportStatus(
        reportId,
        adminUserId,
        status,
        adminNotes,
        companyCode,
      );

      return res.status(200).json({
        status: "success",
        message: "Cập nhật trạng thái báo cáo thành công.",
        data: report,
      });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      logger.error("[chatController.updateReportStatus] Error:", error);
      return res.status(400).json({ status: "error", message: failure.message || "Không thể cập nhật báo cáo." });
    }
  },
};
