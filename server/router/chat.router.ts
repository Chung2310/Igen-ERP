import { Router } from "express";
import { chatController } from "../controller/chat.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import {
  createRoomSchema,
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
chatRouter.use(requireAuth as any, requirePermission("chat:read") as any);

// Xem trước liên kết (OG metadata)
chatRouter.get(
  "/link-preview",
  requireAuth as any,
  validateRequest(linkPreviewSchema),
  chatController.getLinkPreview as any
);

// Lấy danh sách phòng chat
chatRouter.get(
  "/rooms",
  requireAuth as any,
  chatController.getRooms as any
);

// Ghim/bỏ ghim cuộc trò chuyện
chatRouter.post(
  "/rooms/:roomId/toggle-pin",
  requireAuth as any,
  validateRequest(roomIdParamsSchema),
  chatController.togglePinRoom as any
);

// Tạo phòng chat mới (1-1 hoặc Nhóm)
chatRouter.post(
  "/rooms",
  requireAuth as any,
  validateRequest(createRoomSchema),
  chatController.createRoom as any
);

// Lấy chi tiết phòng chat
chatRouter.get(
  "/rooms/:roomId",
  requireAuth as any,
  validateRequest(roomIdParamsSchema),
  chatController.getRoomById as any
);

// Cập nhật thông tin phòng chat nhóm
chatRouter.patch(
  "/rooms/:roomId",
  requireAuth as any,
  validateRequest(updateRoomSchema),
  chatController.updateRoom as any
);

// Giải tán nhóm chat
chatRouter.delete(
  "/rooms/:roomId",
  requireAuth as any,
  validateRequest(roomIdParamsSchema),
  chatController.deleteRoom as any
);

// Rời khỏi nhóm chat
chatRouter.delete(
  "/rooms/:roomId/leave",
  requireAuth as any,
  validateRequest(roomIdParamsSchema),
  chatController.leaveRoom as any
);

// Thêm thành viên vào nhóm chat
chatRouter.post(
  "/rooms/:roomId/members",
  requireAuth as any,
  validateRequest(addMembersSchema),
  chatController.addMembers as any
);

// Xóa thành viên khỏi nhóm chat
chatRouter.delete(
  "/rooms/:roomId/members/:userId",
  requireAuth as any,
  validateRequest(removeMemberSchema),
  chatController.removeMember as any
);

// Lấy lịch sử tin nhắn trong phòng chat
chatRouter.get(
  "/rooms/:roomId/messages",
  requireAuth as any,
  validateRequest(getMessagesSchema),
  chatController.getMessages as any
);

// Tìm kiếm tin nhắn, liên kết, tệp tin, hình ảnh/video trong phòng chat
chatRouter.get(
  "/rooms/:roomId/search",
  requireAuth as any,
  validateRequest(searchMessagesSchema),
  chatController.searchMessages as any
);

// Gửi tin nhắn mới vào phòng chat
chatRouter.post(
  "/rooms/:roomId/messages",
  requireAuth as any,
  validateRequest(sendMessageSchema),
  chatController.sendMessage as any
);

// Đánh dấu đã đọc toàn bộ tin nhắn trong phòng chat
chatRouter.post(
  "/rooms/:roomId/read",
  requireAuth as any,
  validateRequest(roomIdParamsSchema),
  chatController.markAsRead as any
);

// Chuyển quyền Trưởng nhóm (Admin only)
chatRouter.post(
  "/rooms/:roomId/transfer-admin",
  requireAuth as any,
  validateRequest(roomIdParamsSchema),
  chatController.transferAdmin as any
);

// Cập nhật vai trò thành viên nhóm (Admin only)
chatRouter.post(
  "/rooms/:roomId/members/:userId/role",
  requireAuth as any,
  validateRequest(updateMemberRoleSchema),
  chatController.updateMemberRole as any
);

// Ghim tin nhắn
chatRouter.post(
  "/rooms/:roomId/pin",
  requireAuth as any,
  validateRequest(pinMessageSchema),
  chatController.pinMessage as any
);

// Bỏ ghim tin nhắn
chatRouter.post(
  "/rooms/:roomId/unpin",
  requireAuth as any,
  validateRequest(unpinMessageSchema),
  chatController.unpinMessage as any
);

// Thả / gỡ cảm xúc (reaction) trên tin nhắn
chatRouter.post(
  "/rooms/:roomId/messages/:messageId/react",
  requireAuth as any,
  validateRequest(reactMessageSchema),
  chatController.reactToMessage as any
);

// Sửa nội dung tin nhắn (chỉ người gửi)
chatRouter.patch(
  "/rooms/:roomId/messages/:messageId",
  requireAuth as any,
  validateRequest(editMessageSchema),
  chatController.editMessage as any
);

// Thu hồi tin nhắn (Soft Delete)
chatRouter.delete(
  "/rooms/:roomId/messages/:messageId",
  requireAuth as any,
  validateRequest(deleteMessageSchema),
  chatController.deleteMessage as any
);


