import { ProductModel } from "../model/product.model";
import { CategoryModel } from "../model/category.model";
import { StockLogModel } from "../model/stock-log.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { MarketingContentModel } from "../model/marketing-content.model";
import { ProjectModel } from "../model/project.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { TrainingEnrollmentModel } from "../model/training-enrollment.model";
import { UserModel } from "../model/user.model";
import { SocialIntegrationModel } from "../model/social-integration.model";
import { WorkflowModel } from "../model/workflow.model";
import { HRCalendarEventModel } from "../model/hr-calendar-event.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { SupportedModelName, ICRUDQueryOptions } from "../interface/crud.interface";
import mongoose from "mongoose";
import { facebookPostService } from "./facebook-post.service";
import { zaloMessengerService } from "./zalo-messenger.service";
import { telegramService } from "./telegram.service";
import { workflowLinkService } from "./workflow-link.service";

const DEMO_VIDEO_URL_PATTERNS = [
  "w3schools.com/html/mov_bbb.mp4",
  "example.com/video.mp4",
  "example.com/videos/"
];

function stripDemoVideoUrl(videoUrl?: string | null) {
  const value = String(videoUrl || "").trim();
  if (!value) return videoUrl;
  const normalized = value.toLowerCase();
  return DEMO_VIDEO_URL_PATTERNS.some((pattern) => normalized.includes(pattern)) ? "" : videoUrl;
}

function sanitizeMarketingPayload(modelName: string, payload: any) {
  if (modelName !== "marketing-contents" || !payload || typeof payload !== "object") {
    return payload;
  }
  if (!Object.prototype.hasOwnProperty.call(payload, "videoUrl")) {
    return payload;
  }
  return {
    ...payload,
    videoUrl: stripDemoVideoUrl(payload.videoUrl),
  };
}

function sanitizeInventoryPayload(modelName: string, payload: any) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (modelName === "products") {
    return {
      ...payload,
      sku: typeof payload.sku === "string" ? payload.sku.trim().toUpperCase() : payload.sku,
      name: typeof payload.name === "string" ? payload.name.trim() : payload.name,
      category: typeof payload.category === "string" ? payload.category.trim() : payload.category,
      brand: typeof payload.brand === "string" ? payload.brand.trim() : (payload.brand ?? ""),
      unit: typeof payload.unit === "string" ? payload.unit.trim() : payload.unit,
      description: typeof payload.description === "string" ? payload.description.trim() : (payload.description ?? ""),
      imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : (payload.imageUrl ?? ""),
    };
  }

  if (modelName === "categories") {
    return {
      ...payload,
      name: typeof payload.name === "string" ? payload.name.trim() : payload.name,
      code: typeof payload.code === "string" ? payload.code.trim().toUpperCase() : payload.code,
      description: typeof payload.description === "string" ? payload.description.trim() : payload.description,
    };
  }

  if (modelName === "stock-logs") {
    const normalizedCreatedAt =
      payload.createdAt instanceof Date
        ? payload.createdAt
        : typeof payload.createdAt === "string" || typeof payload.createdAt === "number"
          ? new Date(payload.createdAt)
          : undefined;

    const hasValidCreatedAt = normalizedCreatedAt instanceof Date && !Number.isNaN(normalizedCreatedAt.getTime());

    return {
      ...payload,
      createdAt: hasValidCreatedAt ? normalizedCreatedAt : undefined,
    };
  }

  return payload;
}

function sanitizeInventoryResult(modelName: string, item: any) {
  if (!item) {
    return item;
  }

  const plainItem = typeof item.toObject === "function" ? item.toObject() : item;

  if (modelName === "products") {
    return {
      ...plainItem,
      sku: typeof plainItem.sku === "string" ? plainItem.sku.trim().toUpperCase() : plainItem.sku,
      name: typeof plainItem.name === "string" ? plainItem.name.trim() : plainItem.name,
      category: typeof plainItem.category === "string" ? plainItem.category.trim() : plainItem.category,
      brand: typeof plainItem.brand === "string" ? plainItem.brand.trim() : "",
      unit: typeof plainItem.unit === "string" ? plainItem.unit.trim() : plainItem.unit,
      description: typeof plainItem.description === "string" ? plainItem.description.trim() : "",
      imageUrl: typeof plainItem.imageUrl === "string" ? plainItem.imageUrl.trim() : "",
    };
  }

  if (modelName === "categories") {
    return {
      ...plainItem,
      name: typeof plainItem.name === "string" ? plainItem.name.trim() : plainItem.name,
      code: typeof plainItem.code === "string" ? plainItem.code.trim().toUpperCase() : plainItem.code,
      description: typeof plainItem.description === "string" ? plainItem.description.trim() : "",
      colorClass: typeof plainItem.colorClass === "string" ? plainItem.colorClass.trim() : "bg-blue-50 text-blue-700 border-blue-100",
      status: typeof plainItem.status === "string" ? plainItem.status.trim() : "Đang dùng",
    };
  }

  if (modelName === "stock-logs") {
    const normalizedCreatedAt =
      plainItem.createdAt instanceof Date
        ? plainItem.createdAt
        : typeof plainItem.createdAt === "string" || typeof plainItem.createdAt === "number"
          ? new Date(plainItem.createdAt)
          : null;

    return {
      ...plainItem,
      title: typeof plainItem.title === "string" ? plainItem.title.trim() : "",
      items: Array.isArray(plainItem.items)
        ? plainItem.items.map((entry: any) => ({
            productId: typeof entry?.productId === "string" ? entry.productId : "",
            sku: typeof entry?.sku === "string" ? entry.sku.trim().toUpperCase() : "",
            productName: typeof entry?.productName === "string" ? entry.productName.trim() : "",
            quantity: typeof entry?.quantity === "number" ? entry.quantity : Number(entry?.quantity || 0),
          }))
        : [],
      operatorName: typeof plainItem.operatorName === "string" ? plainItem.operatorName.trim() : "",
      notes: typeof plainItem.notes === "string" ? plainItem.notes.trim() : "",
      sku: typeof plainItem.sku === "string" ? plainItem.sku.trim().toUpperCase() : plainItem.sku,
      productName: typeof plainItem.productName === "string" ? plainItem.productName.trim() : plainItem.productName,
      createdAt:
        normalizedCreatedAt instanceof Date && !Number.isNaN(normalizedCreatedAt.getTime())
          ? normalizedCreatedAt.toISOString()
          : new Date().toISOString(),
    };
  }

  return plainItem;
}

function sanitizeMarketingResult(modelName: string, item: any) {
  if (modelName !== "marketing-contents" || !item) {
    return item;
  }
  const plainItem = typeof item.toObject === "function" ? item.toObject() : item;
  return sanitizeMarketingPayload(modelName, plainItem);
}

function sanitizeCrudResult(modelName: string, item: any) {
  const inventoryItem = sanitizeInventoryResult(modelName, item);
  return sanitizeMarketingResult(modelName, inventoryItem);
}

async function handlePendingVideoUrl(item: any, modelName: string) {
  if (modelName === "marketing-contents" && item && item.videoUrl && item.videoUrl.startsWith("pending://piapi/")) {
    const taskId = item.videoUrl.replace("pending://piapi/", "");
    try {
      const { AIMediaModel } = require("../model/ai-media.model");
      const { geminiService } = require("./gemini.service");
      
      const existingRecord = await AIMediaModel.findOne({ url: item.videoUrl });
      if (!existingRecord) {
        const record = await AIMediaModel.create({
          userId: item.authorUid,
          mediaType: "video",
          url: item.videoUrl,
          prompt: item.mediaPrompt || item.title,
          metadata: {
            status: "processing",
            progress: 10,
            provider: "piapi",
            title: `Video Auto-pilot: ${item.title}`,
            description: `Đang kết xuất video tự động bằng PiAPI.`,
            aspectRatio: "16:9",
            activeCardId: item._id.toString()
          }
        });

        // Trigger background polling immediately
        geminiService.pollPiAPIVideoStatusBackground(record._id.toString(), taskId, item.authorUid);
        console.log(`[crudService] Triggered background polling for pending video task ${taskId} on card ${item._id}`);
      }
    } catch (err) {
      console.error("[crudService] Failed to register pending video poll:", err);
    }
  }
}

async function validateSocialIntegrationPayload(payload: any) {
  if (!payload || typeof payload !== "object" || payload.isConnected === false || payload.isMock === true) {
    return;
  }

  const platform = String(payload.platform || "").trim();
  const username = String(payload.username || "").trim();
  const accessToken = String(payload.accessToken || "").trim();

  if (accessToken.startsWith("mock_") || accessToken === "EAA...") {
    console.log(`[validateSocialIntegrationPayload] Bỏ qua xác thực cho Access Token mock: ${accessToken}`);
    return;
  }

  if (platform === "Facebook") {
    if (!username || !accessToken) {
      throw new Error("Facebook company integration yeu cau Page ID va Page Access Token.");
    }
    await facebookPostService.validateToken(username, accessToken);
    return;
  }

  if (platform === "Zalo") {
    if (!username || !accessToken) {
      throw new Error("Zalo company integration yeu cau OA ID va Access Token.");
    }
    await zaloMessengerService.validateIntegrationToken({
      oaId: username,
      oaName: payload.displayName,
      accessToken,
    });
  }
}

const MODEL_MAPPING: Record<SupportedModelName, mongoose.Model<any>> = {
  "products": ProductModel,
  "categories": CategoryModel,
  "stock-logs": StockLogModel,
  "crm-tickets": CRMTicketModel,
  "marketing-contents": MarketingContentModel,
  "projects": ProjectModel,
  "kanban-tasks": KanbanTaskModel,
  "training-courses": TrainingCourseModel,
  "training-enrollments": TrainingEnrollmentModel,
  "social-integrations": SocialIntegrationModel,
  "workflows": WorkflowModel,
  "users": UserModel,
  "hr-calendar-events": HRCalendarEventModel,
  "timekeeping-logs": TimekeepingLogModel,
};

export const crudService = {
  /**
   * Lấy danh sách tài nguyên kèm phân trang, lọc và cô lập companyCode
   */
  async getList(
    modelName: SupportedModelName,
    companyCode: string,
    options: ICRUDQueryOptions,
    userRole: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = {};
    
    // Cô lập dữ liệu theo companyCode (Trừ superadmin được xem tất cả nếu chọn)
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }

    // Áp dụng các bộ lọc động truyền từ client
    if (options.filters) {
      Object.assign(query, options.filters);
    }

    // Áp dụng tìm kiếm tương đối (Search)
    if (options.search) {
      const searchRegex = new RegExp(options.search, "i");
      query.$or = [
        { name: searchRegex },
        { title: searchRegex },
        { customerName: searchRegex },
        { sku: searchRegex }
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 1000;
    const skip = (page - 1) * limit;
    const sort = options.sort || "-_id";

    const items = await model.find(query).sort(sort).skip(skip).limit(limit).lean();
    const total = await model.countDocuments(query);

    return {
      items: items.map((item) => sanitizeCrudResult(modelName, item)),
      total,
      page,
      limit,
    };
  },

  /**
   * Lấy chi tiết tài nguyên theo ID
   */
  async getById(
    modelName: SupportedModelName,
    id: string,
    companyCode: string,
    userRole: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = { _id: id };
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }

    const item = await model.findOne(query).lean();
    if (!item) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền truy cập.");
    }
    return sanitizeCrudResult(modelName, item);
  },

  /**
   * Tạo mới tài nguyên
   */
  async create(
    modelName: SupportedModelName,
    data: any,
    companyCode: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    // Ép buộc gán companyCode để bảo mật dữ liệu doanh nghiệp
    const payload = sanitizeMarketingPayload(modelName, {
      ...sanitizeInventoryPayload(modelName, data),
      companyCode,
    });

    if (modelName === "social-integrations") {
      await validateSocialIntegrationPayload(payload);
    }

    const newItem = new model(payload);
    await newItem.save();

    if (modelName === "crm-tickets" && newItem.status === "won") {
      telegramService.sendLeadWonNotification(newItem).catch((err) => {
        console.error("[crudService.create] Error sending Telegram notification:", err);
      });
    }

    if (modelName === "products" && newItem) {
      const stock = Number(newItem.stock || 0);
      const minStockAlert = Number(newItem.minStockAlert || 15);
      if (stock <= minStockAlert) {
        telegramService.sendLowStockAlert(newItem).catch((err) => {
          console.error("[crudService.create] Error sending low stock alert:", err);
        });
      }
    }

    handlePendingVideoUrl(newItem, modelName).catch((err) => {
      console.error("[crudService.create] error in handlePendingVideoUrl:", err);
    });

    return sanitizeCrudResult(modelName, newItem);
  },

  /**
   * Cập nhật tài nguyên theo ID
   */
  async update(
    modelName: SupportedModelName,
    id: string,
    data: any,
    companyCode: string,
    userRole: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = { _id: id };
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }

    // Loại bỏ các trường nhạy cảm không cho phép đè trực tiếp
    const { companyCode: _cCode, _id: _itemId, id: _plainId, ...rawUpdatePayload } = data;
    const updatePayload = sanitizeMarketingPayload(
      modelName,
      sanitizeInventoryPayload(modelName, rawUpdatePayload)
    );

    if (modelName === "social-integrations") {
      const existingItem = await model.findOne(query).lean();
      if (!existingItem) {
        throw new Error("Khong tim thay tai nguyen hoac ban khong co quyen chinh sua.");
      }
      await validateSocialIntegrationPayload({
        ...existingItem,
        ...updatePayload,
      });
    }

    let oldStatus = "";
    if (modelName === "crm-tickets" && updatePayload.status === "won") {
      const oldItem = await model.findOne(query).select("status").lean();
      if (oldItem) {
        oldStatus = oldItem.status;
      }
    }

    const updatedItem = await model.findOneAndUpdate(query, updatePayload, { new: true });
    if (!updatedItem) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền chỉnh sửa.");
    }

    if (modelName === "crm-tickets" && updatePayload.status === "won" && oldStatus !== "won") {
      telegramService.sendLeadWonNotification(updatedItem).catch((err) => {
        console.error("[crudService.update] Error sending Telegram notification:", err);
      });
    }

    if (modelName === "products" && updatedItem) {
      const stock = Number(updatedItem.stock || 0);
      const minStockAlert = Number(updatedItem.minStockAlert || 15);
      if (stock <= minStockAlert) {
        telegramService.sendLowStockAlert(updatedItem).catch((err) => {
          console.error("[crudService.update] Error sending low stock alert:", err);
        });
      }
    }

    handlePendingVideoUrl(updatedItem, modelName).catch((err) => {
      console.error("[crudService.update] error in handlePendingVideoUrl:", err);
    });

    // Task Kanban thuộc quy trình đổi trạng thái → đồng bộ ngược về Quy trình
    if (modelName === "kanban-tasks" && updatedItem) {
      workflowLinkService.handleTaskStatusChange(updatedItem).catch((err) => {
        console.error("[crudService.update] Error syncing workflow from kanban task:", err);
      });
    }

    return sanitizeCrudResult(modelName, updatedItem);
  },

  /**
   * Xóa tài nguyên theo ID
   */
  async delete(
    modelName: SupportedModelName,
    id: string,
    companyCode: string,
    userRole: string
  ) {
    const model = MODEL_MAPPING[modelName];
    if (!model) {
      throw new Error(`Model '${modelName}' không được hỗ trợ.`);
    }

    const query: any = { _id: id };
    if (userRole !== "superadmin" || (companyCode && companyCode !== "SYSTEM")) {
      query.companyCode = companyCode;
    }

    const deletedItem = await model.findOneAndDelete(query);
    if (!deletedItem) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền xóa.");
    }

    // Xóa quy trình → lưu trữ các task Kanban chưa xong đã sinh từ quy trình đó
    if (modelName === "workflows") {
      workflowLinkService
        .archiveWorkflowTasks(deletedItem.companyCode || companyCode, id)
        .catch((err) => {
          console.error("[crudService.delete] Error archiving workflow tasks:", err);
        });
    }

    return deletedItem;
  },
};
