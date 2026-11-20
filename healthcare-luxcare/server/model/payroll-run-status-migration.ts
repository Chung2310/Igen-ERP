import type { Collection } from "mongoose";
import { PayrollPaymentModel } from "./payroll-payment.model";
import { PayrollRunModel } from "./payroll-run.model";

export const LEGACY_STATUS_MAP = {
  draft: "draft",
  attendance_locked: "draft",
  calculated: "review",
  reviewed: "review",
  approved: "review",
  closed: "closed",
  partially_paid: "closed",
  paid: "paid",
} as const;

export const mapLegacyPayrollRunStatus = (status: string) => LEGACY_STATUS_MAP[status as keyof typeof LEGACY_STATUS_MAP];

type MigrationCollection = Pick<Collection, "updateMany" | "aggregate">;

export async function migrateLegacyPayrollRunStatuses(
  runs: MigrationCollection = PayrollRunModel.collection,
  payments: Pick<Collection, "collectionName"> = PayrollPaymentModel.collection,
) {
  let migrated = 0;
  for (const [status, canonical] of Object.entries(LEGACY_STATUS_MAP)) {
    if (status === canonical) continue;
    const result = await runs.updateMany({ status }, { $set: { status: canonical } });
    migrated += result.modifiedCount;
  }

  const paymentCollection = payments.collectionName || "payrollpayments";
  const anomalies = await runs.aggregate([
    { $match: { status: "closed" } },
    { $lookup: { from: paymentCollection, localField: "_id", foreignField: "runId", as: "payments" } },
    { $set: {
      netPay: { $sum: { $map: { input: { $ifNull: ["$lines", []] }, as: "line", in: { $ifNull: ["$$line.calculation.net", 0] } } } },
      confirmedPaid: { $sum: { $map: { input: { $filter: { input: "$payments", as: "payment", cond: { $eq: ["$$payment.status", "confirmed"] } } }, as: "payment", in: "$payment.amount" } } },
    } },
    { $match: { $expr: { $gte: ["$confirmedPaid", "$netPay"] } } },
    { $project: { _id: 1, settlement: { $cond: [{ $gt: ["$confirmedPaid", "$netPay"] }, "overpaid", "paid"] } } },
  ]).toArray();

  const paidIds = anomalies.filter((item: any) => item.settlement === "paid").map((item: any) => item._id);
  const paidResult = paidIds.length
    ? await runs.updateMany({ _id: { $in: paidIds }, status: "closed" }, { $set: { status: "paid" } })
    : { modifiedCount: 0 };
  return {
    migrated,
    paidReconciled: paidResult.modifiedCount,
    overpaidAnomalies: anomalies.filter((item: any) => item.settlement === "overpaid").length,
  };
}
