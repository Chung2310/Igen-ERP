import { CustomerError } from "../customer-errors";
import type { ICustomerTier } from "../interfaces/customer-settings.interface";
import { CustomerSettingsModel } from "../models/customer-settings.model";

export const DEFAULT_CUSTOMER_TIERS: ICustomerTier[] = [
  { code: "standard", name: "Thành viên", minSpend: 0 },
  { code: "silver", name: "Bạc", minSpend: 5_000_000 },
  { code: "gold", name: "Vàng", minSpend: 20_000_000 },
  { code: "vip", name: "VIP", minSpend: 50_000_000 },
];

export const CustomerSettingsService = {
  async getSettings(companyCode: string) {
    const code = companyCode.toUpperCase().trim();
    const settings = await CustomerSettingsModel.findOne({ companyCode: code }).lean();
    if (!settings) {
      return {
        companyCode: code,
        customerTiers: DEFAULT_CUSTOMER_TIERS,
      };
    }
    return settings;
  },

  async updateSettings(companyCode: string, tiers: ICustomerTier[]) {
    const code = companyCode.toUpperCase().trim();

    // Validate customer tiers constraints
    if (!Array.isArray(tiers) || tiers.length === 0) {
      throw new CustomerError("INVALID_TIERS", "Danh sách phân hạng không được để trống.", 400);
    }

    // Sort tiers by minSpend to make sure order is correct
    const sortedTiers = [...tiers].sort((a, b) => a.minSpend - b.minSpend);

    if (sortedTiers[0].minSpend !== 0) {
      throw new CustomerError("INVALID_TIERS_START", "Hạng thấp nhất phải có mức chi tiêu bắt đầu từ 0.", 400);
    }

    // Check duplicates and increasing order
    const seenCodes = new Set<string>();
    const seenNames = new Set<string>();
    let lastSpend = -1;

    for (const tier of sortedTiers) {
      const tierCode = String(tier.code || "").trim().toLowerCase();
      const name = String(tier.name || "").trim();
      const minSpend = Number(tier.minSpend);

      if (!/^[a-z0-9-]{1,30}$/.test(tierCode)) {
        throw new CustomerError("INVALID_TIER_CODE", `Mã hạng '${tier.code}' không hợp lệ. Chỉ cho phép chữ thường, số và dấu gạch ngang.`, 400);
      }
      if (!name || name.length > 50) {
        throw new CustomerError("INVALID_TIER_NAME", "Tên hạng không được để trống và tối đa 50 ký tự.", 400);
      }
      if (seenCodes.has(tierCode)) {
        throw new CustomerError("DUPLICATE_TIER_CODE", `Mã hạng '${tierCode}' bị trùng lặp.`, 400);
      }
      if (seenNames.has(name)) {
        throw new CustomerError("DUPLICATE_TIER_NAME", `Tên hạng '${name}' bị trùng lặp.`, 400);
      }
      if (minSpend <= lastSpend) {
        throw new CustomerError("INVALID_TIERS_ORDER", "Mức chi tiêu tối thiểu của các hạng tiếp theo phải lớn hơn hạng trước đó.", 400);
      }

      seenCodes.add(tierCode);
      seenNames.add(name);
      lastSpend = minSpend;
    }

    const updated = await CustomerSettingsModel.findOneAndUpdate(
      { companyCode: code },
      { $set: { customerTiers: sortedTiers } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return updated;
  },
};
