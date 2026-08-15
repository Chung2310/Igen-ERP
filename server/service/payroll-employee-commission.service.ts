import { LaborPartnerCommissionLineModel } from "../modules/worker-management/labor-partners/models/commission-line.model";
import { LaborPartnerSettlementModel } from "../modules/worker-management/labor-partners/models/settlement.model";

function periodBounds(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("periodKey must use YYYY-MM format");
  }
  return {
    start: `${periodKey}-01`,
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

export async function getApprovedEmployeeCommissions(input: {
  companyCode: string;
  branchId: string;
  periodKey: string;
}): Promise<Map<string, number>> {
  const period = periodBounds(input.periodKey);
  const rows = await (LaborPartnerCommissionLineModel as any).aggregate([
    { $match: { status: "approved", scheme: { $ne: "adjustment" }, workerId: { $exists: true, $ne: null }, amount: { $gte: 0 } } },
    { $lookup: { from: "laborpartnersettlements", localField: "settlementId", foreignField: "_id", as: "settlement" } },
    { $unwind: "$settlement" },
    { $match: {
      "settlement.companyCode": input.companyCode,
      "settlement.branchId": input.branchId,
      "settlement.periodStart": { $gte: period.start },
      "settlement.periodEnd": { $lte: period.end },
      "settlement.status": { $in: ["approved", "partially_paid", "paid"] },
    } },
    { $group: { _id: "$workerId", amount: { $sum: "$amount" } } },
  ]);
  return new Map(rows.map((row: any) => [String(row._id), Number(row.amount || 0)]));
}
