import { HRContractModel } from "../model/hr-contract.model";

const DAY_MS = 86_400_000;
export function startOfVietnamDay(now: Date): Date {
  const vietnam = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vietnam.getUTCFullYear(), vietnam.getUTCMonth(), vietnam.getUTCDate()) - 7 * 60 * 60 * 1000);
}

export function daysUntilContractExpiry(endDate: Date | string, now = new Date()): number {
  const vietnamToday = new Date(startOfVietnamDay(now).getTime() + 7 * 60 * 60 * 1000);
  const expiry = new Date(endDate);
  return Math.round((Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate()) - Date.UTC(vietnamToday.getUTCFullYear(), vietnamToday.getUTCMonth(), vietnamToday.getUTCDate())) / DAY_MS);
}

export const hrContractService = {
  async updateExpiredStatus(companyCode: string, now = new Date()): Promise<void> {
    await HRContractModel.updateMany(
      { companyCode, status: "active", endDate: { $lt: startOfVietnamDay(now) } },
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
    const query: any = { companyCode };
    if (branchId) query.branchId = branchId;
    if (employeeId) query.employeeId = employeeId;

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { employeeName: { $regex: cleanSearch, $options: "i" } },
        { contractType: { $regex: cleanSearch, $options: "i" } },
        { note: { $regex: cleanSearch, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      HRContractModel.find(query)
        .sort({ endDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HRContractModel.countDocuments(query),
    ]);

    return {
      contracts,
      total,
      page,
      limit,
    };
  },

  async listExpiryAlerts(params: { companyCode: string; branchId?: string; employeeId?: string; now?: Date }) {
    const now = params.now || new Date();
    const start = startOfVietnamDay(now);
    const query: Record<string, unknown> = {
      companyCode: params.companyCode,
      status: "active",
      endDate: { $gte: start, $lt: new Date(start.getTime() + 21 * DAY_MS) },
    };
    if (params.branchId) query.branchId = params.branchId;
    if (params.employeeId) query.employeeId = params.employeeId;
    const [contracts, total] = await Promise.all([
      HRContractModel.find(query).select("_id contractType employeeId employeeName endDate").sort({ endDate: 1 }).limit(20).lean(),
      HRContractModel.countDocuments(query),
    ]);
    return { total, items: contracts.map(contract => ({
      id: String(contract._id), contractType: contract.contractType, employeeId: contract.employeeId,
      employeeName: contract.employeeName, endDate: contract.endDate,
      daysRemaining: daysUntilContractExpiry(contract.endDate, now),
    })) };
  },
};
