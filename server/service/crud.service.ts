import { ProductModel } from "../model/product.model";
import { CategoryModel } from "../model/category.model";
import { StockLogModel } from "../model/stock-log.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { MarketingContentModel } from "../model/marketing-content.model";
import { ProjectModel } from "../model/project.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { TrainingEnrollmentModel } from "../model/training-enrollment.model";
import { SupportedModelName, ICRUDQueryOptions } from "../interface/crud.interface";
import mongoose from "mongoose";

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
      items,
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
    return item;
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
    const payload = {
      ...data,
      companyCode,
    };

    const newItem = new model(payload);
    await newItem.save();
    return newItem;
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
    const { companyCode: _cCode, _id: _itemId, id: _plainId, ...updatePayload } = data;

    const updatedItem = await model.findOneAndUpdate(query, updatePayload, { new: true });
    if (!updatedItem) {
      throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền chỉnh sửa.");
    }
    return updatedItem;
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
