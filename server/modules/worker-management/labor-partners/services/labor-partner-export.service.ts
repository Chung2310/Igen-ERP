import XLSX from "xlsx";
import type { LaborPartnerReportData } from "./labor-partner-report.service";

const partnerName = (partner: any) => partner?.name || "";
const workerName = (worker: any) => worker?.fullName || "";

function addSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
}

export function buildLaborPartnerReportWorkbook(report: LaborPartnerReportData): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, "Tổng quan", [{
    "Số kỳ đối soát": report.summary.settlementCount,
    "Tổng phát sinh (VND)": report.summary.accruedAmount,
    "Tổng đã duyệt (VND)": report.summary.approvedAmount,
    "Tổng đã chi (VND)": report.summary.paidAmount,
    "Còn phải chi (VND)": report.summary.balanceAmount,
  }]);
  addSheet(workbook, "Kỳ đối soát", report.settlements.map((item: any) => ({
    "Kỳ từ": item.periodStart, "Kỳ đến": item.periodEnd, "Đối tác": partnerName(item.partnerId), "Trạng thái": item.status,
    "Chính thức (VND)": item.officialAmount, "Thời vụ (VND)": item.seasonalAmount, "Tổng phải trả (VND)": item.totalAmount,
    "Đã chi (VND)": item.paidAmount, "Còn lại (VND)": item.balanceAmount,
  })));
  addSheet(workbook, "Chính thức", report.officialLines.map((line: any) => ({
    "Kỳ từ": line.settlement?.periodStart, "Kỳ đến": line.settlement?.periodEnd, "Đối tác": partnerName(line.settlement?.partnerId),
    "Lao động": workerName(line.workerId), "Mã lao động": line.workerId?.code || "", "Mốc tháng": line.officialMilestone,
    "Số tiền (VND)": line.amount, "Giải thích": line.explanation,
  })));
  addSheet(workbook, "Thời vụ", report.seasonalLines.map((line: any) => ({
    "Kỳ từ": line.settlement?.periodStart, "Kỳ đến": line.settlement?.periodEnd, "Đối tác": partnerName(line.settlement?.partnerId),
    "Lao động": workerName(line.workerId), "Mã lao động": line.workerId?.code || "", "Số phút hợp lệ": line.eligibleMinutes,
    "Số giờ hợp lệ": Number(line.eligibleMinutes || 0) / 60, "Đơn giá (VND/giờ)": line.hourlyRate, "Số tiền (VND)": line.amount, "Giải thích": line.explanation,
  })));
  addSheet(workbook, "Điều chỉnh", report.adjustmentLines.map((line: any) => ({
    "Kỳ từ": line.settlement?.periodStart, "Kỳ đến": line.settlement?.periodEnd, "Đối tác": partnerName(line.settlement?.partnerId),
    "Số tiền điều chỉnh (VND)": line.amount, "Lý do": line.explanation,
    "Kỳ gốc": line.policySnapshot?.sourceSettlementId || "",
  })));
  addSheet(workbook, "Thanh toán", report.payouts.map((item: any) => ({
    "Ngày chi": item.paidAt ? new Date(item.paidAt).toISOString() : "", "Số tiền (VND)": item.amount,
    "Phương thức": item.method, "Mã tham chiếu": item.reference || "", "Ghi chú": item.note || "", "Giao dịch đảo của": item.reversalOfPayoutId ? String(item.reversalOfPayoutId) : "",
  })));
  addSheet(workbook, "Cảnh báo", report.warnings.map((item: any) => ({
    "Kỳ từ": item.periodStart, "Kỳ đến": item.periodEnd, "Đối tác": partnerName(item.partner), "Mã cảnh báo": item.code || "", "Nội dung": item.message || JSON.stringify(item),
  })));
  return workbook;
}

export function laborPartnerWorkbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
