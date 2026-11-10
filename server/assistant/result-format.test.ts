import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS } from "./catalog";
import { formatAssistantResult, formatFriendlyAssistantResult } from "./result-format";
import { PERMISSION_CATALOG } from "../config/permission-catalog";

describe("formatAssistantResult", () => {
  it("localizes common status values, ISO dates, and weekday arrays", () => {
    const reply = formatAssistantResult({
      id: "common.result", title: "Kết quả", fields: [],
      resultFields: ["status", "createdAt", "startAt", "workingDays", "productType", "paymentMethod", "priority"],
    }, {
      status: "active",
      createdAt: "2026-11-09T00:00:00.000Z",
      startAt: "2026-11-09T08:00:00.000Z",
      workingDays: [1, 2, 3, 4, 5],
      productType: "physical",
      paymentMethod: "bank_transfer",
      priority: "urgent",
    });

    expect(reply).toContain("Trạng thái: Đang hoạt động");
    expect(reply).toContain("09/11/2026");
    expect(reply).not.toContain("T00:00:00.000Z");
    expect(reply).toContain("15:00");
    expect(reply).toContain("Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6");
    expect(reply).toContain("Loại sản phẩm: Hàng hóa");
    expect(reply).toContain("Phương thức thanh toán: Chuyển khoản");
    expect(reply).toContain("Mức độ ưu tiên: Khẩn cấp");
  });

  it("localizes network, connectivity, and employment enum values", () => {
    const reply = formatAssistantResult({
      id: "common.enums", title: "Thông tin", fields: [],
      resultFields: ["employmentType", "networkType", "connectionStatus"],
    }, { employmentType: "part_time ", networkType: "wifi", connectionStatus: "offline" });

    expect(reply).toContain("Hình thức làm việc: Bán thời gian");
    expect(reply).toContain("Loại mạng: Wi-Fi");
    expect(reply).toContain("Trạng thái kết nối: Ngoại tuyến");
    expect(reply).not.toContain("part_time");
    expect(reply).not.toContain("offline");
  });

  it("localizes ISO dates and workflow status in custom result summaries", () => {
    const reply = formatFriendlyAssistantResult({
      id: "finance.reminders.runs.detail", title: "Chi tiết đợt nhắc nợ", fields: [], resultFields: [],
    }, {
      date: "2026-11-09T00:00:00.000Z", status: "running", trigger: "manual",
      eligibleCount: 0, queuedCount: 0, deliverySentCount: 0, deliveryQueuedCount: 0,
      deliverySkippedCount: 0, deliveryFailedCount: 0, skippedCount: 0, failedCount: 0, duplicateCount: 0,
    });

    expect(reply).toContain("Ngày: 09/11/2026");
    expect(reply).toContain("Trạng thái: Đang xử lý");
    expect(reply).not.toContain("T00:00:00.000Z");
  });

  it("formats labor-partner monthly referral KPI results in Vietnamese", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.kpi.set")!;
    const reply = formatFriendlyAssistantResult(operation, {
      partnerName: "Cường",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      targetReferrals: 12,
      note: "Khu vực miền Bắc",
    });

    expect(reply).toContain("đặt KPI giới thiệu cho Cường");
    expect(reply).toContain("Tháng áp dụng: 11/2026");
    expect(reply).toContain("Chỉ tiêu giới thiệu: 12 người");
    expect(reply).toContain("Ghi chú: Khu vực miền Bắc");
    expect(reply).not.toMatch(/periodStart|targetReferrals|worker\.partner\.kpi\.set/);
  });

  it("omits internal identifiers in camelCase, uppercase, and snake_case result fields", () => {
    const internalId = "507f1f77bcf86cd799439011";
    const reply = formatAssistantResult({
      id: "identifier.result", title: "Hồ sơ", fields: [],
      resultFields: ["name", "branchId", "branchID", "product_id"],
    }, { name: "Chi nhánh Hà Nội", branchId: internalId, branchID: internalId, product_id: internalId });

    expect(reply).toContain("Tên: Chi nhánh Hà Nội");
    expect(reply).not.toContain(internalId);
    expect(reply).not.toContain("branchId");
    expect(reply).not.toContain("branchID");
    expect(reply).not.toContain("product_id");
  });

  it("keeps department and employee lookup results focused on useful fields", () => {
    const departments = ASSISTANT_OPERATIONS.find(item => item.id === "department.list")!;
    const departmentReply = formatAssistantResult(departments, [{
      name: "IT", code: "IT", description: "Internal description", managerName: "Nguy\u1EC5n An",
      sortOrder: 0, isActive: true, employeeCount: 3, companyCode: "PRIVATE",
    }]);
    expect(departmentReply).toContain("Tr\u01B0\u1EDFng ph\u00F2ng: Nguy\u1EC5n An");
    expect(departmentReply).toContain("S\u1ED1 nh\u00E2n s\u1EF1: 3");
    expect(departmentReply).not.toContain("description");
    expect(departmentReply).not.toContain("sortOrder");
    expect(departmentReply).not.toContain("PRIVATE");

    const employees = ASSISTANT_OPERATIONS.find(item => item.id === "employee.list")!;
    const employeeReply = formatAssistantResult(employees, [{
      displayName: "Nguy\u1EC5n An", department: "IT", division: "H\u1EA1 t\u1EA7ng",
      email: "private@example.test", monthlySalary: 50000000,
    }]);
    expect(employeeReply).toContain("H\u1ECD v\u00E0 t\u00EAn: Nguy\u1EC5n An");
    expect(employeeReply).toContain("Ph\u00F2ng ban: IT");
    expect(employeeReply).not.toContain("private@example.test");
    expect(employeeReply).not.toContain("50.000.000");
  });

  it("summarizes dashboard action items with useful names and without internal ids", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.get.a0937fb0c693e329")!;
    const reply = formatFriendlyAssistantResult(operation, {
      overdueTasks: [{ id: "private-task-id", title: "Chốt bảng công", dueDate: "2026-11-01" }],
      pendingApprovals: [{ id: "private-leave-id", type: "leave", employeeName: "Nguyễn An" }],
      lowStockAlerts: [{ id: "private-product-id", name: "Thẻ nhân viên", sku: "CARD-01", stock: 2, minStockAlert: 5 }],
    });

    expect(reply).toContain("Công việc quá hạn: 1");
    expect(reply).toContain("Chốt bảng công");
    expect(reply).toContain("Yêu cầu chờ duyệt: 1");
    expect(reply).toContain("Nghỉ phép của Nguyễn An");
    expect(reply).toContain("Thẻ nhân viên (CARD-01) · Còn 2");
    expect(reply).not.toContain("private-");
  });

  it("summarizes worker management dashboard metrics instead of returning a generic completion", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.get.f741231162e2386f")!;
    const reply = formatFriendlyAssistantResult(operation, {
      totalWorkers: 3,
      activeWorkers: 2,
      workersByStatus: { active: 2, inactive: 1, placed: 0 },
      projects: 1,
      projectsByStatus: { active: 1, planned: 0, completed: 0 },
      contractAlerts: { expiringCount: 1, expiredCount: 0 },
      topProjects: [{ name: "Công trình QA", allocated: 2, quota: 4 }],
    });

    expect(reply).toContain("Người lao động: 3");
    expect(reply).toContain("Dự án: 1");
    expect(reply).toContain("Hợp đồng sắp hết hạn: 1");
    expect(reply).toContain("Công trình QA");
    expect(reply).not.toContain("hoàn tất. Mở phân hệ");
  });

  it("does not format count fields as currency", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.celebration.history")!;
    const reply = formatAssistantResult(operation, { totalCount: 0, sentCount: 0, failedCount: 0, pendingCount: 0, skippedCount: 0 });

    expect(reply).toContain("Tổng lượt gửi: 0");
    expect(reply).not.toContain("0 ₫");
  });

  it("summarizes HR contract records and expiry alerts without exposing record ids or salaries", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.get.0c557a74cbc907f9")!;
    const reply = formatFriendlyAssistantResult(operation, {
      contracts: [{
        _id: "private-contract-id", employeeName: "Nguyễn An", contractType: "Chính thức",
        startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-12-31T00:00:00.000Z", status: "active",
        salaryTerms: [{ contractSalary: 50000000 }],
      }],
      total: 1,
      expiryAlerts: [{ _id: "private-alert-id", employeeName: "Trần Bình", contractType: "Thời hạn", endDate: "2026-11-10T00:00:00.000Z", daysRemaining: 8 }],
      expiryAlertTotal: 1,
    });

    expect(reply).toContain("Hợp đồng: 1");
    expect(reply).toContain("Nguyễn An");
    expect(reply).toContain("Đang hiệu lực");
    expect(reply).toContain("Hợp đồng sắp hết hạn: 1");
    expect(reply).toContain("Trần Bình");
    expect(reply).not.toContain("private-");
    expect(reply).not.toContain("50.000.000");
  });

  it("summarizes HR contract extensions and gives a clear empty result", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.get.b44c64519e939e0a")!;
    const reply = formatFriendlyAssistantResult(operation, [{
      _id: "private-extension-id", employeeName: "Nguyễn An", previousEndDate: "2026-10-31T00:00:00.000Z",
      newEndDate: "2027-10-31T00:00:00.000Z", reason: "Tiếp tục làm việc",
    }]);
    expect(reply).toContain("Lịch sử gia hạn: 1");
    expect(reply).toContain("Nguyễn An");
    expect(reply).toContain("Tiếp tục làm việc");
    expect(reply).not.toContain("private-");
    expect(formatFriendlyAssistantResult(operation, [])).toContain("chưa có lịch sử gia hạn");
  });

  it("formats recruitment job lifecycle fields in natural Vietnamese", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "recruitment.job.delete")!;
    const reply = formatAssistantResult(operation, {
      code: "QA-2026-01", title: "Kiểm thử", status: "draft", isDeleted: true, version: 5,
    });

    expect(reply).toContain("Mã vị trí tuyển dụng: QA-2026-01");
    expect(reply).toContain("Trạng thái: Bản nháp");
    expect(reply).not.toContain("Đã xóa mềm");
    expect(reply).not.toContain("Phiên bản");
    expect(reply).not.toContain("Is Deleted");
  });

  it("reports required recruitment details missing before a draft can open", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "recruitment.job.detail")!;
    const reply = formatFriendlyAssistantResult(operation, { data: {
      code: "IT_IOT", title: "Tuyển dụng nhân sự IOT", department: "Phòng IT", headcount: 1,
      description: "", requirements: "", benefits: "", salaryMin: null, salaryMax: null,
      employmentType: "full_time", workplaceType: "onsite", location: "", applicationDeadline: null, status: "draft",
    } });

    expect(reply).toContain("Mã vị trí tuyển dụng: IT_IOT");
    expect(reply).toContain("Trạng thái: Bản nháp");
    expect(reply).toContain("Để mở tuyển, còn thiếu: Mô tả công việc, Yêu cầu ứng viên, Địa điểm làm việc, Hạn nhận hồ sơ trong tương lai.");
    expect(reply).toContain("không bắt buộc để mở tuyển): Quyền lợi, Khoảng lương.");
  });

  it("recognizes a recruitment position that already has the fields required to open", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "recruitment.job.detail")!;
    const reply = formatFriendlyAssistantResult(operation, { data: {
      code: "IT_IOT", title: "Tuyển dụng nhân sự IOT", department: "Phòng IT", headcount: 1,
      description: "Phát triển hệ thống IoT.", requirements: "Có kinh nghiệm phù hợp.", benefits: "Bảo hiểm.",
      salaryMin: 20000000, salaryMax: 30000000, employmentType: "full_time", workplaceType: "onsite",
      location: "Hà Nội", applicationDeadline: new Date(Date.now() + 86_400_000).toISOString(), status: "draft",
    } });

    expect(reply).toContain("Tin tuyển dụng đã đủ thông tin bắt buộc để mở tuyển.");
    expect(reply).not.toContain("Để mở tuyển, còn thiếu:");
  });

  it("uses readable labels for FAQ suggestions and Content Sheet revisions", () => {
    const faq = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.faq-candidates.list")!;
    const faqReply = formatAssistantResult(faq, { data: [{ question: "Chính sách đổi hàng thế nào?", suggestedAnswer: "Có thể đổi trong 7 ngày.", category: "Chính sách", status: "pending" }] });
    expect(faqReply).toContain("Câu hỏi: Chính sách đổi hàng thế nào?");

    const revisions = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.sheet.revisions.list")!;
    const revisionReply = formatAssistantResult(revisions, { data: [{ actorType: "user", baseRevision: 4, createdAt: "2026-10-31T10:00:00.000Z" }] });
    expect(revisionReply).toContain("Người thực hiện: Người dùng");
    expect(revisionReply).toContain("Phiên bản nền: 4");
  });

  it("summarizes role permission changes with readable permission labels", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "access.role-permissions.save")!;
    const reply = formatAssistantResult(operation, { data: {
      rolePermission: {
        _id: "507f1f77bcf86cd799439011", role: "cashier", displayName: "Thu ngân", level: 5,
        permissions: ["retail:read"], companyCode: "PRIVATE-COMPANY",
      },
      stored: ["retail:read"], effective: ["retail:read", "inventory:read"],
    } });
    expect(reply).toContain("Thu ngân đã được cập nhật");
    expect(reply).toContain(PERMISSION_CATALOG.find(permission => permission.code === "retail:read")!.label);
    expect(reply).toContain(PERMISSION_CATALOG.find(permission => permission.code === "inventory:read")!.label);
    expect(reply).not.toContain("PRIVATE");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
  });

  it("formats queued video-caption jobs without exposing provider or job metadata", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.video-caption.project.analyze")!;
    const reply = formatAssistantResult(operation, {
      status: "queued",
      id: "internal-job-id",
      provider: "internal-provider",
      model: "private-model",
      estimatedCost: 123,
    });

    expect(reply).toContain("Tr\u1EA1ng th\u00E1i: \u0110ang ch\u1EDD");
    expect(reply).not.toContain("internal-job-id");
    expect(reply).not.toContain("internal-provider");
    expect(reply).not.toContain("private-model");
    expect(reply).not.toContain("123");
    expect(reply).not.toContain("{");
  });

  it("shows only catalog fields in a readable transaction summary", () => {
    const reply = formatAssistantResult({
      id: "customer.transactions", title: "Tra cứu lịch sử giao dịch khách hàng", fields: [],
      resultFields: ["kind", "sourceId", "eventId", "code", "occurredAt", "amount", "description"],
    }, {
      items: [{ kind: "sale_refund", sourceId: "internal-source", eventId: "internal-event", code: "DH-001", occurredAt: "2026-10-29", amount: 1000, description: "Hoàn tiền", customerId: "internal-customer", accessToken: "secret" }],
      pagination: { page: 1, total: 999 },
    });

    expect(reply).toContain("Tra cứu lịch sử giao dịch khách hàng · 1 kết quả");
    expect(reply).toContain("Loại giao dịch: Hoàn tiền đơn bán");
    expect(reply).toContain("Mã: DH-001");
    expect(reply).toContain("Số tiền: 1.000 ₫");
    expect(reply).not.toContain("internal-");
    expect(reply).not.toContain("accessToken");
    expect(reply).not.toContain("pagination");
    expect(reply).not.toContain("{");
  });

  it("shows serial transfer statuses in Vietnamese", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.serial.transfer.request")!;
    const reply = formatAssistantResult(operation, { serialNumber: "IMEI-01", sku: "DT-01", productName: "Điện thoại", status: "in_transit", _id: "internal-id", transferToBranchId: "internal-branch" });
    expect(reply).toContain("Trạng thái: Đang điều chuyển");
    expect(reply).not.toContain("internal-");
    expect(reply).not.toContain("{");
  });

  it("summarizes the updated gross-profit customer tiers and TikTok connection state", () => {
    const settings = ASSISTANT_OPERATIONS.find(item => item.id === "customer.settings.get")!;
    const settingsReply = formatAssistantResult(settings, { data: {
      tierEvaluationMetric: "gross_profit", evaluationWindow: "rolling12Months",
      customerTiers: [{ code: "standard", name: "Thường", minGrossProfit: 0 }, { code: "gold", name: "Vàng", minGrossProfit: 5000000 }],
      companyCode: "PRIVATE-COMPANY", _id: "507f1f77bcf86cd799439011",
    } });
    expect(settingsReply).toContain("Tiêu chí xếp hạng: Lợi nhuận gộp");
    expect(settingsReply).toContain("Khoảng xét hạng: 12 tháng gần nhất");
    expect(settingsReply).toContain("Ngưỡng lợi nhuận gộp: 5.000.000 ₫");
    expect(settingsReply).not.toContain("PRIVATE");
    expect(settingsReply).not.toContain("507f1f77");
    expect(settingsReply).not.toContain("{");

    const status = ASSISTANT_OPERATIONS.find(item => item.id === "tiktok-shop.status")!;
    const statusReply = formatAssistantResult(status, { data: { connected: true, connections: [{ openId: "private-open-id" }] } });
    expect(statusReply).toContain("Đã kết nối: Có");
    expect(statusReply).not.toContain("private-open-id");
  });

  it("summarizes nested mutation results without exposing internal IDs", () => {
    const reply = formatAssistantResult({
      id: "repair.refund.create", title: "Ghi nhận hoàn tiền sửa chữa", fields: [], resultFields: ["status", "summary"],
    }, {
      status: "completed",
      summary: { refundedAmount: 250000, remaining: 0, ticketId: "internal-ticket", secret: "hidden" },
    });

    expect(reply).toContain("Trạng thái: Đã hoàn tất");
    expect(reply).toContain("Đã hoàn tiền: 250.000 ₫");
    expect(reply).toContain("Còn có thể hoàn: 0 ₫");
    expect(reply).not.toContain("internal-ticket");
    expect(reply).not.toContain("secret");
    expect(reply).not.toContain("{");
  });

  it("redacts and formats JSON text embedded in an approved result field", () => {
    const reply = formatAssistantResult({
      id: "result.test", title: "Kết quả", fields: [], resultFields: ["summary"],
    }, { summary: "{\"note\":\"Đã đối soát\",\"password\":\"hidden\",\"id\":\"internal-id\"}" });

    expect(reply).toContain("Ghi chú: Đã đối soát");
    expect(reply).not.toContain("hidden");
    expect(reply).not.toContain("internal-id");
    expect(reply).not.toContain("{");
  });

  it("summarizes partner updates and masks bank account numbers", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/partners/:id")!;
    const reply = formatAssistantResult(operation, {
      name: "Nguyễn Hoàng Minh Phương", phone: "0985645175", bankName: "ACB",
      bankAccountName: "NGUYEN HOANG MINH PHUONG", bankAccountNo: "12345678",
      commissionType: "percentage", commissionValue: 5, isActive: true,
      _id: "507f1f77bcf86cd799439051", createdAt: "2026-10-29T01:14:21.251Z",
    });

    expect(reply).toContain("Tên đối tác: Nguyễn Hoàng Minh Phương");
    expect(reply).toContain("Tên ngân hàng: ACB");
    expect(reply).toContain("Số tài khoản ngân hàng: •••• 5678");
    expect(reply).toContain("Mức hoa hồng: 5%");
    expect(reply).not.toContain("12345678");
    expect(reply).not.toContain("createdAt");
    expect(reply).not.toContain("{");
  });

  it("formats partner list envelopes returned by the API", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "GET" && item.path === "/partners")!;
    const reply = formatAssistantResult(operation, {
      success: true,
      partners: [{ name: "Nguyễn Hoàng Minh Phương", phone: "0985645175", isActive: true, _id: "507f1f77bcf86cd799439051" }],
    });

    expect(reply).toContain("Tra cứu đối tác · 1 kết quả");
    expect(reply).toContain("Tên: Nguyễn Hoàng Minh Phương");
    expect(reply).not.toContain("507f1f77bcf86cd799439051");
    expect(reply).not.toContain("{");
  });

  it("summarizes commission configuration with readable VND and percentage values", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/partners/commission-levels")!;
    const reply = formatAssistantResult(operation, {
      name: "Cấp 2", minTuition: 10000000, commissionRate: 7,
      _id: "507f1f77bcf86cd799439057", ownerId: "internal-owner",
    });

    expect(reply).toContain("Tạo cấu hình hoa hồng");
    expect(reply).toContain("Tên cấp bậc hoa hồng: Cấp 2");
    expect(reply).toContain("Doanh số tối thiểu (VND): 10.000.000 ₫");
    expect(reply).toContain("Tỷ lệ hoa hồng (%): 7%");
    expect(reply).not.toContain("internal-owner");
    expect(reply).not.toContain("{");
  });

  it("summarizes payroll adjustments and reset counts without exposing raw JSON or internal IDs", () => {
    const adjustments = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.adjustment.list")!;
    const adjustmentReply = formatAssistantResult(adjustments, { status: "success", data: [{
      employeeName: "\u0110\u1ED7 \u0110\u1EE9c Chung", kind: "bonus", amount: 100000, reason: "Th\u01B0\u1EDFng KPI", status: "pending",
      _id: "507f1f77bcf86cd799439099", branchId: "internal-branch",
    }] });
    expect(adjustmentReply).toContain("\u0110\u1ED7 \u0110\u1EE9c Chung");
    expect(adjustmentReply).toContain("100.000");
    expect(adjustmentReply).toContain("Th\u01B0\u1EDFng KPI");
    expect(adjustmentReply).not.toContain("507f1f77bcf86cd799439099");
    expect(adjustmentReply).not.toContain("internal-branch");
    expect(adjustmentReply).not.toContain("{");

    const reset = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.period.reset")!;
    const resetReply = formatAssistantResult(reset, { status: "success", deleted: {
      run: 1, results: 12, adjustments: 2, overrides: 1, audits: 4,
    } });
    expect(resetReply).toContain("1");
    expect(resetReply).toContain("12");
    expect(resetReply).toContain("2");
    expect(resetReply).toContain("4");
    expect(resetReply).not.toContain("{");
  });

  it("formats operational payroll run status in Vietnamese", () => {
    const runs = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.run.list")!;
    const reply = formatAssistantResult(runs, { data: [{
      periodKey: "2026-10", startDate: "2026-10-01", endDate: "2026-10-31", type: "regular", status: "review",
      _id: "internal-run-id", version: 3,
    }] });
    expect(reply).toContain("Trạng thái: Chờ duyệt");
    expect(reply).not.toContain("internal-run-id");
    expect(reply).not.toContain("Phiên bản");
    expect(reply).not.toContain("{");
  });

  it("shows payroll self-service results without exposing run or issue identifiers", () => {
    const reconciliation = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.employee.me.reconciliation")!;
    const reconciliationReply = formatAssistantResult(reconciliation, { data: [{
      periodKey: "2026-09", runStatus: "closed", stale: false, netPay: 42500000,
      openIssueCount: 1, openIssueFields: "Lương cơ bản", runId: "internal-run-id", employeeId: "internal-employee-id",
    }] });
    expect(reconciliationReply).toContain("Kỳ lương: 2026-09");
    expect(reconciliationReply).toContain("Trạng thái kỳ lương: Đã chốt");
    expect(reconciliationReply).toContain("Thực nhận: 42.500.000 ₫");
    expect(reconciliationReply).not.toContain("internal-");
    expect(reconciliationReply).not.toContain("{");

    const action = ASSISTANT_OPERATIONS.find(item => item.id === "payroll.employee.reconciliation.action")!;
    const actionReply = formatAssistantResult(action, { data: {
      action: "reply", periodKey: "2026-09", issues: [{
        fieldLabel: "Lương cơ bản", status: "Đang chờ phản hồi", message: "Tôi gửi thêm chứng từ.", id: "internal-issue-id",
      }], runId: "internal-run-id", employeeId: "internal-employee-id",
    } });
    expect(actionReply).toContain("Đã gửi phản hồi");
    expect(actionReply).toContain("Lương cơ bản");
    expect(actionReply).toContain("Tôi gửi thêm chứng từ.");
    expect(actionReply).not.toContain("internal-");
    expect(actionReply).not.toContain("{");
  });

  it("formats the signed-in employee's attendance without internal identifiers", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.today.me")!;
    const reply = formatAssistantResult(operation, { status: "success", data: {
      date: "2026-10-29", isWorkingDay: true, dayLabel: "Ngày làm việc bình thường",
      attendanceStatus: "Đã vào ca", checkIn: "08:02", checkOut: null,
      uid: "internal-employee-id", branchId: "internal-branch-id",
    } });
    expect(reply).toContain("Ngày: 29/10/2026");
    expect(reply).toContain("Ngày làm việc: Có");
    expect(reply).toContain("Trạng thái chấm công: Đã vào ca");
    expect(reply).toContain("Giờ vào: 08:02");
    expect(reply).not.toContain("internal-");
    expect(reply).not.toContain("{");
  });

  it("formats only the signed-in user's account profile fields", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "account.profile.me")!;
    const reply = formatAssistantResult(operation, { status: "success", data: {
      displayName: "Đỗ Đức Chung", email: "chung@example.test", role: "admin", companyCode: "internal-company",
    } });
    expect(reply).toContain("Tên hiển thị: Đỗ Đức Chung");
    expect(reply).toContain("Email: chung@example.test");
    expect(reply).not.toContain("internal-company");
    expect(reply).not.toContain("{");
  });

  it("does not show internal colleague references in the directory result", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "account.colleagues.list")!;
    const reply = formatAssistantResult(operation, { status: "success", data: [{
      __assistantRef: { id: "507f1f77bcf86cd799439064" },
      displayName: "Nguyễn An", email: "an@example.test", department: "Kinh doanh", isActive: true,
    }] });
    expect(reply).toContain("Nguyễn An");
    expect(reply).toContain("an@example.test");
    expect(reply).not.toContain("507f1f77bcf86cd799439064");
    expect(reply).not.toContain("__assistantRef");
  });

  it("formats Telegram link status without exposing one-time codes or Telegram IDs", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "account.telegram-link.status")!;
    const reply = formatAssistantResult(operation, { status: "success", data: {
      linked: false,
      linkedAt: null,
      botUsername: "igen_bot",
      telegramChatId: "123456789",
      telegramUserId: "987654321",
      pendingCode: "one-time-link-secret",
      pendingCodeExpiresAt: "2026-10-30T12:00:00.000Z",
    } });
    expect(reply).toContain("Đã liên kết Telegram: Không");
    expect(reply).toContain("Tài khoản bot Telegram: igen_bot");
    expect(reply).not.toContain("one-time-link-secret");
    expect(reply).not.toContain("123456789");
    expect(reply).not.toContain("987654321");
    expect(reply).not.toContain("pendingCodeExpiresAt");
    expect(reply).not.toContain("{");
  });

  it("formats only curated social integration status fields", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.author.integration-status")!;
    const reply = formatAssistantResult(operation, { status: "success", data: {
      facebookConnected: true, facebookPageName: "iGen Hà Nội",
      tiktokConnected: false, tiktokUsername: "igen_hn", zaloConnected: true, zaloName: "iGen OA",
      accessToken: "hidden-access-token", appSecret: "hidden-app-secret", pageId: "internal-page-id",
    } });
    expect(reply).toContain("Facebook đã kết nối: Có");
    expect(reply).toContain("Trang Facebook: iGen Hà Nội");
    expect(reply).toContain("Tài khoản TikTok: igen_hn");
    expect(reply).not.toContain("hidden-");
    expect(reply).not.toContain("internal-page-id");
    expect(reply).not.toContain("{");
  });

  it("formats AI subscription plans and usage as concise business information", () => {
    const plans = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai-subscription.plans")!;
    const planReply = formatAssistantResult(plans, { data: { plans: [{ code: "TEAM", name: "Gói nhóm", description: "Dùng cho doanh nghiệp", durationDays: 30, aiLimit: 500, priceVnd: 250000, createdBy: "internal-user" }] } });
    expect(planReply).toContain("Gói nhóm");
    expect(planReply).toContain("250.000 ₫");
    expect(planReply).not.toContain("internal-user");
    expect(planReply).not.toContain("{");

    const summary = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.ai-subscription.summary")!;
    const summaryReply = formatAssistantResult(summary, { data: {
      planName: "Gói nhóm", subscriptionStatus: "active", billingScope: "company", aiLimit: 500, used: 42, remaining: 455,
      expiresAt: "2026-11-30T00:00:00.000Z", usage: [{ kind: "content_generation", model: "model-x", units: 2, status: "succeeded", userId: "internal-user" }],
    } });
    expect(summaryReply).toContain("Lượt còn lại: 455");
    expect(summaryReply).toContain("Số lượt: 2");
    expect(summaryReply).not.toContain("internal-user");
    expect(summaryReply).not.toContain("{");
  });

  it("formats Canva connection status without exposing OAuth data", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.canva.status")!;
    const reply = formatAssistantResult(operation, { status: "success", data: {
      connected: true, connectedAt: "2026-10-30T00:00:00.000Z", accessToken: "hidden-token", userId: "internal-user-id",
    } });
    expect(reply).toContain("Đã kết nối Canva: Có");
    expect(reply).toContain("Kết nối lúc:");
    expect(reply).not.toContain("hidden-token");
    expect(reply).not.toContain("internal-user-id");
    expect(reply).not.toContain("{");
  });

  it("formats campaign analytics as a concise Vietnamese report without raw nested data", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.campaign.analytics.summary")!;
    const reply = formatAssistantResult(operation, { data: {
      campaignTitle: "Khai trương chi nhánh", startDate: "2026-10-01", endDate: "2026-10-07", platform: "all",
      overview: { totalSlots: 10, publishedSlots: 7, failedSlots: 1, pendingApprovalSlots: 2, successRate: 70, totalAiCost: 999 },
      platformMetrics: { totalLikes: 40, totalComments: 8, totalShares: 3, totalViews: 1200, totalReach: 900, totalClicks: 12 },
      byPlatform: [{ platform: "Facebook", total: 10, published: 7, failed: 1, postUrl: "https://private.example" }],
      byDate: Array.from({ length: 9 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, planned: 1, published: 1, likes: 2, views: 20, secret: "hidden" })),
      qualityScores: { avgScore: 86, byDimension: { hook: 88 } },
      topErrors: ["SECRET INTERNAL ERROR"],
    } });

    expect(reply).toContain("Chiến dịch: Khai trương chi nhánh");
    expect(reply).toContain("Bài đăng: 7/10 đã đăng · 1 lỗi · 2 chờ duyệt");
    expect(reply).toContain("Lượt xem: 1.200");
    expect(reply).toContain("Điểm chất lượng nội dung trung bình: 86/100");
    expect(reply).toContain("Còn 2 ngày trong báo cáo.");
    expect(reply).not.toContain("totalAiCost");
    expect(reply).not.toContain("999");
    expect(reply).not.toContain("postUrl");
    expect(reply).not.toContain("private.example");
    expect(reply).not.toContain("SECRET");
    expect(reply).not.toContain("{");
  });

  it("formats company order summaries without returning raw JSON or customer contact data", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.order-sheet.orders.list")!;
    const reply = formatAssistantResult(operation, { data: [{
      customerName: "Nguyễn An", itemsSummary: "2 × Bánh kem · Socola", totalAmount: 350000,
      orderStatus: "confirmed", createdAt: "2026-10-30T00:00:00.000Z", depositStatus: "verified", paymentMethod: "bank_transfer",
      customerPhone: "0988123456", deliveryAddress: "Số 1 đường A", paymentCode: "secret-payment-code",
    }] });
    expect(reply).toContain("Khách hàng: Nguyễn An");
    expect(reply).toContain("Tổng tiền: 350.000 ₫");
    expect(reply).not.toContain("0988123456");
    expect(reply).not.toContain("Số 1 đường A");
    expect(reply).not.toContain("secret-payment-code");
    expect(reply).not.toContain("{");
  });

  it("formats Telegram and product catalog settings as concise Vietnamese status", () => {
    const telegram = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.telegram-order.config-status")!;
    const telegramReply = formatAssistantResult(telegram, { data: {
      enabled: true, notifyNewOrder: true, botConfigured: true, botUsername: "igen_order_bot",
      lastTestedAt: "2026-10-30T00:00:00.000Z", lastTestStatus: "success", groupChatId: "-1001234567890",
    } });
    expect(telegramReply).toContain("Kết quả kiểm tra: Kết nối hoạt động");
    expect(telegramReply).toContain("Bot đã cấu hình: Có");
    expect(telegramReply).not.toContain("-1001234567890");
    expect(telegramReply).not.toContain("{");

    const catalog = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.product-catalog.config")!;
    const catalogReply = formatAssistantResult(catalog, { data: {
      enabled: true, maxImagesPerReply: 4, catalogName: "Bộ sưu tập", itemLabel: "Mẫu bánh",
      selectionMessage: "Chọn mẫu phù hợp", businessDescription: "Tiệm bánh gia đình",
      rootFolderUrl: "https://drive.google.com/drive/folders/private-folder", serviceAccountEmail: "service-account@example.test",
    } });
    expect(catalogReply).toContain("Tên thư viện: Bộ sưu tập");
    expect(catalogReply).toContain("Số ảnh tối đa mỗi lần trả lời: 4");
    expect(catalogReply).not.toContain("private-folder");
    expect(catalogReply).not.toContain("service-account@example.test");
    expect(catalogReply).not.toContain("{");
  });

  it("formats SePay settings with a masked configuration summary", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.sepay.config")!;
    const reply = formatAssistantResult(operation, { data: {
      enabled: true, webhookConfigured: true, depositEnabled: true, depositPercent: 35, paymentCodePrefix: "DH",
      lastWebhookAt: "2026-10-30T00:00:00.000Z", lastWebhookStatus: "success", accountCount: 2,
      webhookId: "private-webhook-id", accountNumbers: ["1234567890"], webhookSecret: "hidden-secret",
    } });
    expect(reply).toContain("Tỷ lệ đặt cọc: 35%");
    expect(reply).toContain("Số tài khoản nhận webhook: 2");
    expect(reply).toContain("Trạng thái webhook: Đã nhận thanh toán");
    expect(reply).not.toContain("private-webhook-id");
    expect(reply).not.toContain("1234567890");
    expect(reply).not.toContain("hidden-secret");
    expect(reply).not.toContain("{");
  });

  it("formats the product catalog scan as counts and category names", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "marketing.product-catalog.config.test")!;
    const reply = formatAssistantResult(operation, { data: {
      categoryCount: 2, imageCount: 12, categories: [{ name: "Bánh kem", imageCount: 7 }, { name: "Bánh mì", imageCount: 5 }],
      previewImageUrl: "https://drive.google.com/uc?id=private-image-id",
    } });
    expect(reply).toContain("Số danh mục: 2");
    expect(reply).toContain("Số ảnh: 12");
    expect(reply).toContain("Bánh kem");
    expect(reply).not.toContain("private-image-id");
    expect(reply).not.toContain("{");
  });

  it("formats timekeeping location and admin calendar as concise business information", () => {
    const location = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.company.location")!;
    const locationReply = formatAssistantResult(location, { data: {
      addressName: "Văn phòng Hà Nội", allowedRadius: 150, checkInLimit: "08:30", checkOutLimit: "17:30",
      workDays: "Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6", latitude: 21.0285, longitude: 105.8542,
    } });
    expect(locationReply).toContain("Địa chỉ chấm công: Văn phòng Hà Nội");
    expect(locationReply).toContain("Bán kính cho phép (m): 150");
    expect(locationReply).not.toContain("21.0285");
    expect(locationReply).not.toContain("105.8542");

    const calendar = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.work-calendar.list")!;
    const calendarReply = formatAssistantResult(calendar, { data: [{ date: "2026-01-01", name: "Tết Dương lịch", dayTypeLabel: "Ngày nghỉ lễ", isApplied: true, _id: "internal-calendar-id" }] });
    expect(calendarReply).toContain("Ngày nghỉ lễ");
    expect(calendarReply).not.toContain("internal-");
    expect(calendarReply).not.toContain("{");
  });

  it("formats student and inventory list envelopes using useful fields", () => {
    const students = ASSISTANT_OPERATIONS.find(item => item.method === "GET" && item.path === "/students")!;
    const studentReply = formatAssistantResult(students, {
      success: true, students: [{ fullName: "Đỗ Đức Chung", phone: "0980000000", status: ["Đang học"], idCard: "hidden-sensitive-id" }], total: 1,
    });
    expect(studentReply).toContain("Tra cứu học viên · 1 kết quả");
    expect(studentReply).toContain("Họ và tên: Đỗ Đức Chung");
    expect(studentReply).not.toContain("hidden-sensitive-id");

    const counts = ASSISTANT_OPERATIONS.find(item => item.method === "GET" && item.path === "/inventory/counts")!;
    const countReply = formatAssistantResult(counts, {
      status: "success", data: [{ countCode: "KK-001", status: "draft", notes: "Kho tầng 1", _id: "507f1f77bcf86cd799439062" }],
    });
    expect(countReply).toContain("Tra cứu phiếu kiểm kê kho · 1 kết quả");
    expect(countReply).toContain("Mã phiếu kiểm kê: KK-001");
    expect(countReply).not.toContain("507f1f77bcf86cd799439062");
  });

  it("shows student delete impact and completion without exposing record IDs or raw JSON", () => {
    const preview = ASSISTANT_OPERATIONS.find(item => item.id === "student.bulk.delete.preview")!;
    const previewReply = formatAssistantResult(preview, { success: true, data: {
      deletableCount: 1, blockedCount: 1,
      impactSummary: "Đỗ Đức Chung: Lớp học (1): LỚP-01\nNguyễn An: Có dữ liệu không thể xóa",
      deletedIds: ["507f1f77bcf86cd799439095"], studentId: "507f1f77bcf86cd799439095",
    } });
    expect(previewReply).toContain("Hồ sơ có thể xóa: 1");
    expect(previewReply).toContain("Hồ sơ bị chặn: 1");
    expect(previewReply).toContain("Đỗ Đức Chung: Lớp học (1): LỚP-01");
    expect(previewReply).not.toContain("507f1f77bcf86cd799439095");
    expect(previewReply).not.toContain("deletedIds");
    expect(previewReply).not.toContain("{");

    const deletion = ASSISTANT_OPERATIONS.find(item => item.id === "student.bulk.delete")!;
    const deleteReply = formatAssistantResult(deletion, { success: true, data: {
      deletedCount: 1, blockedCount: 0, deletedIds: ["507f1f77bcf86cd799439095"],
    } });
    expect(deleteReply).toContain("Đã xóa: 1");
    expect(deleteReply).toContain("Hồ sơ bị chặn: 0");
    expect(deleteReply).not.toContain("507f1f77bcf86cd799439095");
    expect(deleteReply).not.toContain("{");
  });

  it("shows knowledge-search answers and source titles without document excerpts or provider errors", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.test-search")!;
    const reply = formatAssistantResult(operation, {
      status: "success", query: "Giờ mở cửa?", matches: 2, bestScore: 0.91,
      simulatedAnswer: "Cửa hàng mở cửa từ 9 giờ đến 18 giờ.",
      items: [{
        title: "Giờ hoạt động", documentType: "policy", score: 0.91,
        text: "PRIVATE FULL DOCUMENT EXCERPT", sourceUrl: "https://private.example/doc", documentId: "507f1f77bcf86cd799439091",
      }],
    });
    expect(reply).toContain("Số đoạn phù hợp: 2");
    expect(reply).toContain("Câu trả lời mô phỏng: Cửa hàng mở cửa từ 9 giờ đến 18 giờ.");
    expect(reply).toContain("Giờ hoạt động (policy)");
    expect(reply).not.toMatch(/PRIVATE|private\.example|507f1f77bcf86cd799439091|query:|\{/);

    const failed = formatAssistantResult(operation, { simulatedAnswer: "[Lỗi sinh câu trả lời]: provider error with internal details", items: [] });
    expect(failed).toContain("Chưa tạo được câu trả lời mô phỏng");
    expect(failed).not.toContain("provider error");
  });

  it("formats a paid AI reply test without exposing its log id or debug payload", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "omni-inbox.ai-reply.test")!;
    const reply = formatAssistantResult(operation, {
      text: "Xin chào, cửa hàng mở cửa từ 9 giờ.", mode: "trained", contextMatches: 3,
      dryRun: true, logId: "507f1f77bcf86cd799439092", companyCode: "PRIVATE-COMPANY", visualDiagnostics: { trace: "SECRET" },
    });
    expect(reply).toContain("Câu trả lời thử: Xin chào, cửa hàng mở cửa từ 9 giờ.");
    expect(reply).toContain("Số đoạn tham khảo: 3");
    expect(reply).toContain("Chỉ xem trước; không gửi tin cho khách.");
    expect(reply).not.toMatch(/507f1f77bcf86cd799439092|PRIVATE-COMPANY|SECRET|visualDiagnostics|\{/);
  });

  it("shows a Page chat simulation without internal model state or saved-session fields", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-knowledge.page-chat.simulate")!;
    const reply = formatAssistantResult(operation, {
      text: "Bên em có thể tư vấn thêm về mẫu phù hợp.", stage: "Tư vấn", nextStep: "Hỏi diện tích căn nhà",
      sources: ["Kho tri thức", "ERP"], mode: "ai", known: { phone: "0985000000" }, conversationKey: "PRIVATE-SESSION",
    });
    expect(reply).toContain("Nội dung mô phỏng: Bên em có thể tư vấn thêm về mẫu phù hợp.");
    expect(reply).toContain("Nguồn tham khảo: Kho tri thức, ERP");
    expect(reply).not.toMatch(/0985000000|PRIVATE-SESSION|known|conversationKey|\{/);
  });

  it("formats celebration email previews as readable text without markup or hidden script content", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.celebration.preview")!;
    const reply = formatAssistantResult(operation, { data: {
      subject: "Happy birthday",
      html: "<h1>Hello {{employeeName}}</h1><p>Today is special.</p><script>PRIVATE_SCRIPT_SECRET</script><style>.secret{display:none}</style>",
      internalId: "PRIVATE-ID",
    } });
    expect(reply).toContain("Ti\u00EAu \u0111\u1EC1: Happy birthday");
    expect(reply).toContain("Hello {{employeeName}}\n\nToday is special.");
    expect(reply).toContain("Ch\u1EC9 xem tr\u01B0\u1EDBc; ch\u01B0a l\u01B0u ho\u1EB7c g\u1EEDi email.");
    expect(reply).not.toMatch(/<|PRIVATE_SCRIPT_SECRET|display:none|PRIVATE-ID|internalId/);
  });

  it("summarizes partial celebration settings updates without exposing raw response data", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "company-email.celebration.update")!;
    const reply = formatAssistantResult(operation, { data: {
      updatedFields: ["Email sinh nh\u1EADt", "Gi\u1EDD g\u1EEDi"],
      companyCode: "PRIVATE-COMPANY",
      internalId: "PRIVATE-ID",
      celebrationConfig: { birthdayTemplate: { html: "PRIVATE HTML" } },
    } });
    expect(reply).toContain("Email sinh nh\u1EADt");
    expect(reply).toContain("Gi\u1EDD g\u1EEDi");
    expect(reply).not.toMatch(/PRIVATE-COMPANY|PRIVATE-ID|PRIVATE HTML|celebrationConfig|\{/);
  });

});

describe("formatFriendlyAssistantResult", () => {
  it("explains empty lookups naturally across modules", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "product.list")!;
    const reply = formatFriendlyAssistantResult(operation, []);

    expect(reply).toContain("Mình kiểm tra rồi");
    expect(reply).toContain("phạm vi dữ liệu đang xem");
    expect(reply).not.toContain("ngày khác");
  });

  it("uses clear Vietnamese labels for student, chat, and retail settings", () => {
    const student = ASSISTANT_OPERATIONS.find(item => item.id === "student.list")!;
    const studentReply = formatAssistantResult(student, [{
      fullName: "Hoàng Khoa", registrationDate: "2026-10-30", fee: "250000", paidAmount: 0, status: "Đang học",
    }]);
    expect(studentReply).toContain("Ngày đăng ký: 30/10/2026");
    expect(studentReply).toContain("Học phí: 250.000 ₫");
    expect(studentReply).not.toContain("Registration Date");

    const rooms = ASSISTANT_OPERATIONS.find(item => item.id === "chat.rooms.list")!;
    expect(formatAssistantResult(rooms, [{ name: "Phòng chung", isGroup: false }])).toContain("Phòng nhóm: Không");

    const policy = ASSISTANT_OPERATIONS.find(item => item.id === "retail.points.policy.get")!;
    const policyReply = formatFriendlyAssistantResult(policy, {
      enabled: false, earnVndPerPoint: 10000, redeemVndPerPoint: 1000, maxRedeemPercent: 50, version: 2,
    });
    expect(policyReply).toContain("Tích điểm: Đang tắt");
    expect(policyReply).toContain("Chi tiêu để nhận 1 điểm: 10.000 ₫");
    expect(policyReply).toContain("Giá trị quy đổi mỗi điểm: 1.000 ₫");
    expect(policyReply).not.toContain("Earn Vnd Per Point");
    expect(policyReply).not.toContain("Phiên bản");
  });

  it("names the created labor record without exposing its identifier or contact details", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.create")!;
    const reply = formatFriendlyAssistantResult(operation, {
      worker: { _id: "507f1f77bcf86cd799439011", fullName: "Chung abc", phone: "0900000000", status: "active", laborType: "official" },
    });

    expect(reply).toContain("tạo hồ sơ lao động");
    expect(reply).toContain("Chung abc");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
    expect(reply).not.toContain("0900000000");
  });

  it("introduces lookup results conversationally and explains when a list is shortened", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "timekeeping.records.list")!;
    const reply = formatFriendlyAssistantResult(operation, Array.from({ length: 10 }, (_, index) => ({
      date: "2026-11-02",
      employeeName: `Nhân sự ${index + 1}`,
      attendanceStatus: "Đã vào ca",
      checkIn: "08:00",
      checkOut: null,
    })));

    expect(reply).toContain("Mình tìm thấy 10 kết quả phù hợp cho bạn.");
    expect(reply).toContain("Mình liệt kê 8 mục đầu tiên bên dưới nhé.");
    expect(reply).toContain("Nhân sự 1");
    expect(reply).not.toContain("Tra cứu chấm công nhân sự trong ngày");
  });

  it("formats labor-partner commission policies with localized nested values", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/worker-management/partners/policies")!;
    const reply = formatFriendlyAssistantResult(operation, {
      name: "Chính sách lao động chính thức",
      version: 1,
      effectiveFrom: "2026-11-04T00:00:00.000Z",
      status: "active",
      settlementCycle: { type: "calendar_month", cutoffDay: null },
      official: {
        enabled: true,
        maxMonths: 1,
        milestones: [{ month: 1, amount: 2000000, eligibilityRule: "contract_active" }],
      },
      seasonal: {
        enabled: false,
        hourRounding: { unitMinutes: 1, mode: "nearest" },
        moneyRounding: { unitVnd: 1, mode: "nearest" },
      },
    });

    expect(reply).toContain("Chu kỳ đối soát: Theo tháng dương lịch");
    expect(reply).toContain("Điều kiện: Hợp đồng còn hiệu lực");
    expect(reply).toContain("Hoa hồng lao động thời vụ: Đang tắt");
    expect(reply).not.toContain("calendar_month");
    expect(reply).not.toContain("contract_active");
    expect(reply).not.toContain("nearest");
    expect(reply).not.toContain("Chế độ kho tri thức");
    expect(reply).not.toContain("Thông tin:");
  });

  it("confirms completed changes naturally and keeps the useful details", () => {
    const operation = {
      id: "department.create",
      title: "Tạo phòng ban",
      method: "POST",
      fields: [{ key: "name", label: "Tên", type: "text", source: "body", apiKey: "name" }],
      resultFields: ["name"],
    } as any;

    expect(formatFriendlyAssistantResult(operation, { name: "Kế toán" })).toBe("Xong rồi bạn nhé, mình đã tạo phòng ban.\nTên: Kế toán");
  });

  it("summarizes retail sales and invoice reports without JSON or internal identifiers", () => {
    const sales = ASSISTANT_OPERATIONS.find(item => item.id === "retail.report.summary")!;
    const salesReply = formatFriendlyAssistantResult(sales, {
      range: { from: "2026-11-01", to: "2026-11-05" },
      summary: { orderCount: 4, grossSales: 900000, refunds: 100000, netSales: 800000, collectedAmount: 700000, dueAmount: 100000, averageOrderValue: 200000, grossProfit: 250000, grossMarginPercent: 31.25 },
      paymentMix: [{ method: "cash", amount: 400000 }, { method: "transfer", amount: 300000 }],
      products: [{ productId: "secret-id", productName: "Cốc sứ", sku: "COC-01", netQuantity: 4, netSales: 500000 }],
      debt: { customers: [{ customerId: "secret-customer", customerPhone: "0900000000" }] },
    });
    expect(salesReply).toContain("Đơn hàng: 4");
    expect(salesReply).toContain("Sau hoàn: 800.000 ₫");
    expect(salesReply).toContain("Lợi nhuận gộp: 250.000 ₫");
    expect(salesReply).toContain("Tiền mặt 400.000 ₫");
    expect(salesReply).toContain("Cốc sứ");
    expect(salesReply).not.toContain("secret-id");
    expect(salesReply).not.toContain("secret-customer");
    expect(salesReply).not.toContain("0900000000");
    expect(salesReply).not.toContain("{");

    const invoices = ASSISTANT_OPERATIONS.find(item => item.id === "retail.invoice.summary")!;
    const invoiceReply = formatFriendlyAssistantResult(invoices, {
      range: { from: "2026-11-05", to: "2026-11-05" },
      invoiceCount: 3, issuedCount: 2, voidCount: 1, issuedAmount: 900000, voidAmount: 100000, paidAmount: 800000, dueAmount: 100000,
    });
    expect(invoiceReply).toContain("Tổng số hóa đơn: 3");
    expect(invoiceReply).toContain("Đang phát hành: 2 · 900.000 ₫");
    expect(invoiceReply).toContain("Còn phải thu: 100.000 ₫");
    expect(invoiceReply).not.toContain("{");
  });

  it("formats invoice lookup and detail as readable records without exposing raw JSON", () => {
    const orderDetail = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.detail")!;
    const orderReply = formatFriendlyAssistantResult(orderDetail, {
      orderCode: "DH-CN-0005", customerName: "Nguyễn An", customerPhone: "0900000000", status: "completed", paymentStatus: "paid",
      grandTotal: 250000, paidAmount: 250000, dueAmount: 0, version: 4,
      items: [{ productName: "Cốc sứ", sku: "COC-01", quantity: 1, unitPrice: 250000, lineTotal: 250000, serialNumbers: ["secret-serial"] }],
      payments: [{ method: "cash", amount: 250000, reference: "secret-ref" }],
    });
    expect(orderReply).toContain("DH-CN-0005");
    expect(orderReply).toContain("Cốc sứ");
    expect(orderReply).toContain("Tiền mặt 250.000 ₫");
    expect(orderReply).not.toContain("0900000000");
    expect(orderReply).not.toContain("secret-serial");
    expect(orderReply).not.toContain("secret-ref");
    expect(orderReply).not.toContain("Phiên bản bản ghi");
    expect(orderReply).not.toContain("{");

    const invoiceList = ASSISTANT_OPERATIONS.find(item => item.id === "retail.invoice.list")!;
    const lookupReply = formatFriendlyAssistantResult(invoiceList, {
      items: [{
        invoiceNo: "HD-CN-0001", orderCode: "DH-CN-0001", status: "issued", issuedAt: "2026-11-05T02:30:00.000Z",
        snapshot: { customerName: "Nguyễn An", customerPhone: "0900000000", grandTotal: 500000, paidAmount: 400000, dueAmount: 100000, paymentStatus: "partial" },
      }],
      total: 1, page: 1, limit: 100,
    });
    expect(lookupReply).toContain("HD-CN-0001");
    expect(lookupReply).toContain("Nguyễn An");
    expect(lookupReply).toContain("Thanh toán một phần");
    expect(lookupReply).toContain("500.000 ₫");
    expect(lookupReply).not.toContain("0900000000");
    expect(lookupReply).not.toContain("{");

    const detail = ASSISTANT_OPERATIONS.find(item => item.id === "retail.invoice.detail")!;
    const detailReply = formatFriendlyAssistantResult(detail, {
      invoiceNo: "HD-CN-0002", orderCode: "DH-CN-0002", status: "issued", issuedAt: "2026-11-05T02:30:00.000Z",
      snapshot: {
        customerName: "Nguyễn An", customerPhone: "0900000000", grandTotal: 500000, paidAmount: 500000, dueAmount: 0,
        items: [{ productName: "Cốc sứ", sku: "COC-01", quantity: 2, unitPrice: 250000, lineTotal: 500000, serialNumbers: ["secret-serial"] }],
        payments: [{ method: "transfer", amount: 500000, reference: "secret-ref" }],
      },
    });
    expect(detailReply).toContain("Sản phẩm:");
    expect(detailReply).toContain("Cốc sứ");
    expect(detailReply).toContain("Chuyển khoản 500.000 ₫");
    expect(detailReply).not.toContain("0900000000");
    expect(detailReply).not.toContain("secret-serial");
    expect(detailReply).not.toContain("secret-ref");
    expect(detailReply).not.toContain("{");
  });

  it("summarizes a created retail coupon in Vietnamese without raw enum values", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.coupon.create")!;
    const reply = formatAssistantResult(operation, {
      code: "SALE10",
      name: "Uu dai thang 11",
      discountType: "percent",
      value: 10,
      minSubtotal: 200000,
      maxDiscount: 50000,
      startsAt: "2026-11-05T00:00:00.000Z",
      endsAt: "2026-11-30T23:59:00.000Z",
      usageLimit: null,
      active: true,
      customerTierCodes: [],
    });

    expect(reply).toContain("\u004D\u00E3 \u01B0u \u0111\u00E3i: SALE10");
    expect(reply).toContain("M\u1EE9c gi\u1EA3m: 10%");
    expect(reply).toContain("\u0110\u01A1n t\u1ED1i thi\u1EC3u: 200.000 \u20AB");
    expect(reply).toContain("L\u01B0\u1EE3t s\u1EED d\u1EE5ng: Kh\u00F4ng gi\u1EDBi h\u1EA1n");
    expect(reply).toContain("Tr\u1EA1ng th\u00E1i: \u0110\u00E3 k\u00EDch ho\u1EA1t");
    expect(reply).not.toContain("percent");
    expect(reply).not.toContain("{");
  });

});
