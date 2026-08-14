import XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildLaborPartnerReportWorkbook, laborPartnerWorkbookBuffer } from "../services/labor-partner-export.service";

describe("labor partner report export", () => {
  it("creates the audit sheets from settlement snapshots", () => {
    const workbook = buildLaborPartnerReportWorkbook({
      summary: { settlementCount: 1, accruedAmount: 3000, approvedAmount: 3000, paidAmount: 1000, balanceAmount: 2000 },
      settlements: [{ periodStart: "2026-08-01", periodEnd: "2026-08-31", partnerId: { name: "Partner A" }, status: "approved", officialAmount: 1000, seasonalAmount: 2000, totalAmount: 3000, paidAmount: 1000, balanceAmount: 2000 }],
      officialLines: [{ settlement: { periodStart: "2026-08-01", periodEnd: "2026-08-31", partnerId: { name: "Partner A" } }, workerId: { fullName: "Nguyễn A", code: "LD-01" }, officialMilestone: 1, amount: 1000, explanation: "Mốc 1" }],
      seasonalLines: [{ settlement: { periodStart: "2026-08-01", periodEnd: "2026-08-31", partnerId: { name: "Partner A" } }, workerId: { fullName: "Nguyễn B", code: "LD-02" }, eligibleMinutes: 120, hourlyRate: 1000, amount: 2000, explanation: "2 giờ" }],
      adjustmentLines: [], payouts: [{ paidAt: "2026-08-31T00:00:00.000Z", amount: 1000, method: "bank_transfer" }], warnings: [],
    });
    expect(workbook.SheetNames).toEqual(["Tổng quan", "Kỳ đối soát", "Chính thức", "Thời vụ", "Điều chỉnh", "Thanh toán", "Cảnh báo"]);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Thời vụ"]);
    expect(rows[0]).toMatchObject({ "Lao động": "Nguyễn B", "Số giờ hợp lệ": 2, "Số tiền (VND)": 2000 });
    expect(laborPartnerWorkbookBuffer(workbook)).toBeInstanceOf(Buffer);
  });
});
