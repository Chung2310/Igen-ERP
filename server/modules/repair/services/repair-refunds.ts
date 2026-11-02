import { RepairTicketModel } from "../repair-ticket.model";

/** Only rows atomically linked to a posted Finance voucher are revenue adjustments. */
export async function verifiedRepairRefunds(scope: { companyCode: string; branchId?: string }, from?: Date, to?: Date) {
  return RepairTicketModel.aggregate([
    { $match: { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), "commissionRefunds.financeVoucherId": { $exists: true } } },
    { $unwind: "$commissionRefunds" },
    { $match: { "commissionRefunds.financeVoucherId": { $type: "string" }, ...(from && to ? { "commissionRefunds.at": { $gte: from, $lte: to } } : {}) } },
    { $project: { ticketCode: 1, branchId: 1, technicianId: 1, technicianName: 1, refund: "$commissionRefunds" } },
  ]);
}

export const repairRefundReportingNote = "Chỉ khoản hoàn đã liên kết phiếu chi Finance được trừ doanh thu theo ngày phiếu chi. Tham chiếu hoàn tiền cũ chưa đối soát không được tự động khấu trừ.";
