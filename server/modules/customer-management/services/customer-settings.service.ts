import { CustomerError } from "../customer-errors";
import type { ICustomerSettings, ICustomerTier } from "../interfaces/customer-settings.interface";
import { CustomerSettingsModel, DEFAULT_CUSTOMER_TIERS, DEFAULT_POINTS_POLICY } from "../models/customer-settings.model";

export { DEFAULT_CUSTOMER_TIERS };

export const CustomerSettingsService = {
  async getSettings(companyCode: string): Promise<ICustomerSettings> {
    const code = companyCode.toUpperCase().trim();
    const settings = await CustomerSettingsModel.findOne({ companyCode: code }).lean();
    if (!settings) {
      return {
        companyCode: code,
        tierEvaluationMetric: "gross_profit",
        evaluationWindow: "rolling12Months",
        customerTiers: DEFAULT_CUSTOMER_TIERS,
        pointsPolicy: { ...DEFAULT_POINTS_POLICY },
      };
    }
    return {
      ...settings,
      customerTiers: settings.customerTiers?.length ? settings.customerTiers : DEFAULT_CUSTOMER_TIERS,
      pointsPolicy: settings.pointsPolicy || { ...DEFAULT_POINTS_POLICY },
      tierEvaluationMetric: settings.tierEvaluationMetric || "gross_profit",
      evaluationWindow: settings.evaluationWindow || "rolling12Months",
    };
  },

  async updateSettings(
    companyCode: string,
    payload: {
      customerTiers: ICustomerTier[];
      pointsPolicy?: any;
      tierEvaluationMetric?: "gross_profit" | "sales";
      evaluationWindow?: "rolling12Months" | "allTime";
    } | ICustomerTier[]
  ) {
    const code = companyCode.toUpperCase().trim();

    const tiers = Array.isArray(payload) ? payload : payload?.customerTiers;
    const pointsPolicy = Array.isArray(payload) ? undefined : payload?.pointsPolicy;
    const tierEvaluationMetric = Array.isArray(payload) ? undefined : payload?.tierEvaluationMetric;
    const evaluationWindow = Array.isArray(payload) ? undefined : payload?.evaluationWindow;

    // Validate customer tiers constraints
    if (!Array.isArray(tiers) || tiers.length === 0) {
      throw new CustomerError("INVALID_TIERS", "Danh sách phân hạng không được để trống.", 400);
    }

    // Sort tiers by minGrossProfit (or minSpend) to make sure order is correct
    const sortedTiers = [...tiers].map(tier => ({
      ...tier,
      minGrossProfit: Number(tier.minGrossProfit ?? tier.minSpend ?? 0),
      minSpend: Number(tier.minSpend ?? tier.minGrossProfit ?? 0),
    })).sort((a, b) => a.minGrossProfit - b.minGrossProfit);

    if (sortedTiers[0].minGrossProfit !== 0) {
      throw new CustomerError("INVALID_TIERS_START", "Hạng thấp nhất phải có mức chi tiêu bắt đầu từ 0.", 400);
    }

    // Check duplicates and increasing order
    const seenCodes = new Set<string>();
    const seenNames = new Set<string>();
    let lastMetric = -1;

    for (const tier of sortedTiers) {
      const tierCode = String(tier.code || "").trim().toLowerCase();
      const name = String(tier.name || "").trim();
      const metric = Number(tier.minGrossProfit);

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
      if (metric <= lastMetric) {
        throw new CustomerError("INVALID_TIERS_ORDER", "Mức chi tiêu tối thiểu của các hạng tiếp theo phải lớn hơn hạng trước đó.", 400);
      }

      seenCodes.add(tierCode);
      seenNames.add(name);
      lastMetric = metric;
    }

    const updateDoc: any = { customerTiers: sortedTiers };
    if (pointsPolicy) updateDoc.pointsPolicy = pointsPolicy;
    if (tierEvaluationMetric) updateDoc.tierEvaluationMetric = tierEvaluationMetric;
    if (evaluationWindow) updateDoc.evaluationWindow = evaluationWindow;

    const updated = await CustomerSettingsModel.findOneAndUpdate(
      { companyCode: code },
      { $set: updateDoc },
      { returnDocument: 'after', upsert: true, runValidators: true }
    ).lean();

    return updated;
  },
};
