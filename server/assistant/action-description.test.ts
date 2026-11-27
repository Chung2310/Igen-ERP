import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, operationById } from "./catalog";

describe("assistant action descriptions", () => {
  it("provides a concrete purpose for every catalog action", () => {
    const incomplete = ASSISTANT_OPERATIONS
      .filter(operation => operation.description.trim().length < 55)
      .map(operation => operation.id);

    expect(incomplete).toEqual([]);
    const descriptions = new Map<string, string[]>();
    for (const operation of ASSISTANT_OPERATIONS) {
      descriptions.set(operation.description, [...(descriptions.get(operation.description) || []), operation.id]);
    }
    expect([...descriptions.values()].filter(ids => ids.length > 1)).toEqual([]);
  });

  it("distinguishes daily attendance filters by the records they return", () => {
    const descriptions = [
      "timekeeping.records.list",
      "timekeeping.records.late",
      "timekeeping.records.absent",
      "timekeeping.records.unrecorded",
      "timekeeping.records.leave",
    ].map(id => operationById(id)!.description);

    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(descriptions[0]).toContain("bảng chấm công trong ngày");
    expect(descriptions[1]).toContain("đi muộn");
    expect(descriptions[2]).toContain("Vắng đã được ghi nhận");
    expect(descriptions[3]).toContain("Chưa ghi nhận");
    expect(descriptions[4]).toContain("Nghỉ phép đã được ghi nhận");
  });

  it("marks common cross-module lookups and inventory state changes clearly", () => {
    expect(operationById("employee.list")!.description).toContain("Không dùng để tra người lao động/công nhân theo dự án");
    expect(operationById("training.list")!.description).toContain("không dùng thay danh sách khóa học/lớp học dành cho học viên");
    expect(operationById("product.list")!.description).toContain("số lượng tồn");
    expect(operationById("api.post.f03e901c8ee14a8f")!.description).toContain("không tạo phiếu mới");
    expect(operationById("api.post.a9dc1045ea6b35ab")!.description).toContain("không tự phê duyệt");
  });

  it("explains high-confusion action boundaries and business terms", () => {
    expect(operationById("partner.list")!.description).toContain("đối tác giới thiệu học viên");
    expect(operationById("retail.partner.list")!.description).toContain("phân hệ bán lẻ");
    expect(operationById("retail.order.list")!.description).toContain("paymentStatus=partial hoặc unpaid");
    expect(operationById("retail.order.completed-unpaid.report")!.description).toContain("dueAmount>0");
    expect(operationById("retail.order.completed-unpaid.report")!.analysis?.pagination).toMatchObject({ pageField: "query_page", sizeField: "query_limit" });
    expect(operationById("retail.report.compare")!.description).toContain("hai khoảng ngày");
    expect(operationById("retail.report.compare")!.fields.find(field => field.key === "targetBranch")).toMatchObject({ required: true, reference: "branch.list", apiKey: "branchId" });
    expect(operationById("batch.list")!.description).toContain("remainingSlots=0");
    expect(operationById("batch.list")!.fields.find(field => field.key === "targetBranch")).toMatchObject({ required: true, reference: "branch.list", apiKey: "branchId" });
    expect(operationById("student.learning-roadmap.waitlist.list")!.description).toContain("danh sách chờ lộ trình");
    expect(operationById("student.learning-roadmap.waitlist.list")!.fields.find(field => field.key === "targetBranch")).toMatchObject({ required: true, reference: "branch.list", apiKey: "branchId" });
    expect(operationById("student.learning-roadmap.waitlist.count")!.description).toContain("total của API trước khi phân trang");
    expect(operationById("student.learning-roadmap.waitlist.count")!.fields.find(field => field.key === "targetBranch")).toMatchObject({ required: true, reference: "branch.list", apiKey: "branchId" });
    expect(operationById("batch.capacity.report")!.description).toContain("capacityStatus=available");
    expect(operationById("inventory.transfer.create")!.description).toContain("tạo phiếu điều chuyển … từ kho X sang kho Y");
    expect(operationById("inventory.transfer.create")!.description).toContain("biến thể hoặc SKU chính xác vào variantId");
    expect(operationById("inventory.transfer.create")!.description).toContain("Không chọn action này cho báo cáo");

    const laborKpi = ASSISTANT_OPERATIONS.find(operation => operation.path === "/worker-management/partners/kpi")!;
    expect(laborKpi.description).toContain("‘thiếu KPI’");
    expect(laborKpi.description).toContain("status=incomplete");
  });
});
