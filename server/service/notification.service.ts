import { NotificationModel } from "../model/notification.model";
import { INotification, NotifType } from "../interface/notification.interface";
import { UserModel } from "../model/user.model";
import { emitToUser } from "../socket";

export const notificationService = {
  /**
   * Lấy danh sách thông báo phân trang của người dùng
   */
  async getNotifications(
    recipientUid: string,
    companyCode: string,
    query: { page?: number; limit?: number; read?: boolean; type?: NotifType }
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: any = {
      recipientUid,
      companyCode,
    };

    if (query.read !== undefined) {
      filter.read = query.read;
    }

    if (query.type) {
      filter.type = query.type;
    }

    const items = await NotificationModel.find(filter)
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await NotificationModel.countDocuments(filter);
    const unreadCount = await NotificationModel.countDocuments({
      recipientUid,
      companyCode,
      read: false,
    });

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
    };
  },

  /**
   * Tạo một thông báo mới và phát qua Socket.io
   */
  async createNotification(data: Partial<INotification>) {
    const notification = new NotificationModel(data);
    await notification.save();

    // Phát socket thời gian thực cho người nhận
    if (notification.recipientUid) {
      emitToUser(
        notification.recipientUid.toString(),
        "new_notification",
        notification.toObject()
      );
    }

    return notification;
  },

  /**
   * Đánh dấu một thông báo đã đọc
   */
  async markAsRead(id: string, recipientUid: string) {
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: id, recipientUid },
      { read: true },
      { returnDocument: "after" }
    );
    if (!notification) {
      throw new Error("Không tìm thấy thông báo hoặc bạn không có quyền cập nhật.");
    }
    return notification;
  },

  /**
   * Đánh dấu tất cả thông báo của người dùng là đã đọc
   */
  async markAllAsRead(recipientUid: string, companyCode: string) {
    await NotificationModel.updateMany(
      { recipientUid, companyCode, read: false },
      { read: true }
    );
    return { success: true };
  },

  /**
   * Xóa thông báo
   */
  async deleteNotification(id: string, recipientUid: string) {
    const result = await NotificationModel.findOneAndDelete({ _id: id, recipientUid });
    if (!result) {
      throw new Error("Không tìm thấy thông báo hoặc bạn không có quyền xóa.");
    }
    return result;
  },

  /**
   * Cảnh báo tồn kho: gửi tới tất cả Admin & Manager của công ty
   */
  async notifyLowStock(product: { companyCode: string; name: string; stock: number; sku?: string }) {
    try {
      const managers = await UserModel.find({
        companyCode: product.companyCode,
        role: { $in: ["admin", "manager"] },
      })
        .select("_id")
        .lean();

      if (!managers || managers.length === 0) return;

      const title = `⚠️ Cảnh báo tồn kho: ${product.name}`;
      const body = `Sản phẩm "${product.name}"${product.sku ? ` (SKU: ${product.sku})` : ""} hiện chỉ còn ${product.stock} sản phẩm trong kho, dưới định mức cảnh báo. Vui lòng kiểm tra và nhập hàng.`;

      const notificationPromises = managers.map((m) =>
        this.createNotification({
          title,
          body,
          type: "kho",
          companyCode: product.companyCode,
          recipientUid: m._id.toString(),
          read: false,
          action: {
            tab: "KHO & SẢN PHẨM",
            subTab: "DỰ BÁO AI",
          },
        })
      );

      await Promise.all(notificationPromises);
      console.log(`[notificationService] Gửi thông báo hết hàng cho ${managers.length} quản lý.`);
    } catch (error) {
      console.error("[notificationService.notifyLowStock] Lỗi:", error);
    }
  },

  /**
   * Giao việc mới: gửi tới người được nhận task
   */
  async notifyTaskAssigned(task: {
    companyCode: string;
    title: string;
    assigneeUid: string;
    assignee: string;
    creatorUid: string;
  }) {
    try {
      // Không thông báo nếu tự giao việc cho chính mình
      if (task.assigneeUid === task.creatorUid) return;

      const title = `📋 Công việc mới được giao`;
      const body = `Bạn được giao công việc "${task.title}". Vui lòng kiểm tra tiến độ và thực hiện.`;

      await this.createNotification({
        title,
        body,
        type: "task",
        companyCode: task.companyCode,
        recipientUid: task.assigneeUid,
        read: false,
        action: {
          tab: "NHÂN SỰ",
          subTab: "Giao Việc",
        },
      });
      console.log(`[notificationService] Đã gửi thông báo giao việc mới cho User ID: ${task.assigneeUid}`);
    } catch (error) {
      console.error("[notificationService.notifyTaskAssigned] Lỗi:", error);
    }
  },

  /**
   * Giao khóa đào tạo mới: gửi tới học viên được gán
   */
  async notifyTaskReassigned(task: any, previousAssigneeUid?: string) {
    if (!task.assigneeUid || task.assigneeUid === previousAssigneeUid) return;
    await this.createNotification({
      title: "Công việc được giao lại",
      body: `Bạn được giao công việc "${task.title}". Hạn chót: ${new Date(task.dueDate).toLocaleString("vi-VN")}.`,
      type: "task", companyCode: task.companyCode, recipientUid: task.assigneeUid, read: false,
      action: { tab: "NHÂN SỰ", subTab: "Giao Việc" },
    });
  },

  async notifyTaskDeadlineChanged(task: any) {
    if (!task.assigneeUid) return;
    await this.createNotification({
      title: "Hạn chót công việc đã thay đổi",
      body: `Công việc "${task.title}" có hạn mới: ${new Date(task.dueDate).toLocaleString("vi-VN")}.`,
      type: "task", companyCode: task.companyCode, recipientUid: task.assigneeUid, read: false,
      action: { tab: "NHÂN SỰ", subTab: "Giao Việc" },
    });
  },

  async notifyTaskStatusChanged(task: any, actorUid: string) {
    const recipients = new Set<string>();
    if (task.creatorUid && task.creatorUid !== actorUid) recipients.add(task.creatorUid);
    if (task.assigneeUid && task.assigneeUid !== actorUid) recipients.add(task.assigneeUid);
    const labels: Record<string, string> = {
      "Not Started": "Chưa làm", "In Progress": "Đang làm",
      "Review/Testing": "Chờ kiểm tra", Done: "Hoàn thành", Archived: "Lưu trữ",
    };
    await Promise.all(Array.from(recipients).map((recipientUid) => this.createNotification({
      title: "Trạng thái công việc thay đổi",
      body: `Công việc "${task.title}" chuyển sang "${labels[task.status] || task.status}".`,
      type: "task", companyCode: task.companyCode, recipientUid, read: false,
      action: { tab: "NHÂN SỰ", subTab: "Giao Việc" },
    })));
  },

  async notifyCourseAssigned(
    enrollment: { companyCode: string; uid: string },
    courseTitle: string
  ) {
    try {
      const title = `🎓 Khóa học đào tạo mới`;
      const body = `Bạn được gán khóa đào tạo mới: "${courseTitle}". Hãy tham gia học tập để nâng cao kiến thức.`;

      await this.createNotification({
        title,
        body,
        type: "training",
        companyCode: enrollment.companyCode,
        recipientUid: enrollment.uid,
        read: false,
        action: {
          tab: "NHÂN SỰ",
          subTab: "ĐÀO TẠO",
        },
      });
      console.log(`[notificationService] Đã gửi thông báo gán khóa học mới cho User ID: ${enrollment.uid}`);
    } catch (error) {
      console.error("[notificationService.notifyCourseAssigned] Lỗi:", error);
    }
  },
};
