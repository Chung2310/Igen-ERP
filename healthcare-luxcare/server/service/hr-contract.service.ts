import { annotateHistoricalRecords } from "./historical-user.service";
import { HRContractModel } from "../model/hr-contract.model";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const hrContractService = {
  async updateExpiredStatus(companyCode: string): Promise<void> {
    await HRContractModel.updateMany(
      { companyCode, status: "active", endDate: { $lt: new Date() } },
      { $set: { status: "expired" } },
    );
  },

  async list(params: {
    companyCode: string;
    branchId?: string;
    employeeId?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { companyCode, branchId, employeeId, search, page, limit } = params;
    const query: Record<string, unknown> = { companyCode };
    if (branchId) query.branchId = branchId;
    if (employeeId) query.employeeId = employeeId;

    const cleanSearch = search?.trim();
    if (cleanSearch) {
      const pattern = escapeRegex(cleanSearch);
      query.$or = [
        { employeeName: { $regex: pattern, $options: "i" } },
        { contractType: { $regex: pattern, $options: "i" } },
        { note: { $regex: pattern, $options: "i" } },
      ];
    }

    const [contracts, total] = await Promise.all([
      HRContractModel.find(query)
        .sort({ endDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      HRContractModel.countDocuments(query),
    ]);

    return { contracts: await annotateHistoricalRecords(companyCode, contracts), total, page, limit };
  },

  async getExpiringContracts(params: {
    companyCode: string;
    branchId?: string;
    employeeId?: string;
    days?: number;
  }) {
    const { companyCode, branchId, employeeId, days = 20 } = params;
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
    const maxDate = new Date(startOfToday.getTime() + (days + 1) * 24 * 60 * 60 * 1000 - 1);

    const query: Record<string, unknown> = {
      companyCode,
      status: "active",
      endDate: { $gte: startOfToday, $lte: maxDate },
    };
    if (branchId) query.branchId = branchId;
    if (employeeId) query.employeeId = employeeId;

    return annotateHistoricalRecords(companyCode, await HRContractModel.find(query).sort({ endDate: 1 }).lean());
  },
};
