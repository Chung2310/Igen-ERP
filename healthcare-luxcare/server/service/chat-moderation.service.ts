import { getChatMemberId } from "./chat-identity";
import { Types } from "mongoose";
import { ChatReportModel } from "../model/chat-report.model";
import { UserBlockModel } from "../model/user-block.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { UserModel } from "../model/user.model";
import { ChatReportReason, ChatReportStatus } from "../interface/chat-report.interface";

export class ChatModerationService {
  /**
   * Tạo báo cáo vi phạm nội dung hoặc người dùng (Guideline 1.2)
   */
  async createReport(payload: {
    companyCode: string;
    reporterId: string;
    reportedUserId: string;
    roomId: string;
    messageId?: string;
    reason: ChatReportReason;
    details?: string;
  }) {
    const { companyCode, reporterId, reportedUserId, roomId, messageId, reason, details } = payload;

    if (reporterId === reportedUserId) {
      throw new Error("Bạn không thể tự báo cáo chính mình.");
    }

    // Xác thực phòng chat
    const room = await ChatRoomModel.findOne({
      _id: roomId,
      companyCode,
      "members.userId": reporterId,
    });
    if (!room) {
      throw new Error("Phòng chat không tồn tại hoặc bạn không có quyền truy cập.");
    }

    if (!messageId && !room.members.some((member) => getChatMemberId(member.userId) === reportedUserId))
      throw new Error("Người bị báo cáo không thuộc cuộc trò chuyện.");
    let messageSnippet = "";
    if (messageId) {
      const msg = await ChatMessageModel.findOne({ _id: messageId, roomId });
      if (!msg || String(msg.senderId) !== reportedUserId)
        throw new Error("Tin nhắn không thuộc người bị báo cáo trong phòng chat.");
      if (msg) {
        messageSnippet = msg.content ? msg.content.substring(0, 300) : "[Đính kèm tệp/hình ảnh]";
      }
    }

    const report = await ChatReportModel.create({
      companyCode,
      reporterId,
      reportedUserId,
      roomId,
      messageId: messageId ? new Types.ObjectId(messageId) : undefined,
      messageSnippet,
      reason,
      details: details || "",
      status: "pending",
    });

    return report;
  }

  /**
   * Chặn người dùng (Guideline 1.2)
   */
  async blockUser(userId: string, blockedUserId: string, companyCode: string, reason?: string) {
    if (userId === blockedUserId) {
      throw new Error("Bạn không thể tự chặn chính mình.");
    }

    const targetUser = await UserModel.findById(blockedUserId);
    if (!targetUser) {
      throw new Error("Người dùng cần chặn không tồn tại.");
    }

    const block = await UserBlockModel.findOneAndUpdate(
      { userId, blockedUserId },
      { $set: { companyCode, reason: reason || "", createdAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );

    return block;
  }

  /**
   * Bỏ chặn người dùng
   */
  async unblockUser(userId: string, blockedUserId: string) {
    const res = await UserBlockModel.findOneAndDelete({ userId, blockedUserId });
    if (!res) {
      throw new Error("Người dùng này chưa có trong danh sách chặn của bạn.");
    }
    return { success: true, message: "Đã bỏ chặn người dùng." };
  }

  /**
   * Lấy danh sách người dùng bị chặn bởi userId
   */
  async getBlockedUsers(userId: string) {
    const blocks = await UserBlockModel.find({ userId })
      .populate("blockedUserId", "displayName email photoURL role")
      .sort({ createdAt: -1 })
      .lean();

    return blocks.map((b) => ({
      blockId: b._id,
      blockedUser: b.blockedUserId,
      reason: b.reason,
      createdAt: b.createdAt,
    }));
  }

  /**
   * Lấy danh sách ID người dùng mà userId đã chặn
   */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await UserBlockModel.find({ userId }).select("blockedUserId").lean();
    return blocks.map((b) => String(b.blockedUserId));
  }

  /**
   * Kiểm tra xem 2 người dùng có bị chặn (1 trong 2 chặn nhau) hay không
   */
  async isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
    const count = await UserBlockModel.countDocuments({
      $or: [
        { userId: userA, blockedUserId: userB },
        { userId: userB, blockedUserId: userA },
      ],
    });
    return count > 0;
  }

  /**
   * Lấy danh sách báo cáo vi phạm (Dành cho Quản trị viên xử lý trong 24h)
   */
  async getReports(companyCode: string, status?: ChatReportStatus, limit = 50, skip = 0) {
    const filter: Record<string, unknown> = { companyCode };
    if (status) {
      filter.status = status;
    }

    const [reports, total] = await Promise.all([
      ChatReportModel.find(filter)
        .populate("reporterId", "displayName email photoURL")
        .populate("reportedUserId", "displayName email photoURL role")
        .populate("messageId", "content attachments isDeleted senderName")
        .populate("resolvedBy", "displayName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChatReportModel.countDocuments(filter),
    ]);

    return { reports, total };
  }

  async removeReportedMessage(reportId: string, companyCode: string) {
    const report = await ChatReportModel.findOne({ _id: reportId, companyCode }).lean();
    if (!report?.messageId) throw new Error("Báo cáo không có tin nhắn để thu hồi.");
    const room = await ChatRoomModel.findOne({ _id: report.roomId, companyCode }).select("_id").lean();
    if (!room) throw new Error("Không tìm thấy phòng chat thuộc doanh nghiệp.");
    // Soft removal preserves the audit record, without deleting attachments from storage.
    const message = await ChatMessageModel.findOneAndUpdate(
      { _id: report.messageId, roomId: room._id },
      { $set: { isDeleted: true, content: "", attachments: [] } },
      { returnDocument: "after" },
    );
    if (!message) throw new Error("Không tìm thấy tin nhắn được báo cáo.");
    return message;
  }
  /**
   * Xử lý báo cáo vi phạm (Duyệt / Bác bỏ / Ghi chú xử lý)
   */
  async updateReportStatus(
    reportId: string,
    adminUserId: string,
    status: ChatReportStatus,
    adminNotes: string | undefined,
    companyCode: string,
  ) {
    const report = await ChatReportModel.findOneAndUpdate(
      { _id: reportId, companyCode },
      {
        $set: {
          status,
          resolvedBy: adminUserId,
          resolvedAt: new Date(),
          ...(adminNotes !== undefined ? { adminNotes } : {}),
        },
      },
      { returnDocument: "after" },
    )
      .populate("reporterId", "displayName email")
      .populate("reportedUserId", "displayName email")
      .lean();

    if (!report) {
      throw new Error("Không tìm thấy báo cáo vi phạm.");
    }

    return report;
  }
}

export const chatModerationService = new ChatModerationService();
