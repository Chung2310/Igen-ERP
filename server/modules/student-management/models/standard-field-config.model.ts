import { Schema, model } from "mongoose";
import { MODULE_KEYS, type ModuleKey } from "../interfaces/custom-field.interface";

/**
 * Tùy biến của công ty trên các trường CÓ SẴN của form (khác với CustomFieldDefinition
 * là các trường do người dùng tự thêm). Chỉ lưu phần ghi đè: nhãn, placeholder,
 * bắt buộc, ẩn/hiện, lưu trữ — còn danh sách trường gốc vẫn do frontend định nghĩa.
 *
 * Trước đây cấu hình này nằm trong localStorage nên mỗi máy một kiểu và trang đăng ký
 * công khai (không đăng nhập) không thể đọc được.
 */
export interface IStandardFieldConfig {
  tenantId: string;
  moduleKey: ModuleKey;
  key: string;
  label: string;
  placeholder?: string;
  isRequired: boolean;
  isVisible: boolean;
  isArchived: boolean;
  updatedBy: string;
}

export const standardFieldConfigSchema = new Schema<IStandardFieldConfig>(
  {
    tenantId: { type: String, required: true, trim: true },
    moduleKey: { type: String, required: true, enum: MODULE_KEYS },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    placeholder: { type: String, trim: true },
    isRequired: { type: Boolean, required: true, default: false },
    isVisible: { type: Boolean, required: true, default: true },
    isArchived: { type: Boolean, required: true, default: false },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

standardFieldConfigSchema.index({ tenantId: 1, moduleKey: 1, key: 1 }, { unique: true });

export const StandardFieldConfig = model<IStandardFieldConfig>(
  "StudentStandardFieldConfig",
  standardFieldConfigSchema,
);
