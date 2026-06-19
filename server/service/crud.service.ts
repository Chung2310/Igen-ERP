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
import { SupportedModelName, ICRUDQueryOptions } from "../interface/crud.interface";
import mongoose from "mongoose";

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

function sanitizeMarketingResult(modelName: string, item: any) {
  if (modelName !== "marketing-contents" || !item) {
    return item;
  }
  const plainItem = typeof item.toObject === "function" ? item.toObject() : item;
  return sanitizeMarketingPayload(modelName, plainItem);
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
  "users": UserModel,
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
    const sort = options.sort || "-createdAt";

    const items = await model.find(query).sort(sort).skip(skip).limit(limit).lean();
    const total = await model.countDocuments(query);

    return {
      items: items.map((item) => sanitizeMarketingResult(modelName, item)),
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
    return sanitizeMarketingResult(modelName, item);
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
      ...data,
      companyCode,
    });

    const newItem = new model(payload);
    await newItem.save();

    handlePendingVideoUrl(newItem, modelName).catch((err) => {
      console.error("[crudService.create] error in handlePendingVideoUrl:", err);
    });

    return sanitizeMarketingResult(modelName, newItem);
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
    const updatePayload = sanitizeMarketingPayload(modelName, rawUpdatePayload);

    const updatedItem = await model.findOneAndUpdate(query, updatePayload, { new: true });
    if (!updatedItem) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền chỉnh sửa.");
    }

    handlePendingVideoUrl(updatedItem, modelName).catch((err) => {
      console.error("[crudService.update] error in handlePendingVideoUrl:", err);
    });

    return sanitizeMarketingResult(modelName, updatedItem);
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
    return deletedItem;
  },
};
