import { HRContractModel } from "../model/hr-contract.model";

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
};
