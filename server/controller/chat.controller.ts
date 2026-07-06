import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { chatService } from "../service/chat.service";
import { linkPreviewService } from "../service/link-preview.service";
import { emitToUser } from "../socket";

export const chatController = {
  /**
   * GET /api/v1/chat/link-preview?url=...
   * Lấy thông tin xem trước (OG metadata) của một liên kết.
   */
  async getLinkPreview(req: AuthenticatedRequest, res: Response) {
    try {
      const url = (req.query.url as string) || "";
      const data = await linkPreviewService.fetchPreview(url);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      return res.status(400).json({ status: "error", message: error.message || "Không lấy được xem trước liên kết." });
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
    } catch (error: any) {
      console.error("[chatController.getRooms] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi lấy danh sách phòng trò chuyện.",
        details: error.message,
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
    } catch (error: any) {
      console.error("[chatController.getRoomById] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi lấy thông tin chi tiết phòng trò chuyện.",
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
      room.members.forEach((member: any) => {
        emitToUser(member.userId._id ? member.userId._id.toString() : member.userId.toString(), "internal_room_updated", room);
      });

      return res.status(201).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.createRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi tạo phòng trò chuyện mới.",
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
      const { name, avatarURL } = req.body;

      const room = await chatService.updateGroupRoom(roomId, userId, { name, avatarURL }, companyCode);

      // Phát sự kiện cập nhật tới các thành viên
      room.members.forEach((member: any) => {
        emitToUser(member.userId._id ? member.userId._id.toString() : member.userId.toString(), "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.updateRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi cập nhật thông tin phòng.",
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
      room.members.forEach((member: any) => {
        emitToUser(member.userId._id ? member.userId._id.toString() : member.userId.toString(), "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.addMembers] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi thêm thành viên vào nhóm.",
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
      room.members.forEach((member: any) => {
        emitToUser(member.userId._id ? member.userId._id.toString() : member.userId.toString(), "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.removeMember] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi xóa thành viên khỏi nhóm.",
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
        room.members.forEach((member: any) => {
          emitToUser(member.userId._id ? member.userId._id.toString() : member.userId.toString(), "internal_room_updated", room);
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Bạn đã rời khỏi nhóm chat thành công.",
      });
    } catch (error: any) {
      console.error("[chatController.leaveRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi rời khỏi nhóm chat.",
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
      const memberIds = roomDetails.members.map((m: any) => m.userId._id ? m.userId._id.toString() : m.userId.toString());

      await chatService.deleteGroup(roomId, userId, companyCode);

      // Gửi socket đến tất cả thành viên báo phòng đã bị xóa/giải tán
      memberIds.forEach((id) => {
        emitToUser(id, "internal_room_deleted", { roomId });
      });

      return res.status(200).json({
        status: "success",
        message: "Giải tán nhóm chat thành công.",
      });
    } catch (error: any) {
      console.error("[chatController.deleteRoom] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi giải tán nhóm chat.",
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

      const message = await chatService.sendMessage(roomId, senderId, content, attachments, companyCode, replyTo);

      // Lấy chi tiết phòng trò chuyện hiện tại để lấy danh sách thành viên đầy đủ
      const room = await chatService.getRoomById(roomId, senderId, companyCode);

      // Phát sự kiện tin nhắn mới (internal_new_message) đến toàn bộ các thành viên trong phòng
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_new_message", {
          roomId,
          message,
          roomUpdate: room // Gửi kèm room update để client cập nhật thứ tự phòng và preview message
        });
      });

      return res.status(201).json({
        status: "success",
        data: message,
      });
    } catch (error: any) {
      console.error("[chatController.sendMessage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi gửi tin nhắn.",
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
    } catch (error: any) {
      console.error("[chatController.getMessages] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi lấy lịch sử tin nhắn.",
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
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        if (memId !== userId) {
          emitToUser(memId, "internal_messages_read", { roomId, userId });
        }
      });

      return res.status(200).json({
        status: "success",
        message: "Đã đánh dấu các tin nhắn đã đọc.",
      });
    } catch (error: any) {
      console.error("[chatController.markAsRead] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi cập nhật trạng thái đọc tin nhắn.",
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
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.transferAdmin] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi chuyển quyền Trưởng nhóm.",
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
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.updateMemberRole] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi cập nhật vai trò thành viên.",
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
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.pinMessage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi ghim tin nhắn.",
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
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_room_updated", room);
      });

      return res.status(200).json({
        status: "success",
        data: room,
      });
    } catch (error: any) {
      console.error("[chatController.unpinMessage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi bỏ ghim tin nhắn.",
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

      // Lấy chi tiết phòng trò chuyện hiện tại để gửi thông tin cập nhật
      const room = await chatService.getRoomById(roomId, userId, companyCode);

      // Phát sự kiện tin nhắn bị thu hồi (internal_message_deleted) đến toàn bộ thành viên
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_message_deleted", {
          roomId,
          messageId,
          message,
          roomUpdate: room
        });
      });

      return res.status(200).json({
        status: "success",
        data: message,
      });
    } catch (error: any) {
      console.error("[chatController.deleteMessage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi thu hồi tin nhắn.",
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
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_message_reaction", { roomId, messageId, message });
      });

      return res.status(200).json({ status: "success", data: message });
    } catch (error: any) {
      console.error("[chatController.reactToMessage] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Lỗi khi thả cảm xúc.",
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
      room.members.forEach((member: any) => {
        const memId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        emitToUser(memId, "internal_message_edited", { roomId, messageId, message });
      });

      return res.status(200).json({ status: "success", data: message });
    } catch (error: any) {
      console.error("[chatController.editMessage] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Lỗi khi sửa tin nhắn.",
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
      const type = (req.query.type as any) || "all";

      const results = await chatService.searchMessages(roomId, userId, companyCode, query, type);

      return res.status(200).json({
        status: "success",
        data: results,
      });
    } catch (error: any) {
      console.error("[chatController.searchMessages] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi tìm kiếm lịch sử tin nhắn.",
      });
    }
  },
};
