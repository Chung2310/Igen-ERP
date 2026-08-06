import { BatchProgressSetting } from "../models/batch-progress-setting.model";

export type BatchProgressColors = { green: string; yellow: string; red: string; black: string };

export const DEFAULT_BATCH_PROGRESS_COLORS: BatchProgressColors = {
  green: "#059669", yellow: "#d97706", red: "#e11d48", black: "#020617",
};

export class BatchProgressSettingService {
  static async get(ownerIds: string | string[], branchId?: string): Promise<BatchProgressColors> {
    const ownerId = Array.isArray(ownerIds) ? ownerIds[0] : ownerIds;
    if (!ownerId) return DEFAULT_BATCH_PROGRESS_COLORS;
    const setting = await BatchProgressSetting.findOne({ ownerId, branchId }).lean();
    return setting ? { green: setting.green, yellow: setting.yellow, red: setting.red, black: setting.black } : DEFAULT_BATCH_PROGRESS_COLORS;
  }

  static async update(ownerIds: string | string[], branchId: string | undefined, colors: BatchProgressColors): Promise<BatchProgressColors> {
    const ownerId = Array.isArray(ownerIds) ? ownerIds[0] : ownerIds;
    if (!ownerId) throw new Error("Không xác định được doanh nghiệp để lưu màu tiến độ.");
    const setting = await BatchProgressSetting.findOneAndUpdate(
      { ownerId, branchId },
      { $set: colors, $setOnInsert: { ownerId, branchId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return { green: setting.green, yellow: setting.yellow, red: setting.red, black: setting.black };
  }
}
