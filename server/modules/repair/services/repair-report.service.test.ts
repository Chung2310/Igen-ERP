import { expect, test } from "vitest";
import { activeRepairMinutes, buildRepairRevenuePipeline } from "./repair-report.service";

const range = { from: "2026-08-01", to: "2026-08-31" };

test("báo cáo doanh thu chỉ lấy phiếu đã xong trong kỳ và lọc theo công ty", () => {
  const [match]: any[] = buildRepairRevenuePipeline({ companyCode: "IGEN" }, range, "branch");
  expect(match.$match.companyCode).toBe("IGEN");
  expect(match.$match.status).toEqual({ $in: ["done", "delivered"] });
  expect(match.$match.completedAt.$gte).toBeInstanceOf(Date);
  expect(match.$match.branchId, "không truyền branchId thì gộp toàn công ty").toBeUndefined();
});

test("chọn được chi nhánh cụ thể và cách nhóm số liệu", () => {
  const [match]: any[] = buildRepairRevenuePipeline({ companyCode: "IGEN", branchId: "cn-1" }, range, "technician");
  expect(match.$match.branchId).toBe("cn-1");
  const [, group]: any[] = buildRepairRevenuePipeline({ companyCode: "IGEN" }, range, "branch");
  expect(group.$group._id).toBe("$branchId");
});

test("tách riêng doanh thu công sửa, linh kiện và việc bảo hành", () => {
  const [, group]: any[] = buildRepairRevenuePipeline({ companyCode: "IGEN" }, range, "branch");
  expect(group.$group.laborRevenue && group.$group.partRevenue && group.$group.warrantyPartCost).toBeTruthy();
  expect(group.$group.warrantyTicketCount, "phải đếm được số việc bảo hành").toBeTruthy();
});

test("khoảng ngày không hợp lệ bị chặn", () => {
  expect(() => buildRepairRevenuePipeline({ companyCode: "IGEN" }, { from: "2026-08-31", to: "2026-08-01" }, "branch")).toThrow(/trước ngày kết thúc/);
});

test("thời gian sửa trừ quãng chờ linh kiện và chờ nhà cung cấp", () => {
  const minutes = activeRepairMinutes({
    receivedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T10:00:00.000Z",
    statusHistory: [
      { to: "received", at: "2026-08-01T00:00:00.000Z" },
      { to: "repairing", at: "2026-08-01T01:00:00.000Z" },
      { to: "waiting_parts", at: "2026-08-01T02:00:00.000Z" },
      { to: "repairing", at: "2026-08-01T08:00:00.000Z" },
      { to: "done", at: "2026-08-01T10:00:00.000Z" },
    ],
  } as any);
  expect(minutes, "10 giờ tổng trừ 6 giờ chờ linh kiện").toBe(240);
});

test("phiếu chưa hoàn tất không tính thời gian sửa", () => {
  expect(activeRepairMinutes({ receivedAt: "2026-08-01T00:00:00.000Z" } as any)).toBe(0);
});
