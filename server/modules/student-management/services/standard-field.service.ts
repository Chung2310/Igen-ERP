import type { ModuleKey } from "../interfaces/custom-field.interface";
import { StandardFieldConfig } from "../models/standard-field-config.model";

export type StandardFieldOverride = {
  key: string;
  label: string;
  placeholder?: string;
  isRequired: boolean;
  isVisible: boolean;
  isArchived: boolean;
};

export type StandardFieldContext = { tenantId: string; actorId: string };

export class StandardFieldService {
  async list(tenantId: string, moduleKey: ModuleKey): Promise<StandardFieldOverride[]> {
    const rows = await StandardFieldConfig.find({ tenantId, moduleKey }).lean();
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      placeholder: row.placeholder,
      isRequired: row.isRequired,
      isVisible: row.isVisible,
      isArchived: row.isArchived,
    }));
  }

  /**
   * Thay toàn bộ cấu hình của module: mỗi lần lưu, frontend gửi lên trọn danh sách
   * trường đang hiển thị, nên các key không còn trong danh sách là đã bị xóa hẳn.
   */
  async replace(
    context: StandardFieldContext,
    moduleKey: ModuleKey,
    fields: StandardFieldOverride[],
  ): Promise<StandardFieldOverride[]> {
    const { tenantId, actorId } = context;
    const keptKeys = fields.map((field) => field.key);

    await StandardFieldConfig.deleteMany({ tenantId, moduleKey, key: { $nin: keptKeys } });

    if (fields.length > 0) {
      await StandardFieldConfig.bulkWrite(
        fields.map((field) => ({
          updateOne: {
            filter: { tenantId, moduleKey, key: field.key },
            update: {
              $set: {
                label: field.label,
                placeholder: field.placeholder ?? "",
                // Trường đã ẩn thì không thể còn là bắt buộc, nếu không form sẽ
                // chặn lưu vì một trường người dùng không nhìn thấy.
                isRequired: field.isVisible ? field.isRequired : false,
                isVisible: field.isVisible,
                isArchived: field.isArchived,
                updatedBy: actorId,
              },
            },
            upsert: true,
          },
        })),
      );
    }

    return this.list(tenantId, moduleKey);
  }
}
