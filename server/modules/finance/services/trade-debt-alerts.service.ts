import { FinanceDebtModel } from "../models/financial-reporting.model";
import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { ReceivableModel } from "../models/receivable.model";
import { UserModel } from "../../../model/user.model";
import { NotificationModel } from "../../../model/notification.model";
import { BranchModel } from "../../../model/branch.model";
import { getEnabledModulesForCompany } from "../../../middleware/require-module";
import { financialReportingService } from "./financial-reporting.service";

export async function runTradeDebtAlerts(now = new Date()) {
  const scopeMap = new Map<string, { companyCode: string; branchId: string }>();
  for (const model of [FinanceDebtModel, RetailOrderModel, ReceivableModel] as any[]) {
    const scopes = await model.aggregate([{ $match: model === RetailOrderModel ? { status: "confirmed", dueAmount: { $gt: 0 } } : { balance: { $gt: 0 } } }, { $group: { _id: { companyCode: "$companyCode", branchId: "$branchId" } } }]);
    for (const row of scopes) if (row._id.companyCode && row._id.branchId) scopeMap.set(`${row._id.companyCode}:${row._id.branchId}`, row._id);
  }
  for (const scope of scopeMap.values()) {
    if (!(await getEnabledModulesForCompany(scope.companyCode))?.includes("finance")) continue;
    if (!await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true })) continue;
    const report = await financialReportingService.debts(scope);
    const alerts = report.items.filter(row => row.alert && row.source !== "receivable"); // Existing receivable worker owns its notifications.
    if (!alerts.length) continue;
    const users = await UserModel.find({ companyCode: scope.companyCode, isActive: { $ne: false }, $or: [{ role: "admin" }, { branchId: scope.branchId, permissions: { $in: ["finance-wallet:read", "finance-wallet:manage", "*"] } }] }).select("_id").lean();
    for (const debt of alerts) for (const user of users) {
      const idempotencyKey = `finance-trade:${scope.branchId}:${report.asOf}:${debt.source}:${debt.id}`;
      try {
        await NotificationModel.updateOne({ companyCode: scope.companyCode, recipientUid: String(user._id), idempotencyKey }, { $setOnInsert: { companyCode: scope.companyCode, recipientUid: String(user._id), idempotencyKey, title: debt.direction === "payable" ? "Nhắc thanh toán nhà cung cấp" : "Nhắc thu công nợ", body: `${debt.partyName} · ${debt.reference} · Còn ${debt.balance.toLocaleString("vi-VN")} ₫ · ${debt.daysOverdue > 0 ? `Quá hạn ${debt.daysOverdue} ngày` : debt.daysUntilDue === 0 ? "Đến hạn hôm nay" : `Đến hạn sau ${debt.daysUntilDue} ngày`}`, type: "he-thong", read: false, action: { tab: "TÀI CHÍNH", subTab: "bao-cao-tai-chinh" }, createdAt: now } }, { upsert: true });
      } catch (error: any) { if (error.code !== 11000) throw error; }
    }
  }
}
