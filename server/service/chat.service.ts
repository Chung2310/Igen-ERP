import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { UserModel } from "../model/user.model";
import { IChatRoom } from "../interface/chat-room.interface";
import { IChatMessage, IChatAttachment } from "../interface/chat-message.interface";
import mongoose from "mongoose";

export const chatService = {
  /**
   * Helper lấy phòng chat được populate đầy đủ thông tin
   */
  async getFullRoom(roomId: string): Promise<IChatRoom> {
    return (await ChatRoomModel.findById(roomId)
      .populate("members.userId", "displayName photoURL email role status")
      .populate("pinnedMessageIds")
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "displayName photoURL email",
        },
      })
      .exec())!;
  },

  /**
   * Lấy danh sách các phòng chat mà người dùng tham gia
   */
  async getRooms(userId: string, companyCode: string): Promise<any[]> {
    // Tự động tạo phòng "Cloud của tôi" nếu chưa có
    let cloudRoom = await ChatRoomModel.findOne({
      isGroup: false,
      companyCode,
      creatorId: userId,
      $expr: { $eq: [{ $size: "$members" }, 1] },
      "members.userId": userId,
    }).exec();

    if (!cloudRoom) {
      const newCloud = new ChatRoomModel({
        isGroup: false,
        name: "Cloud của tôi",
        companyCode,
        creatorId: userId,
        members: [{ userId, role: "admin", joinedAt: new Date() }],
      });
      await newCloud.save();
    }

    const rooms = await ChatRoomModel.find({
      companyCode,
      "members.userId": userId,
    })
      .populate("members.userId", "displayName photoURL email role status")
      .populate("pinnedMessageIds")
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "displayName photoURL email",
        },
      })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    // Đính kèm số tin nhắn chưa đọc cho mỗi phòng (không tính tin của chính mình)
    const withUnread = await Promise.all(
      rooms.map(async (room) => {
        const unreadCount = await ChatMessageModel.countDocuments({
          roomId: room._id,
          senderId: { $ne: userId },
          readBy: { $ne: userId },
        });
        return { ...room, unreadCount };
      })
    );

    return withUnread;
  },

  /**
   * Lấy chi tiết một phòng chat và kiểm tra quyền truy cập
   */
  async getRoomById(roomId: string, userId: string, companyCode: string): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({
      _id: roomId,
      companyCode,
      "members.userId": userId,
    })
      .populate("members.userId", "displayName photoURL email role status")
      .populate("pinnedMessageIds")
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "displayName photoURL email",
        },
      })
      .exec();

    if (!room) {
      throw new Error("Không tìm thấy phòng chat hoặc bạn không có quyền truy cập.");
    }

    return room;
  },

  /**
   * Lấy hoặc tạo phòng chat 1-1 giữa 2 người dùng trong cùng công ty
   */
  async getOrCreatePrivateRoom(userId: string, targetUserId: string, companyCode: string): Promise<IChatRoom> {
    if (userId === targetUserId) {
      // Trả về phòng Cloud của tôi thay vì quăng lỗi
      let room = await ChatRoomModel.findOne({
        isGroup: false,
        companyCode,
        creatorId: userId,
        $expr: { $eq: [{ $size: "$members" }, 1] },
        "members.userId": userId,
      })
        .populate("members.userId", "displayName photoURL email role status")
        .populate("lastMessage")
        .exec();

      if (!room) {
        const newCloud = new ChatRoomModel({
          isGroup: false,
          name: "Cloud của tôi",
          companyCode,
          creatorId: userId,
          members: [{ userId, role: "admin", joinedAt: new Date() }],
        });
        const savedRoom = await newCloud.save();
        room = await ChatRoomModel.findById(savedRoom._id)
          .populate("members.userId", "displayName photoURL email role status")
          .exec();
      }
      return room!;
    }

    // Kiểm tra người nhận có tồn tại trong cùng công ty không
    const targetUser = await UserModel.findOne({ _id: targetUserId, companyCode }).lean();
    if (!targetUser) {
      throw new Error("Người nhận không tồn tại hoặc không thuộc công ty của bạn.");
    }

    // Tìm xem đã có phòng chat 1-1 chưa
    let room = await ChatRoomModel.findOne({
      isGroup: false,
      companyCode,
      members: {
        $all: [
          { $elemMatch: { userId } },
          { $elemMatch: { userId: targetUserId } }
        ]
      },
      // Đảm bảo chỉ có đúng 2 thành viên
      $expr: { $eq: [{ $size: "$members" }, 2] }
    })
      .populate("members.userId", "displayName photoURL email role status")
      .populate("lastMessage")
      .exec();

    if (!room) {
      // Tạo phòng chat 1-1 mới
      const newRoom = new ChatRoomModel({
        isGroup: false,
        companyCode,
        creatorId: userId,
        members: [
          { userId, role: "admin", joinedAt: new Date() },
          { userId: targetUserId, role: "member", joinedAt: new Date() },
        ],
      });

      const savedRoom = await newRoom.save();
      room = await ChatRoomModel.findById(savedRoom._id)
        .populate("members.userId", "displayName photoURL email role status")
        .exec();
    }

    return room!;
  },

  /**
   * Tạo phòng chat nhóm mới
   */
  async createGroupRoom(
    creatorId: string,
    name: string,
    memberIds: string[],
    companyCode: string,
    avatarURL?: string
  ): Promise<IChatRoom> {
    // Lọc ra các ID hợp lệ và đảm bảo người tạo có trong danh sách
    const uniqueIds = Array.from(new Set([...memberIds, creatorId]));

    // Xác nhận các thành viên thuộc cùng công ty
    const validUsersCount = await UserModel.countDocuments({
      _id: { $in: uniqueIds },
      companyCode,
    });

    if (validUsersCount !== uniqueIds.length) {
      throw new Error("Một số thành viên được chọn không hợp lệ hoặc không thuộc công ty của bạn.");
    }

    // Người tạo nhóm tự động là admin, còn lại là member
    const members = uniqueIds.map((id) => ({
      userId: id,
      role: id === creatorId ? ("admin" as const) : ("member" as const),
      joinedAt: new Date(),
    }));

    const newRoom = new ChatRoomModel({
      name,
      isGroup: true,
      companyCode,
      creatorId,
      members,
      avatarURL: avatarURL || "",
    });

    const savedRoom = await newRoom.save();
    return (await ChatRoomModel.findById(savedRoom._id)
      .populate("members.userId", "displayName photoURL email role status")
      .exec())!;
  },

  /**
   * Cập nhật thông tin nhóm (Chỉ dành cho Admin phòng)
   */
  async updateGroupRoom(
    roomId: string,
    userId: string,
    updateData: { name?: string; avatarURL?: string; onlyAdminsCanMessage?: boolean },
    companyCode: string
  ): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (!room.isGroup) {
      throw new Error("Không thể chỉnh sửa thông tin của cuộc trò chuyện 1-1.");
    }

    // Kiểm tra quyền Admin
    const userMember = room.members.find((m) => m.userId.toString() === userId);
    if (!userMember || userMember.role !== "admin") {
      throw new Error("Chỉ quản trị viên nhóm mới có quyền thay đổi thông tin.");
    }

    if (updateData.name !== undefined) {
      room.name = updateData.name;
    }
    if (updateData.avatarURL !== undefined) {
      room.avatarURL = updateData.avatarURL;
    }
    if (updateData.onlyAdminsCanMessage !== undefined) {
      room.onlyAdminsCanMessage = updateData.onlyAdminsCanMessage;
    }

    await room.save();
    return await chatService.getFullRoom(roomId);
  },

  /**
   * Thêm thành viên vào nhóm (Chỉ Admin phòng được thực hiện)
   */
  async addMembersToGroup(
    roomId: string,
    userId: string,
    newMemberIds: string[],
    companyCode: string
  ): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (!room.isGroup) {
      throw new Error("Không thể thêm thành viên vào cuộc trò chuyện 1-1.");
    }

    // Kiểm tra quyền Admin
    const userMember = room.members.find((m) => m.userId.toString() === userId);
    if (!userMember || userMember.role !== "admin") {
      throw new Error("Chỉ quản trị viên nhóm mới có quyền thêm thành viên.");
    }

    // Lọc ra các ID chưa có trong phòng
    const existingMemberIds = new Set(room.members.map((m) => m.userId.toString()));
    const idsToAdd = Array.from(new Set(newMemberIds)).filter((id) => !existingMemberIds.has(id));

    if (idsToAdd.length === 0) {
      return await chatService.getFullRoom(roomId);
    }

    // Xác nhận các thành viên mới thuộc cùng công ty
    const validUsersCount = await UserModel.countDocuments({
      _id: { $in: idsToAdd },
      companyCode,
    });

    if (validUsersCount !== idsToAdd.length) {
      throw new Error("Một số thành viên cần thêm không hợp lệ hoặc không thuộc công ty.");
    }

    // Thêm các thành viên mới
    idsToAdd.forEach((id) => {
      room.members.push({
        userId: id,
        role: "member",
        joinedAt: new Date(),
      });
    });

    await room.save();
    return await chatService.getFullRoom(roomId);
  },

  /**
   * Xóa thành viên khỏi nhóm (Chỉ Admin phòng được thực hiện)
   */
  async removeMemberFromGroup(
    roomId: string,
    adminId: string,
    targetUserId: string,
    companyCode: string
  ): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (!room.isGroup) {
      throw new Error("Không thể xóa thành viên của cuộc trò chuyện 1-1.");
    }

    // Kiểm tra quyền Admin
    const adminMember = room.members.find((m) => m.userId.toString() === adminId);
    if (!adminMember || adminMember.role !== "admin") {
      throw new Error("Chỉ quản trị viên nhóm mới có quyền xóa thành viên.");
    }

    if (adminId === targetUserId) {
      throw new Error("Không thể tự xóa chính mình bằng chức năng này, vui lòng chọn rời nhóm.");
    }

    // Thực hiện xóa
    room.members = room.members.filter((m) => m.userId.toString() !== targetUserId);
    await room.save();

    return await chatService.getFullRoom(roomId);
  },

  /**
   * Rời khỏi nhóm chat
   */
  async leaveGroup(roomId: string, userId: string, companyCode: string): Promise<IChatRoom | null> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (!room.isGroup) {
      throw new Error("Không thể rời cuộc trò chuyện 1-1.");
    }

    const isMember = room.members.some((m) => m.userId.toString() === userId);
    if (!isMember) {
      throw new Error("Bạn không phải là thành viên trong phòng chat này.");
    }

    // Xóa thành viên
    const leftUserMember = room.members.find((m) => m.userId.toString() === userId);
    room.members = room.members.filter((m) => m.userId.toString() !== userId);

    if (room.members.length === 0) {
      // Không còn ai thì xóa luôn phòng chat và tin nhắn
      await ChatMessageModel.deleteMany({ roomId });
      await ChatRoomModel.findByIdAndDelete(roomId);
      return null;
    }

    // Nếu người rời đi là admin, cấp quyền admin cho người khác
    if (leftUserMember?.role === "admin") {
      const remainingAdmins = room.members.filter((m) => m.role === "admin");
      if (remainingAdmins.length === 0) {
        // Cấp quyền admin cho thành viên gia nhập lâu nhất
        room.members[0].role = "admin";
      }
    }

    await room.save();
    return await chatService.getFullRoom(roomId);
  },

  /**
   * Xóa toàn bộ nhóm chat (Chỉ người tạo/Admin phòng)
   */
  async deleteGroup(roomId: string, adminId: string, companyCode: string): Promise<void> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (!room.isGroup) {
      throw new Error("Không thể xóa cuộc trò chuyện 1-1.");
    }

    // Phải là Admin nhóm
    const userMember = room.members.find((m) => m.userId.toString() === adminId);
    if (!userMember || userMember.role !== "admin") {
      throw new Error("Chỉ quản trị viên nhóm mới được quyền giải tán nhóm.");
    }

    // Xóa tất cả tin nhắn
    await ChatMessageModel.deleteMany({ roomId });
    // Xóa phòng
    await ChatRoomModel.findByIdAndDelete(roomId);
  },

  /**
   * Lưu tin nhắn và cập nhật tin nhắn cuối cùng trong phòng chat
   */
  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    attachments: IChatAttachment[],
    companyCode: string,
    replyTo?: string
  ): Promise<IChatMessage> {
    // Xác thực người gửi có ở trong phòng chat
    const room = await ChatRoomModel.findOne({
      _id: roomId,
      companyCode,
      "members.userId": senderId,
    });

    if (!room) {
      throw new Error("Phòng chat không tồn tại hoặc bạn không phải là thành viên.");
    }

    const sender = await UserModel.findById(senderId).lean();
    if (!sender) {
      throw new Error("Không tìm thấy thông tin tài khoản người gửi.");
    }

    // Tạo tin nhắn mới
    const message = new ChatMessageModel({
      roomId,
      senderId,
      senderName: sender.displayName,
      senderPhoto: sender.photoURL || "",
      content,
      attachments,
      replyTo: replyTo || undefined,
      readBy: [senderId], // Đánh dấu chính người gửi đã đọc
    });

    const savedMessage = await message.save();

    // Cập nhật lastMessage của phòng chat và trigger updatedAt
    room.lastMessage = savedMessage._id;
    // Ghi nhận save để trigger updatedAt
    await room.save();

    return (await ChatMessageModel.findById(savedMessage._id)
      .populate({
        path: "replyTo",
        select: "senderName content attachments isDeleted"
      })
      .exec())!;
  },

  /**
   * Lấy lịch sử tin nhắn của một phòng (Phân trang theo thời gian để cuộn lên)
   */
  async getMessages(
    roomId: string,
    userId: string,
    companyCode: string,
    limit: number = 50,
    beforeDate?: Date
  ): Promise<IChatMessage[]> {
    // Đảm bảo người dùng có quyền trong phòng này
    const room = await ChatRoomModel.findOne({
      _id: roomId,
      companyCode,
      "members.userId": userId,
    });

    if (!room) {
      throw new Error("Phòng chat không tồn tại hoặc bạn không phải là thành viên.");
    }

    const query: any = { roomId };
    if (beforeDate) {
      query.createdAt = { $lt: beforeDate };
    }

    return await ChatMessageModel.find(query)
      .sort({ createdAt: -1 }) // Lấy mới nhất trước
      .limit(limit)
      .populate({
        path: "replyTo",
        select: "senderName content attachments isDeleted"
      })
      .exec();
  },

  /**
   * Đánh dấu các tin nhắn trong phòng đã đọc bởi người dùng
   */
  async markAsRead(roomId: string, userId: string, companyCode: string): Promise<void> {
    const room = await ChatRoomModel.findOne({
      _id: roomId,
      companyCode,
      "members.userId": userId,
    });

    if (!room) {
      throw new Error("Phòng chat không tồn tại hoặc bạn không phải là thành viên.");
    }

    // Thêm userId vào mảng readBy của các tin nhắn chưa có userId đó
    await ChatMessageModel.updateMany(
      { roomId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
  },

  /**
   * Chuyển quyền Trưởng nhóm (Admin) sang thành viên khác
   */
  async transferAdmin(
    roomId: string,
    currentAdminId: string,
    newAdminId: string,
    companyCode: string
  ): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (!room.isGroup) {
      throw new Error("Chức năng này chỉ dành cho phòng chat nhóm.");
    }

    // Kiểm tra người gọi có phải là Admin nhóm
    const callerMember = room.members.find((m) => m.userId.toString() === currentAdminId);
    if (!callerMember || callerMember.role !== "admin") {
      throw new Error("Chỉ Trưởng nhóm mới được quyền chuyển giao vị trí.");
    }

    // Kiểm tra người nhận quyền phải là thành viên trong nhóm
    const targetMember = room.members.find((m) => m.userId.toString() === newAdminId);
    if (!targetMember) {
      throw new Error("Thành viên được chỉ định không tồn tại trong nhóm.");
    }

    // Chuyển quyền: hạ Admin cũ thành member, thăng Member mới lên Admin
    callerMember.role = "member";
    targetMember.role = "admin";

    await room.save();
    return await chatService.getFullRoom(roomId);
  },

  /**
   * Cập nhật vai trò thành viên nhóm (Chỉ Admin nhóm)
   */
  async updateMemberRole(
    roomId: string,
    currentAdminId: string,
    targetUserId: string,
    newRole: "admin" | "member",
    companyCode: string
  ): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (!room.isGroup) {
      throw new Error("Chức năng này chỉ dành cho phòng chat nhóm.");
    }

    // Kiểm tra người gọi có phải là Admin nhóm
    const callerMember = room.members.find((m) => m.userId.toString() === currentAdminId);
    if (!callerMember || callerMember.role !== "admin") {
      throw new Error("Chỉ quản trị viên nhóm mới được quyền thay đổi vai trò.");
    }

    // Kiểm tra người được chỉ định phải ở trong nhóm
    const targetMember = room.members.find((m) => m.userId.toString() === targetUserId);
    if (!targetMember) {
      throw new Error("Thành viên không thuộc nhóm này.");
    }

    if (targetUserId === currentAdminId) {
      throw new Error("Không thể tự thay đổi vai trò của chính mình.");
    }

    targetMember.role = newRole;
    await room.save();

    return await chatService.getFullRoom(roomId);
  },

  /**
   * Ghim tin nhắn trong phòng (Tối đa 3 tin nhắn)
   */
  async pinMessage(
    roomId: string,
    adminId: string,
    messageId: string,
    companyCode: string
  ): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (room.isGroup) {
      const callerMember = room.members.find((m) => m.userId.toString() === adminId);
      if (!callerMember || callerMember.role !== "admin") {
        throw new Error("Chỉ quản trị viên nhóm mới được ghim tin nhắn.");
      }
    } else {
      const isInRoom = room.members.some((m) => m.userId.toString() === adminId);
      if (!isInRoom) {
        throw new Error("Bạn không phải là thành viên cuộc hội thoại này.");
      }
    }

    const message = await ChatMessageModel.findOne({ _id: messageId, roomId });
    if (!message) {
      throw new Error("Tin nhắn không tồn tại trong phòng này.");
    }

    if (!room.pinnedMessageIds) {
      room.pinnedMessageIds = [];
    }

    // Check if already pinned
    const alreadyPinned = room.pinnedMessageIds.some((id) => id.toString() === messageId);
    if (alreadyPinned) {
      throw new Error("Tin nhắn này đã được ghim từ trước.");
    }

    // Check max limit (3)
    if (room.pinnedMessageIds.length >= 3) {
      throw new Error("Chỉ được ghim tối đa 3 tin nhắn. Vui lòng gỡ bớt tin nhắn đã ghim trước đó.");
    }

    room.pinnedMessageIds.push(messageId as any);
    await room.save();

    return await chatService.getFullRoom(roomId);
  },

  /**
   * Bỏ ghim tin nhắn
   */
  async unpinMessage(
    roomId: string,
    adminId: string,
    messageId: string,
    companyCode: string
  ): Promise<IChatRoom> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    if (room.isGroup) {
      const callerMember = room.members.find((m) => m.userId.toString() === adminId);
      if (!callerMember || callerMember.role !== "admin") {
        throw new Error("Chỉ quản trị viên nhóm mới được bỏ ghim tin nhắn.");
      }
    } else {
      const isInRoom = room.members.some((m) => m.userId.toString() === adminId);
      if (!isInRoom) {
        throw new Error("Bạn không phải là thành viên cuộc hội thoại này.");
      }
    }

    if (room.pinnedMessageIds) {
      room.pinnedMessageIds = room.pinnedMessageIds.filter((id) => id.toString() !== messageId);
    }
    await room.save();

    return await chatService.getFullRoom(roomId);
  },

  /**
   * Thu hồi / Xóa tin nhắn (Mềm)
   */
  async deleteMessage(
    roomId: string,
    messageId: string,
    userId: string,
    companyCode: string
  ): Promise<IChatMessage> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    const message = await ChatMessageModel.findOne({ _id: messageId, roomId });
    if (!message) {
      throw new Error("Tin nhắn không tồn tại.");
    }

    // Quyền: người gửi hoặc admin nhóm
    const isSender = message.senderId.toString() === userId;
    const isRoomAdmin = room.members.some((m) => m.userId.toString() === userId && m.role === "admin");

    if (!isSender && !isRoomAdmin) {
      throw new Error("Bạn không có quyền thu hồi tin nhắn này.");
    }

    // Soft delete: clear content, attachments and set isDeleted = true
    message.content = "Tin nhắn đã bị thu hồi";
    message.attachments = [];
    message.isDeleted = true;

    await message.save();
    return message;
  },

  /**
   * Sửa nội dung tin nhắn (chỉ người gửi mới được sửa).
   */
  async editMessage(
    roomId: string,
    messageId: string,
    userId: string,
    companyCode: string,
    content: string
  ): Promise<IChatMessage> {
    const room = await ChatRoomModel.findOne({ _id: roomId, companyCode });
    if (!room) {
      throw new Error("Không tìm thấy phòng chat.");
    }

    const message = await ChatMessageModel.findOne({ _id: messageId, roomId });
    if (!message) {
      throw new Error("Tin nhắn không tồn tại.");
    }
    if (message.isDeleted) {
      throw new Error("Không thể sửa tin nhắn đã thu hồi.");
    }
    if (message.senderId.toString() !== userId) {
      throw new Error("Bạn chỉ có thể sửa tin nhắn của chính mình.");
    }

    const trimmed = String(content || "").trim();
    if (!trimmed) {
      throw new Error("Nội dung tin nhắn không được để trống.");
    }

    message.content = trimmed;
    message.editedAt = new Date();
    await message.save();

    return (await ChatMessageModel.findById(messageId)
      .populate({ path: "replyTo", select: "senderName content attachments isDeleted" })
      .exec())!;
  },

  /**
   * Bật/tắt (toggle) một reaction emoji của người dùng trên một tin nhắn.
   */
  async toggleReaction(
    roomId: string,
    messageId: string,
    userId: string,
    companyCode: string,
    emoji: string
  ): Promise<IChatMessage> {
    // Xác thực người dùng thuộc phòng chat
    const room = await ChatRoomModel.findOne({
      _id: roomId,
      companyCode,
      "members.userId": userId,
    });
    if (!room) {
      throw new Error("Phòng chat không tồn tại hoặc bạn không phải là thành viên.");
    }

    const message = await ChatMessageModel.findOne({ _id: messageId, roomId });
    if (!message) {
      throw new Error("Tin nhắn không tồn tại.");
    }
    if (message.isDeleted) {
      throw new Error("Không thể thả cảm xúc cho tin nhắn đã thu hồi.");
    }

    const reactions = message.reactions || [];
    const existingIdx = reactions.findIndex(
      (r) => r.emoji === emoji && r.userId.toString() === userId
    );

    if (existingIdx >= 0) {
      // Đã thả emoji này → gỡ bỏ (toggle off)
      reactions.splice(existingIdx, 1);
    } else {
      // Chưa thả → thêm mới
      reactions.push({ emoji, userId } as any);
    }

    message.reactions = reactions;
    await message.save();

    return (await ChatMessageModel.findById(messageId)
      .populate({ path: "replyTo", select: "senderName content attachments isDeleted" })
      .exec())!;
  },

  /**
   * Tìm kiếm tin nhắn, liên kết, tệp tin và hình ảnh/video trong phòng chat
   */
  async searchMessages(
    roomId: string,
    userId: string,
    companyCode: string,
    query: string,
    type: "text" | "link" | "file" | "media" | "all" = "all"
  ): Promise<IChatMessage[]> {
    // 1. Kiểm tra phòng chat có tồn tại và người dùng có trong phòng không
    const room = await ChatRoomModel.findOne({
      _id: roomId,
      companyCode,
      "members.userId": userId,
    });

    if (!room) {
      throw new Error("Phòng chat không tồn tại hoặc bạn không có quyền truy cập.");
    }

    // 2. Xây dựng đối tượng truy vấn MongoDB
    const queryObj: any = {
      roomId,
      isDeleted: { $ne: true },
    };

    const cleanQuery = (query || "").trim();

    if (type === "text") {
      if (cleanQuery) {
        queryObj.content = { $regex: cleanQuery, $options: "i" };
      }
    } else if (type === "link") {
      const urlRegex = /https?:\/\/[^\s]+/i;
      if (cleanQuery) {
        queryObj.$and = [
          { content: { $regex: urlRegex } },
          { content: { $regex: cleanQuery, $options: "i" } },
        ];
      } else {
        queryObj.content = { $regex: urlRegex };
      }
    } else if (type === "file") {
      queryObj.attachments = { $exists: true, $not: { $size: 0 } };
      queryObj["attachments.type"] = { $not: { $regex: /^(image|video)\//i } };
      if (cleanQuery) {
        queryObj["attachments.name"] = { $regex: cleanQuery, $options: "i" };
      }
    } else if (type === "media") {
      queryObj.attachments = { $exists: true, $not: { $size: 0 } };
      queryObj["attachments.type"] = { $regex: /^(image|video)\//i };
      if (cleanQuery) {
        queryObj["attachments.name"] = { $regex: cleanQuery, $options: "i" };
      }
    } else {
      // Mặc định "all"
      if (cleanQuery) {
        queryObj.$or = [
          { content: { $regex: cleanQuery, $options: "i" } },
          { "attachments.name": { $regex: cleanQuery, $options: "i" } },
        ];
      }
    }

    // 3. Thực thi truy vấn, sắp xếp mới nhất trước
    return await ChatMessageModel.find(queryObj)
      .sort({ createdAt: -1 })
      .populate({
        path: "replyTo",
        select: "senderName content attachments isDeleted",
      })
      .exec();
  },
};

