import { Router, type Response, type NextFunction } from "express";
import { chatController } from "../controller/chat.controller";
import { requireAuth, requirePermission, requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { chatService } from "../service/chat.service";
import {
  createReportSchema,
  updateReportStatusSchema,
  blockUserSchema,
  targetUserIdParamSchema,
} from "../validation/chat-moderation.validation";
import {
  createRoomSchema,
  chatNotificationsSchema,
  updateRoomSchema,
  roomIdParamsSchema,
  addMembersSchema,
  removeMemberSchema,
  sendMessageSchema,
  getMessagesSchema,
  updateMemberRoleSchema,
  pinMessageSchema,
  unpinMessageSchema,
  deleteMessageSchema,
  reactMessageSchema,
  editMessageSchema,
  linkPreviewSchema,
  searchMessagesSchema,
} from "../validation/chat.validation";

export const chatRouter = Router();
chatRouter.use(requireAuth, requirePermission("chat:read"));
chatRouter.patch(
  "/rooms/:roomId/notifications",
  validateRequest(chatNotificationsSchema),
  chatController.setNotificationsMuted,
);

// Xem trước liên kết (OG metadata)
chatRouter.get("/link-preview", requireAuth, validateRequest(linkPreviewSchema), chatController.getLinkPreview);

// Lấy danh sách phòng chat
chatRouter.get("/rooms", requireAuth, chatController.getRooms);

// Ghim/bỏ ghim cuộc trò chuyện
chatRouter.post(
  "/rooms/:roomId/toggle-pin",
  requireAuth,
  validateRequest(roomIdParamsSchema),
  chatController.togglePinRoom,
);

// Tạo phòng chat mới (1-1 hoặc Nhóm)
chatRouter.post("/rooms", requireAuth, validateRequest(createRoomSchema), chatController.createRoom);

// Lấy chi tiết phòng chat
chatRouter.get("/rooms/:roomId", requireAuth, validateRequest(roomIdParamsSchema), chatController.getRoomById);

// Cập nhật thông tin phòng chat nhóm
chatRouter.patch("/rooms/:roomId", requireAuth, validateRequest(updateRoomSchema), chatController.updateRoom);

// Giải tán nhóm chat
chatRouter.delete("/rooms/:roomId", requireAuth, validateRequest(roomIdParamsSchema), chatController.deleteRoom);

// Rời khỏi nhóm chat
chatRouter.delete("/rooms/:roomId/leave", requireAuth, validateRequest(roomIdParamsSchema), chatController.leaveRoom);

// Thêm thành viên vào nhóm chat
chatRouter.post("/rooms/:roomId/members", requireAuth, validateRequest(addMembersSchema), chatController.addMembers);

// Xóa thành viên khỏi nhóm chat
chatRouter.delete(
  "/rooms/:roomId/members/:userId",
  requireAuth,
  validateRequest(removeMemberSchema),
  chatController.removeMember,
);

// Lấy lịch sử tin nhắn trong phòng chat
chatRouter.get("/rooms/:roomId/messages", requireAuth, validateRequest(getMessagesSchema), chatController.getMessages);

// Tìm kiếm tin nhắn, liên kết, tệp tin, hình ảnh/video trong phòng chat
chatRouter.get(
  "/rooms/:roomId/search",
  requireAuth,
  validateRequest(searchMessagesSchema),
  chatController.searchMessages,
);

// Gửi tin nhắn mới vào phòng chat
chatRouter.post(
  "/rooms/:roomId/messages",
  requireAuth,
  validateRequest(sendMessageSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const room = await chatService.getRoomById(req.params.roomId, req.user.id, req.user.companyCode);
      return room.isChatbot ? expensiveApiRateLimiter(req, res, next) : next();
    } catch (error) {
      return next(error);
    }
  },
  chatController.sendMessage,
);

// Đánh dấu đã đọc toàn bộ tin nhắn trong phòng chat
chatRouter.post("/rooms/:roomId/read", requireAuth, validateRequest(roomIdParamsSchema), chatController.markAsRead);

// Chuyển quyền Trưởng nhóm (Admin only)
chatRouter.post(
  "/rooms/:roomId/transfer-admin",
  requireAuth,
  validateRequest(roomIdParamsSchema),
  chatController.transferAdmin,
);

// Cập nhật vai trò thành viên nhóm (Admin only)
chatRouter.post(
  "/rooms/:roomId/members/:userId/role",
  requireAuth,
  validateRequest(updateMemberRoleSchema),
  chatController.updateMemberRole,
);

// Ghim tin nhắn
chatRouter.post("/rooms/:roomId/pin", requireAuth, validateRequest(pinMessageSchema), chatController.pinMessage);

// Bỏ ghim tin nhắn
chatRouter.post("/rooms/:roomId/unpin", requireAuth, validateRequest(unpinMessageSchema), chatController.unpinMessage);

// Thả / gỡ cảm xúc (reaction) trên tin nhắn
chatRouter.post(
  "/rooms/:roomId/messages/:messageId/react",
  requireAuth,
  validateRequest(reactMessageSchema),
  chatController.reactToMessage,
);

// Sửa nội dung tin nhắn (chỉ người gửi)
chatRouter.patch(
  "/rooms/:roomId/messages/:messageId",
  requireAuth,
  validateRequest(editMessageSchema),
  chatController.editMessage,
);

// Thu hồi tin nhắn (Soft Delete)
chatRouter.delete(
  "/rooms/:roomId/messages/:messageId",
  requireAuth,
  validateRequest(deleteMessageSchema),
  chatController.deleteMessage,
);

// === CƠ CHẾ BÁO CÁO & CHẶN VI PHẠM (UGC GUIDELINE 1.2) ===

// Báo cáo vi phạm tin nhắn hoặc người dùng
chatRouter.post("/reports", requireAuth, validateRequest(createReportSchema), chatController.reportMessageOrUser);

// Lấy danh sách báo cáo vi phạm (Quản trị viên)
chatRouter.get("/reports", requireAuth, requireRole(["admin", "superadmin"]), chatController.getReports);

// Cập nhật trạng thái báo cáo vi phạm (Quản trị viên)
chatRouter.patch(
  "/reports/:reportId",
  requireAuth,
  requireRole(["admin", "superadmin"]),
  validateRequest(updateReportStatusSchema),
  chatController.updateReportStatus,
);

// Chặn người dùng xấu
chatRouter.post("/blocks", requireAuth, validateRequest(blockUserSchema), chatController.blockUser);

// Lấy danh sách người dùng đã chặn
chatRouter.get("/blocks", requireAuth, chatController.getBlockedUsers);

// Bỏ chặn người dùng
chatRouter.delete(
  "/blocks/:targetUserId",
  requireAuth,
  validateRequest(targetUserIdParamSchema),
  chatController.unblockUser,
);
