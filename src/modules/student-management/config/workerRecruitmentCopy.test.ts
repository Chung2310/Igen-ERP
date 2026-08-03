import { describe, expect, it } from "vitest";
import {
  getCoursePageCopy,
  getBatchPageCopy,
  getBatchStatusLabel,
  getWorkerOperationalCopy,
  getStudentManagementSubTabLabel,
  usesEducationBilling,
} from "./workerRecruitmentCopy";

describe("worker recruitment copy", () => {
  it("keeps the education terminology unchanged for the student preset", () => {
    const copy = getCoursePageCopy("student");

    expect(getStudentManagementSubTabLabel("student", "khoa-hoc", "Khóa học")).toBe("Khóa học");
    expect(copy.pageTitle).toBe("Danh mục khóa học");
    expect(copy.addButton).toBe("Thêm khóa học mới");
    expect(copy.feeLabel).toBe("Học phí niêm yết");
    expect(copy.capacityLabel).toBe("Tối đa học viên lớp");
    expect(copy.emptySubtitle).toContain("chương trình đào tạo đầu tiên");
  });

  it("maps the complete course page to recruitment projects for the worker preset", () => {
    const copy = getCoursePageCopy("worker");

    expect(getStudentManagementSubTabLabel("worker", "khoa-hoc", "Khóa học")).toBe("Dự án");
    expect(getStudentManagementSubTabLabel("worker", "lop-hoc", "Lớp học")).toBe("Dự án");
    expect(copy).toMatchObject({
      pageTitle: "Danh sách dự án tuyển dụng",
      addButton: "Thêm dự án mới",
      searchPlaceholder: "Tìm theo tên hoặc mã dự án...",
      emptyTitle: "Chưa có dự án tuyển dụng nào",
      emptySubtitle: 'Bấm "Thêm dự án mới" để tạo dự án tuyển dụng đầu tiên.',
      codeLabel: "Mã dự án",
      titleLabel: "Tên dự án tuyển dụng",
      categoryLabel: "Nhóm dự án",
      durationLabel: "Thời gian tuyển dụng",
      feeLabel: "Ngân sách dự kiến",
      capacityLabel: "Chỉ tiêu tuyển",
      categoryManagerTitle: "Quản lý nhóm dự án",
      createModalTitle: "Thêm dự án mới",
      createSubmit: "Tạo dự án",
      updateSubmit: "Cập nhật dự án",
      paginationItemName: "dự án",
      activeBatchUnit: "đợt tuyển đang triển khai",
    });
    expect(copy.capacitySummary(100)).toBe("Chỉ tiêu: 100 lao động");
    expect(copy.createdMessage("DA-01")).toBe("Đã thêm mới dự án DA-01 thành công!");
    expect(copy.updatedMessage("DA-01")).toBe("Đã cập nhật dự án DA-01 thành công!");
    expect(copy.deletedMessage("DA-01")).toBe("Đã xóa dự án DA-01.");
    expect(copy.statusMessage("DA-01", "Tạm dừng")).toBe('Dự án DA-01 đã chuyển sang "Tạm dừng".');
  });

  it("uses batches as recruitment projects for the worker preset", () => {
    expect(getBatchPageCopy("worker")).toMatchObject({
      pageTitle: "Dự án tuyển dụng",
      createButton: "Thêm dự án",
      codeLabel: "Mã dự án",
      courseLabel: "Tên dự án",
      instructorLabel: "Người phụ trách",
      capacityLabel: "Chỉ tiêu",
      createSubmit: "Tạo dự án",
    });
    expect(getBatchPageCopy("student").pageTitle).toBe("Lớp & Khai giảng");
  });

  it("maps internal class statuses to project statuses without changing stored values", () => {
    expect(getBatchStatusLabel("worker", "Sắp khai giảng")).toBe("Sắp triển khai");
    expect(getBatchStatusLabel("worker", "Đang học")).toBe("Đang triển khai");
    expect(getBatchStatusLabel("worker", "Đã kết thúc")).toBe("Đã kết thúc");
    expect(getBatchStatusLabel("student", "Đang học")).toBe("Đang học");
  });

  it("does not apply worker project wording to the candidate preset", () => {
    expect(getCoursePageCopy("candidate").pageTitle).toBe("Danh mục khóa học");
  });

  it("maps the course page to services for the customer preset", () => {
    const copy = getCoursePageCopy("customer");

    expect(getStudentManagementSubTabLabel("customer", "khoa-hoc", "Khóa học")).toBe("Dịch vụ");
    expect(copy).toMatchObject({
      pageTitle: "Danh mục dịch vụ",
      addButton: "Thêm dịch vụ mới",
      codeLabel: "Mã dịch vụ",
      titleLabel: "Tên dịch vụ",
      categoryLabel: "Nhóm dịch vụ",
      durationLabel: "Thời gian cung cấp",
      feeLabel: "Giá dịch vụ",
      capacityLabel: "Số lượng khách hàng tối đa",
      createModalTitle: "Thêm dịch vụ mới",
      createSubmit: "Tạo dịch vụ",
      paginationItemName: "dịch vụ",
    });
  });

  it("provides customer-safe copy for visible operational areas", () => {
    const copy = getWorkerOperationalCopy("customer");

    expect(copy.isCustomer).toBe(true);
    expect(copy.unassignedGroupLabel).toBe("Chưa sử dụng dịch vụ");
    expect(copy.registrationStatusLabels).toMatchObject({
      "Đang học": "Đang sử dụng",
      "Đang thi": "Đang tư vấn",
      "Đã đậu": "Đã hoàn thành",
      "Nghỉ học": "Ngừng sử dụng",
    });
    expect(copy.exportFilePrefix).toBe("danh_sach_khach_hang");
    expect(copy.printTitle).toBe("DANH SÁCH KHÁCH HÀNG");
    expect(copy.notificationAudienceLabel).toBe("Tất cả khách hàng");
  });

  it("shows education payment controls only for education presets", () => {
    expect(usesEducationBilling("student")).toBe(true);
    expect(usesEducationBilling("worker")).toBe(false);
    expect(usesEducationBilling("customer")).toBe(false);
  });

  it("provides worker-safe copy for the other visible operational areas", () => {
    const copy = getWorkerOperationalCopy("worker");

    expect(copy.isWorker).toBe(true);
    expect(copy.unassignedGroupLabel).toBe("Chưa vào dự án");
    expect(copy.registrationStatusLabels).toEqual({
      "Đang học": "Đang tuyển",
      "Đang thi": "Đang phỏng vấn",
      "Đã đậu": "Đã trúng tuyển",
      "Thi lại": "Cần đánh giá lại",
      "Nghỉ học": "Ngừng xử lý",
    });
    expect(copy.exportFilePrefix).toBe("danh_sach_lao_dong");
    expect(copy.printTitle).toBe("DANH SÁCH LAO ĐỘNG");
    expect(copy.partnerReferralCountLabel).toBe("Số lao động giới thiệu");
    expect(copy.partnerReferralValueLabel).toBe("Tổng giá trị giới thiệu");
    expect(copy.notificationAudienceLabel).toBe("Tất cả lao động");
  });
});
