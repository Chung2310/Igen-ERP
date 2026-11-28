import { describe, expect, it } from "vitest";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { operationById } from "./catalog";
import { formatFriendlyAssistantResult } from "./result-format";

it('keeps the selected class recurring weekdays and times in its shared result table', () => {
  const reply = formatFriendlyAssistantResult(operationById('student.batch.detail')!, {data:{_id:'private-class',name:'QA-KY-NANG-SO',daysOfWeek:[1,3],startTime:'19:00',endTime:'21:00',startDate:'2026-11-01',endDate:'2026-12-31'}});
  expect(parseAssistantResultTable(reply)?.rows).toHaveLength(1);
  expect(reply).toContain('19:00'); expect(reply).toContain('21:00'); expect(reply).toContain('Thứ 2');
  expect(reply).not.toContain('private-class');
});

it("renders marketing campaign summaries in the shared table without internal IDs or briefs", () => {
  const reply = formatFriendlyAssistantResult(operationById("marketing.campaign.list")!, { data: {
    campaigns: [{
      _id: "private-campaign-id", title: "Chiến dịch khuyến mãi QA", status: "active", campaignType: "campaign",
      startDate: "2026-11-01", endDate: "2026-12-31", sourceBrief: "private campaign brief",
    }],
    pagination: { page: 1, limit: 100, hasMore: false },
  } });
  const table = parseAssistantResultTable(reply);
  expect(table?.rows[0].values["Chiến dịch"]).toBe("Chiến dịch khuyến mãi QA");
  expect(table?.rows[0].values["Trạng thái"]).toBe("Đang hoạt động");
  expect(table?.rows[0].values["Bắt đầu"]).toBe("01/11/2026");
  expect(reply).not.toContain("private-campaign-id");
  expect(reply).not.toContain("private campaign brief");
});

it("renders student debt and missing-submission reports in the shared table format", () => {
  const debt = formatFriendlyAssistantResult(operationById("student.debt.report")!, { data: {
    studentCount: 1, totalOutstandingAmount: 2500000,
    students: [{ fullName: "Nguyễn An", courseName: "Tiếng Anh", outstandingAmount: 2500000, studentId: "private-student" }],
  } });
  expect(parseAssistantResultTable(debt)?.rows[0].values["Còn nợ"]).toContain("2.500.000");
  expect(debt).not.toContain("private-student");

  const submissions = formatFriendlyAssistantResult(operationById("student.assignment.missing-submissions")!, { data: {
    assignmentCount: 1, missingCount: 1,
    students: [{ assignmentTitle: "Test module đăng nhập", batchName: "QA-HN-01", studentName: "Trần Bình", dueDate: "2026-11-30T12:00:00.000Z" }],
  } });
  expect(parseAssistantResultTable(submissions)?.rows[0].values["Học viên"]).toBe("Trần Bình");
  expect(submissions).toContain("2026");
});

it("renders notification audiences and suspension counts as shared tables", () => {
  const audiences = formatFriendlyAssistantResult(operationById("student.notification.audience.counts")!, { data: {
    upcomingExamCount: 2, unpaidTuitionCount: 3, retakeCount: 1,
  } });
  expect(parseAssistantResultTable(audiences)?.rows).toHaveLength(3);
  expect(audiences).toContain("Còn nợ học phí");

  const suspensions = formatFriendlyAssistantResult(operationById("student.suspension.report")!, { data: {
    studentCount: 1, requestCount: 1, requests: [{ studentName: "Nguyễn An", batchName: "HSK1", requestedAt: "2026-11-10T12:00:00.000Z" }],
  } });
  expect(parseAssistantResultTable(suspensions)?.rows[0].values["Học viên"]).toBe("Nguyễn An");
  expect(suspensions).toContain("10/11/2026");
});

it("renders commission payout method totals in the shared table format", () => {
  const reply = formatFriendlyAssistantResult(operationById("partner.payout.report")!, { data: {
    from: "2026-11-01", to: "2026-11-30", payoutCount: 3, totalAmount: 2400000,
    methodTotals: [
      { method: "Chuyển khoản", payoutCount: 2, totalAmount: 1900000 },
      { method: "Tiền mặt", payoutCount: 1, totalAmount: 500000 },
    ],
  } });
  expect(parseAssistantResultTable(reply)?.rows).toHaveLength(2);
  expect(reply).toContain("2.400.000");
  expect(reply).toContain("Chuyển khoản");
  expect(reply).toContain("Tiền mặt");
});

it("renders the labor overview with all requested metrics and period details", () => {
  const reply = formatFriendlyAssistantResult(operationById("worker.report.overview")!, { data: {
    from: "2026-11-01", to: "2026-11-30", projectCount: 8, workerCount: 24,
    attendanceRate: 87.5, attendedWorkCount: 70, scheduledWorkCount: 80,
    expiringContractCount: 1, expiringContracts: [{ code: "HD-01", workerName: "Nguyễn An", endDate: "2026-11-28" }],
    unpaidCommissionAmount: 1800000, unpaidCommissionSettlementCount: 1,
    unpaidCommissionSettlements: [{ partnerName: "Đối tác A", balanceAmount: 1800000 }],
  } });
  expect(parseAssistantResultTable(reply)?.rows).toHaveLength(5);
  expect(reply).toContain("87,5%");
  expect(reply).toContain("1.800.000");
  expect(reply).toContain("HD-01");
});

it("renders roadmap and step fields for a specific class in the shared table format", () => {
  const reply = formatFriendlyAssistantResult(operationById("student.batch.roadmap.lookup")!, { data: { batches: [{
    code: "IGEN-1", name: "IGENTEST-1", roadmapName: "Kiểm thử phần mềm dành cho người trái ngành", roadmapStepNumber: 2,
    courseTitle: "API Testing với Postman", _id: "private-batch", roadmapId: "private-roadmap",
  }] } });
  const table = parseAssistantResultTable(reply);
  expect(table?.rows[0].values["Lộ trình"]).toBe("Kiểm thử phần mềm dành cho người trái ngành");
  expect(table?.rows[0].values["Chặng"]).toBe("2");
  expect(reply).not.toContain("private-batch");
  expect(reply).not.toContain("private-roadmap");
});

it("shows labor type counts in Vietnamese labels", () => {
  const reply = formatFriendlyAssistantResult(operationById("worker.report")!, [
    { laborType: "official", workerCount: 2 },
    { laborType: "seasonal", workerCount: 1 },
  ]);
  expect(parseAssistantResultTable(reply)?.rows.map(row => row.values["laborType"] || row.values["Loại lao động"])).toContain("Chính thức");
  expect(reply).toContain("Thời vụ");
});

it("does not imply commission policies have an expiry date", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.partner.commission.policy.list")!, [{
    partnerName: "Đinh Viết Tường", effectiveAt: "2026-11-01T00:00:00.000Z", config: { phoneAmount: 200000 }, partnerId: "private-partner",
  }]);
  expect(reply).toContain("chưa thể xác định chính sách nào sắp hết hiệu lực");
  expect(reply).not.toContain("private-partner");
});

it("keeps the requested report type for shared inventory summaries", () => {
  const catalog = formatFriendlyAssistantResult(operationById("inventory.catalog.analysis")!, {
    data: { reportType: "product-count", summary: { productCount: 12 }, categories: [], products: [] },
  });
  expect(catalog).toContain("12 dòng sản phẩm");
  expect(catalog).not.toContain("Danh mục chưa có");

  const serial = formatFriendlyAssistantResult(operationById("inventory.serial.analysis")!, {
    reportType: "product-stock-and-serial", summary: { skuAvailableQuantity: 6, total: 0, repairing: 0 },
    products: [{ productName: "Huawei Honor 600", skuAvailableQuantity: 6, total: 0, repairing: 0 }],
  });
  expect(serial).toContain("Huawei Honor 600");
  expect(serial).toContain("SKU còn khả dụng");
  expect(serial).toContain("Đang sửa");
  expect(serial).not.toContain("Không có IMEI/serial phù hợp");
});

it("shows actual quantity and variance in serial reconciliation tables", () => {
  const reply = formatFriendlyAssistantResult(operationById("inventory.serial.analysis")!, { data: {
    reportType: "reconciliation",
    summary: { total: 2, inStock: 1, physicalQuantity: 4, variance: -3, matches: 0, mismatches: 1 },
    products: [{ productName: "iPhone 14", sku: "IP14-128", total: 2, inStock: 1, physicalQuantity: 4, variance: -3, matches: false }],
  } });
  const table = parseAssistantResultTable(reply);
  expect(table?.headers).toEqual(["D\u00f2ng m\u00e1y", "SKU", "T\u1ed5ng IMEI", "IMEI trong kho", "T\u1ed3n th\u1ef1c t\u1ebf", "Ch\u00eanh l\u1ec7ch", "\u0110\u1ed1i chi\u1ebfu"]);
  expect(table?.rows[0].values["T\u1ed3n th\u1ef1c t\u1ebf"]).toBe("4");
  expect(table?.rows[0].values["Ch\u00eanh l\u1ec7ch"]).toBe("-3");
  expect(table?.rows[0].values["\u0110\u1ed1i chi\u1ebfu"]).toBe("L\u1ec7ch");
  expect(reply).toContain("SKU kh\u1edbp: 0 · SKU l\u1ec7ch: 1");
});

it("renders an uncoded retail draft as a document rather than its line items", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.order.draft.create")!, { data: {
    _id: "private-order", status: "draft", grandTotal: 100000, dueAmount: 100000, version: 0,
    items: [{ productId: "private-product", name: "Điện thoại", quantity: 1 }],
  } });
  expect(parseAssistantResultTable(reply)?.rows).toHaveLength(1);
  expect(reply).toContain("100.000");
  expect(reply).not.toContain("private-order");
  expect(reply).not.toContain("private-product");
});

it("summarizes retail returns and does not claim installment status when only debt data exists", () => {
  const returns = formatFriendlyAssistantResult(operationById("retail.after-sale.customer-return-summary")!, {
    customerCount: 3, returnCount: 4, refundTotal: 1_250_000,
  });
  expect(returns).toContain("3 khách hàng riêng biệt");
  expect(returns).toContain("1.250.000");
  const debt = formatFriendlyAssistantResult(operationById("retail.order.installment-balances")!, { orders: [], installmentTypeTracked: false });
  expect(debt).toContain("không có cờ riêng");
});

it("does not claim that returned goods were put back into stock", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.after-sale.list")!, [{
    code: "PT-001", type: "return", status: "completed", orderCode: "DH-001",
    customerName: "Khách A", totalAmount: 250_000,
  }]);
  expect(parseAssistantResultTable(reply)?.rows).toHaveLength(1);
  expect(reply).toContain("không xác nhận tình trạng hàng đã nhập lại kho");
});

it("labels retail dealers separately from suppliers", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.partner.supplier-dealer-directory")!, {
    partners: [
      { name: "Nhà cung cấp A", phone: "0900000001", partnerType: "supplier" },
      { name: "Đại lý B", phone: "0900000002", partnerType: "dealer" },
    ],
  });
  expect(reply).toContain("Nhà cung cấp A · Nhà cung cấp");
  expect(reply).toContain("Đại lý B · Đại lý");
});

it("renders separate cancellation and POS variance leaders without internal ids", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.report.employee-cancelled-cash-variance")!, {
    range: { from: "2026-11-01", to: "2026-11-30" },
    cancellationLeader: { employeeName: "Thu ngân An", cancelledOrders: 2 },
    varianceLeader: { cashierName: "Thu ngân Bình", shiftCount: 3, totalAbsoluteVariance: 75_000, netVariance: -25_000, _id: "private-shift" },
    unattributedCancelledOrders: 1,
  });
  expect(reply).toContain("Thu ngân An · 2 đơn");
  expect(reply).toContain("Thu ngân Bình · 3 ca · tổng độ lệch tuyệt đối 75.000");
  expect(reply).toContain("1 đơn hủy không có tên người thực hiện");
  expect(reply).not.toContain("private-shift");
});

it("reports an exact POS order miss without substituting a nearby order", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.order.warranty-match")!, {
    range: { from: "2026-10-30", to: "2026-10-30" }, exactTotal: 35_000_000, matches: [],
  });
  expect(reply).toContain("Không tìm thấy đơn bán khớp chính xác");
  expect(reply).toContain("35.000.000");
  expect(reply).toContain("không chọn đơn gần giống");
});

it("counts all report rows before limiting the visible table", () => {
  const rows = Array.from({length:18}, (_, i) => ({ projectName: "Kho vận", workerName: `Lao động ${i}`, date: "2026-11-18", status: "Present" }));
  const reply = formatFriendlyAssistantResult(operationById("worker.report")!, rows);
  expect(reply).toContain("18 kết quả");
});

it("labels POS product availability as stock in the shared result table", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.order.products.list")!, [{
    name: "iPhone 14 - Titan Sa Mạc",
    variantName: "Titan Sa Mạc",
    sku: "IP14-TITAN",
    stock: 1,
    price: 30_000_000,
    trackingMode: "serial",
  }]);

  expect(reply).toContain("Tồn khả dụng: 1");
  expect(reply).not.toContain("Thông tin: 1");
});

it("shows available retail ranking rows, zero counts, and customer birthdays without AI rewriting", () => {
  const topProducts = formatFriendlyAssistantResult(operationById("retail.report.top-products")!, { data: {
    range: { from: "2026-11-01", to: "2026-11-30" },
    products: [
      { productName: "Redmi Note 14", netQuantity: 2, netSales: 14_000_000 },
      { productName: "iPhone 15 Pro Max", netQuantity: 2, netSales: 62_000_000 },
    ],
  } });
  const topProductsTable = parseAssistantResultTable(topProducts);
  expect(topProductsTable?.rows).toHaveLength(2);
  expect(topProductsTable?.headers).toEqual(["Mặt hàng", "Số lượng bán", "Doanh thu"]);
  expect(topProductsTable?.rows[0].values["Mặt hàng"]).toBe("Redmi Note 14");
  expect(topProductsTable?.rows[1].values["Mặt hàng"]).toBe("iPhone 15 Pro Max");
  expect(topProducts).toContain("Redmi Note 14");
  expect(topProducts).toContain("2 sản phẩm");
  expect(topProducts).toContain("01/11/2026 đến 30/11/2026");
  expect(topProducts).not.toContain("Chưa đủ dữ liệu để xác định");

  const serialRanking = formatFriendlyAssistantResult(operationById("inventory.serial.stock-ranking")!, { data: {
    products: [{ productName: "iPhone 14", imeiCount: 12 }],
  } });
  const serialRankingTable = parseAssistantResultTable(serialRanking);
  expect(serialRankingTable?.headers).toEqual(["Dòng máy", "IMEI đang tồn"]);
  expect(serialRankingTable?.rows[0].values["IMEI đang tồn"]).toBe("12");

  const tiers = formatFriendlyAssistantResult(operationById("customer.tier.counts")!, { data: {
    total: 8, tiers: [{ name: "Hạng Bạc", count: 0 }, { name: "Hạng Vàng", count: 2 }], unranked: 6,
  } });
  expect(tiers).toContain("Hạng Bạc: 0");
  expect(tiers).toContain("Hạng Vàng: 2");
  expect(tiers).toContain("Chưa xếp hạng: 6");
  expect(tiers).toContain("Không có hạng tên VIP trong cấu hình hiện tại.");

  const birthdays = formatFriendlyAssistantResult(operationById("customer.upcoming-birthdays")!, { data: {
    total: 1, truncated: false, items: [{ name: "Lê Anh Tú", customerCode: "KH-001", birthdayDate: "2026-11-28" }],
  } });
  expect(birthdays).toContain("Lê Anh Tú");
  expect(birthdays).toContain("28/11/2026");
  expect(birthdays).not.toContain("KH-001");

  const duplicateBirthdays = formatFriendlyAssistantResult(operationById("customer.upcoming-birthdays")!, { data: {
    total: 2, truncated: false, items: [
      { name: "Lê Anh Tú", customerCode: "KH-HN-001", birthdayDate: "2026-11-28" },
      { name: "Lê Anh Tú", customerCode: "KH-HCM-001", birthdayDate: "2026-11-28" },
    ],
  } });
  expect(duplicateBirthdays).toContain("Mã KH-HN-001");
  expect(duplicateBirthdays).toContain("Mã KH-HCM-001");
});

it("formats attendance counts as people and hides internal versions", () => {
  const reply = formatFriendlyAssistantResult(operationById("student.batch.attendance.summary")!, {className:"A",date:"2026-11-18",startTime:"19:00",endTime:"21:00",location:"P204",remainingSlots:4,total:1,present:1,late:0,absent:0,version:2});
  expect(reply).toContain("Tổng học viên: 1");
  expect(reply).toContain("Giờ bắt đầu: 19:00");
  expect(reply).toContain("Số chỗ còn lại: 4");
  expect(reply).not.toContain("₫");
  expect(reply).not.toContain("Phiên bản");
});

it("calculates today's check-in rate against every employee in the selected scope", () => {
  const reply = formatFriendlyAssistantResult(operationById("timekeeping.records.overview")!, [
    { date: "2026-11-25", employeeName: "An", attendanceStatus: "Đã vào ca", checkIn: "2026-11-25T01:00:00.000Z" },
    { date: "2026-11-25", employeeName: "Bình", attendanceStatus: "Chưa ghi nhận", checkIn: null },
    { date: "2026-11-25", employeeName: "Chi", attendanceStatus: "Nghỉ phép", checkIn: null },
  ]);

  const table = parseAssistantResultTable(reply);
  expect(Object.values(table?.rows[0]?.values || {})).toEqual(expect.arrayContaining(["3", "1", "2", "33,33%"]));
  expect(reply).toContain("trên tổng nhân sự trong phạm vi đã chọn");
});

it("includes department in the shared onboarded recruitment report table", () => {
  const reply = formatFriendlyAssistantResult(operationById("recruitment.report")!, { data: {
    reportType: "onboarded", summary: "2 applicants onboarded.", total: 2,
    items: [{ name: "Nguy\u1ec5n An", jobTitle: "QA Lead", department: "S\u1ea3n ph\u1ea9m", outcome: "hired", occurredAt: "2026-11-10T04:00:00.000Z" }],
  } });

  const table = parseAssistantResultTable(reply);
  expect(Object.values(table?.rows[0]?.values || {})).toContain("S\u1ea3n ph\u1ea9m");
});

it("shows cancellation reason and actor in the retail order result table", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.order.list")!, [{
    orderCode: "POS-CANCELLED-001", status: "cancelled", cancelReason: "Khách đổi nhu cầu", cancelledByName: "Thu ngân QA",
    cancelledBy: "private-actor-id",
  }]);
  const row = parseAssistantResultTable(reply)?.rows[0]?.values;

  expect(row).toMatchObject({ "Mã đơn hàng": "POS-CANCELLED-001", "Lý do hủy": "Khách đổi nhu cầu", "Người hủy": "Thu ngân QA" });
  expect(reply).not.toContain("private-actor-id");
  expect(reply).not.toContain("Thông tin:");
});

it("shows the top cashier by net sales for the selected month", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.report.cashier-ranking")!, { data: {
    range: { from: "2026-11-01", to: "2026-11-30" },
    cashiers: [
      { cashierName: "Thu ngân A", orderCount: 4, grossSales: 2_000_000, refunds: 300_000, netSales: 1_700_000 },
      { cashierName: "Thu ngân B", orderCount: 3, grossSales: 1_500_000, refunds: 0, netSales: 1_500_000 },
    ],
  } });
  const table = parseAssistantResultTable(reply);

  expect(table?.rows).toHaveLength(1);
  expect(table?.rows[0]?.values).toMatchObject({ "Thu ngân": "Thu ngân A", "Doanh số sau hoàn": "1.700.000 ₫", "Số đơn": "4" });
  expect(reply).toContain("01/11/2026 đến 30/11/2026");
});

it("shows the cancellation count and recorded reason for the cancellation date", () => {
  const reply = formatFriendlyAssistantResult(operationById("retail.order.cancelled.report")!, { data: {
    cancelledFrom: "2026-11-27", cancelledTo: "2026-11-27", total: 1,
    items: [{ orderCode: "POS-CANCELLED-002", cancelReason: "Khách đổi nhu cầu", cancelledByName: "Thu ngân QA", cancelledAt: "2026-11-27T08:30:00.000Z", _id: "private-order-id" }],
  } });
  const table = parseAssistantResultTable(reply);

  expect(table?.rows[0]?.values).toMatchObject({ "Mã đơn": "POS-CANCELLED-002", "Lý do hủy": "Khách đổi nhu cầu", "Người hủy": "Thu ngân QA" });
  expect(reply).toContain("27/11/2026");
  expect(reply).not.toContain("private-order-id");
});

it("renders an empty onboarded report as a confirmed zero", () => {
  const reply = formatFriendlyAssistantResult(operationById("recruitment.report")!, { data: {
    reportType: "onboarded", summary: "0 \u1ee9ng vi\u00ean \u0111\u00e3 onboard trong th\u00e1ng 11/2026.", total: 0, items: [],
  } });

  expect(parseAssistantResultTable(reply)).not.toBeNull();
  expect(reply).toContain("0 \u1ee9ng vi\u00ean \u0111\u00e3 onboard");
});

it("hides finance optimistic-lock versions from user-facing results", () => {
  for (const operationId of [
    "finance.treasury.accounts.list",
    "finance.treasury.vouchers.list",
    "finance.treasury.periods.list",
    "finance.debt.list",
  ]) {
    expect(operationById(operationId)!.resultFields, operationId).not.toContain("version");
  }
  expect(operationById("finance.treasury.bank-lines.list")!.resultFields).not.toContain("voucherId");
});

it("does not expose internal scanner identities in asset inventory variances", () => {
  const reply = formatFriendlyAssistantResult(operationById("finance.asset.inventory.variance")!, {
    total: 1,
    counts: { missing: 1 },
    variances: [{ assetId: "507f1f77bcf86cd799439099", assetCode: "FA-001", barcode: "BC-001", name: "Printer", result: "missing", scannedBy: "internal-scanner-uid" }],
  });
  expect(reply).not.toContain("507f1f77bcf86cd799439099");
  expect(reply).not.toContain("internal-scanner-uid");
  expect(reply).toContain("FA-001");
  expect(reply).toContain("Thiếu");
  expect(reply).not.toContain("Thông tin");
});

it("summarizes a finalized asset inventory without exposing actor identifiers", () => {
  const reply = formatFriendlyAssistantResult(operationById("finance.asset.inventory.finalize")!, {
    session: { sessionCode: "KK-2026-11", name: "November inventory", inventoryDate: "2026-11-20T00:00:00.000Z", finalizedBy: "internal-finalizer-id" },
    variance: {
      total: 2,
      counts: { present: 1, missing: 1 },
      variances: [{ assetId: "507f1f77bcf86cd799439098", assetCode: "FA-002", barcode: "BC-002", name: "Projector", result: "missing", scannedBy: "internal-scanner-uid" }],
    },
  });
  expect(reply).toContain("KK-2026-11");
  expect(reply).toContain("20/11/2026");
  expect(reply).toContain("Thiếu: 1");
  expect(reply).toContain("FA-002");
  expect(reply).not.toContain("internal-finalizer-id");
  expect(reply).not.toContain("internal-scanner-uid");
});

it.each(["hr.workflow.create", "hr.workflow.update"])("renders one workflow record instead of its nested steps: %s", actionId => {
  const reply = formatFriendlyAssistantResult(operationById(actionId)!, { data: {
    _id: "507f1f77bcf86cd799439090", name: "Tuyển dụng nhân sự", category: "Nhân sự", description: "Quy trình tuyển dụng",
    steps: [{ id: "private-step", title: "Đăng bài", assigneeUid: "private-user" }, { title: "trả lương" }],
  } });
  const table = parseAssistantResultTable(reply);
  expect(table?.rows).toHaveLength(1);
  expect(Object.values(table!.rows[0].values)).toContain("Tuyển dụng nhân sự");
  expect(reply).not.toContain("private-step");
  expect(reply).not.toContain("private-user");
});

describe("student bulk result formatting", () => {
  it("renders invalid rows with the Excel row, learner, value and reason", () => {
    const operation = operationById("student.bulk.preview")!;
    const reply = formatFriendlyAssistantResult(operation, {
      errors: [{ row: 4, name: "Lê Minh Châu", phone: "SĐT giả lập 003", reason: "Số điện thoại không hợp lệ." }],
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toEqual({
      "Dòng": "4",
      "Học viên": "Lê Minh Châu",
      "Số điện thoại": "SĐT giả lập 003",
      "Lý do": "Số điện thoại không hợp lệ.",
    });
  });

  it("does not say records were created when every row was skipped", () => {
    const operation = operationById("student.bulk.create")!;
    const reply = formatFriendlyAssistantResult(operation, {
      importedCount: 0,
      skippedCount: 1,
      errors: [{ row: 2, name: "Nguyễn Văn An", phone: "SĐT giả lập 001", reason: "Số điện thoại không hợp lệ." }],
    });

    expect(reply).toContain("Đã nhập 0 học viên. Bỏ qua 1 dòng · 1 kết quả:");
    expect(reply).not.toContain("đã tạo nhiều hồ sơ học viên");
    expect(parseAssistantResultTable(reply)?.rows[0]?.values["Học viên"]).toBe("Nguyễn Văn An");
  });
});

describe("nested API result fields", () => {
  it("shows only explicitly approved fields from nested result objects", () => {
    const source = operationById("customer.list")!;
    const operation = {
      ...source,
      title: "Lịch sử giao dịch khách hàng",
      resultFields: ["name", "items"],
      resultChildFields: { items: ["orderCode", "amount"] },
    };
    const reply = formatFriendlyAssistantResult(operation, [{
      name: "La Văn Sến",
      items: [{ orderCode: "DH-001", amount: 250000, customerPhone: "0987000000", internalId: "private-id" }],
    }]);

    expect(reply).toContain("La Văn Sến");
    expect(reply).toContain("DH-001");
    expect(reply).toContain("250.000");
    expect(reply).not.toContain("0987000000");
    expect(reply).not.toContain("private-id");
    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values["Tên khách hàng"]).toBe("La Văn Sến");
    expect(Object.values(table?.rows[0]?.values || {}).join(" ")).toContain("DH-001");
    expect(Object.values(table?.rows[0]?.values || {}).join(" ")).toContain("250.000");
  });
});

describe("shared tables for module lookups", () => {
  it("lists department employees in a safe shared table", () => {
    const operation = operationById("department.employees.list")!;
    const reply = formatFriendlyAssistantResult(operation, [
      { displayName: "Trần Minh", jobTitle: "Quản trị hệ thống", department: "IT", id: "private-id" },
      { displayName: "Hà My", jobTitle: "Hỗ trợ kỹ thuật", department: "IT", _id: "private-id-2" },
    ]);

    const table = parseAssistantResultTable(reply);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0]?.values).toMatchObject({
      "Nhân sự": "Trần Minh",
      "Chức danh": "Quản trị hệ thống",
      "Phòng ban": "IT",
    });
    expect(reply).not.toContain("private-id");
  });

  it("renders generic lookup lists as a table while keeping internal fields hidden", () => {
    const operation = operationById("customer.list")!;
    const reply = formatFriendlyAssistantResult(operation, [{
      customerCode: "KH-001",
      name: "La Văn Sến",
      phone: "0987217127",
      status: "active",
      internalId: "db-private-id",
    }]);

    const table = parseAssistantResultTable(reply);
    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]?.values).toMatchObject({
      "Mã khách hàng": "KH-001",
      "Tên khách hàng": "La Văn Sến",
      "Số điện thoại": "0987217127",
      "Trạng thái": "Đang hoạt động",
    });
    expect(reply).not.toContain("db-private-id");
  });
});

describe("HR reports", () => {
  it("returns department head and employee count in the shared result table", () => {
    const operation = operationById("department.lookup")!;
    const reply = formatFriendlyAssistantResult(operation, [{ name: "Phòng Tài chính", managerName: "Mai Anh", employeeCount: 6 }]);

    expect(parseAssistantResultTable(reply)?.rows[0]?.values).toMatchObject({
      "Phòng ban": "Phòng Tài chính", "Trưởng phòng": "Mai Anh", "Số nhân sự": "6",
    });
  });

  it("filters daily attendance rows to the requested late-arrival report", () => {
    const operation = operationById("timekeeping.records.late")!;
    const reply = formatFriendlyAssistantResult(operation, [
      { employeeName: "Nam Văn Tú", date: "2026-11-17", attendanceStatus: "Đã vào ca, đi muộn", checkIn: "2026-11-17T00:59:00.000Z" },
      { employeeName: "Lê Thu An", date: "2026-11-17", attendanceStatus: "Đã vào và ra ca", checkIn: "2026-11-17T00:20:00.000Z" },
    ]);

    expect(reply).toContain("Nam Văn Tú");
    expect(reply).toContain("ngày 17/11/2026");
    expect(reply).not.toContain("hôm nay");
    expect(reply).not.toContain("Lê Thu An");
    expect(parseAssistantResultTable(reply)?.rows[0]?.values["Trạng thái"]).toBe("Đã vào ca, đi muộn");
  });

  it("uses the selected attendance date when no rows match the requested status", () => {
    const operation = operationById("timekeeping.records.late")!;
    const reply = formatFriendlyAssistantResult(operation, [
      { employeeName: "Lê Thu An", date: "2026-11-25", attendanceStatus: "Đã vào và ra ca" },
    ]);

    expect(reply).toContain("Không ghi nhận nhân sự đi muộn trong ngày 25/11/2026.");
    expect(reply).not.toContain("hôm nay");
  });

  it("shows product profit ranking when the retail report includes authorized profit fields", () => {
    const operation = operationById("retail.report.summary")!;
    const reply = formatFriendlyAssistantResult(operation, {
      range: { from: "2026-10-27", to: "2026-11-26" },
      summary: { orderCount: 2, grossSales: 3_000_000, refunds: 0, netSales: 3_000_000, collectedAmount: 3_000_000, dueAmount: 0, averageOrderValue: 1_500_000, grossProfit: 500_000, grossMarginPercent: 16.7 },
      products: [
        { productName: "Bán nhiều nhất", netQuantity: 5, netSales: 2_000_000, profit: 100_000 },
        { productName: "Lãi cao nhất", netQuantity: 1, netSales: 1_000_000, profit: 400_000 },
      ],
    });

    expect(reply).toContain("Sản phẩm có lợi nhuận gộp cao nhất:");
    expect(reply.indexOf("1. Lãi cao nhất")).toBeLessThan(reply.indexOf("2. Bán nhiều nhất"));
    expect(reply).toContain("Thời gian: 27/10/2026 đến 26/11/2026");
  });

  it("reports expiring employee contracts without exposing internal identifiers", () => {
    const operation = operationById("hr.contract.expiring.list")!;
    const reply = formatFriendlyAssistantResult(operation, {
      expiryAlerts: [{ _id: "507f1f77bcf86cd799439011", employeeName: "Nam Văn Tú", contractType: "Xác định thời hạn", endDate: "2026-11-30", daysRemaining: 13 }],
      expiryAlertTotal: 1,
      expiryAlertDays: 20,
    });

    expect(reply).toContain("Nam Văn Tú");
    expect(reply).toContain("13 ngày");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
  });

  it("renders birthdays without exposing birth years", () => {
    const operation = operationById("employee.birthday.next-month")!;
    const reply = formatFriendlyAssistantResult(operation, {
      birthdays: [{ displayName: "Nguyễn Anh", birthday: "04/12", birthDate: "1990-12-04", id: "private-id" }],
      total: 1,
      month: 12,
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toMatchObject({ "Nhân sự": "Nguyễn Anh", "Ngày sinh": "04/12" });
    expect(reply).not.toContain("1990");
    expect(reply).not.toContain("private-id");
  });

  it("lists only unfinished internal training and flags a truncated scan", () => {
    const operation = operationById("hr.training.incomplete.list")!;
    const reply = formatFriendlyAssistantResult(operation, {
      incompleteEnrollments: [{ employeeName: "Nguyễn Anh", courseTitle: "An toàn lao động", progress: 35, status: "in_progress", uid: "private-id" }],
      incompleteTotal: 1,
      fetchedTotal: 1000,
      overallTotal: 1200,
      truncated: true,
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toMatchObject({ "Nhân sự": "Nguyễn Anh", "Khóa đào tạo": "An toàn lao động", "Tiến độ": "35%", "Trạng thái": "Đang học" });
    expect(reply).toContain("Kết quả có thể chưa bao gồm toàn bộ nhân sự");
    expect(reply).not.toContain("private-id");
  });

  it("keeps the requested course name and says course of study in an empty report", () => {
    const operation = operationById("hr.training.incomplete.list")!;
    const reply = formatFriendlyAssistantResult(operation, {
      incompleteEnrollments: [], incompleteTotal: 0, courseName: "hát",
    });

    expect(reply).toContain("Không có lượt học nào chưa hoàn thành khóa học hát");
  });

  it("confirms a contract extension with the employee and formatted dates", () => {
    const operation = operationById("hr.contract.extend")!;
    const reply = formatFriendlyAssistantResult(operation, {
      employeeName: "Nguyễn Anh", previousEndDate: "2026-12-31T00:00:00.000Z",
      newEndDate: "2027-04-30T00:00:00.000Z", extensionDate: "2026-11-17T00:00:00.000Z", contractId: "private-id",
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toMatchObject({ "Nhân sự": "Nguyễn Anh" });
    expect(reply).toContain("30/04/2027");
    expect(reply).not.toContain("private-id");
  });
});

it("renders inventory analysis rows as shared tables and hides internal identifiers", () => {
  const reply = formatFriendlyAssistantResult(operationById("inventory.stock.analysis")!, { data: {
    reportType: "stock-summary",
    summary: { productCount: 1, stockQuantity: 7, inventoryValue: 210_000_000 },
    products: [{ _id: "private-stock-row", productName: "iPhone 14", sku: "IP14-01", quantity: 7, inventoryValue: 210_000_000 }],
  } });

  const table = parseAssistantResultTable(reply);
  expect(table?.rows).toHaveLength(1);
  expect(Object.values(table?.rows[0]?.values || {})).toEqual(expect.arrayContaining(["iPhone 14", "IP14-01", "7", "210.000.000 ₫"]));
  expect(reply).not.toContain("private-stock-row");
});

it("renders stock movement summaries as a shared table", () => {
  const reply = formatFriendlyAssistantResult(operationById("inventory.stock-log.analysis")!, { data: {
    reportType: "issue-counts",
    summary: [{ period: "11/2026", documentType: "Xuất bán hàng", documentCount: 3, totalQuantity: 6 }],
    transactions: [],
  } });

  const table = parseAssistantResultTable(reply);
  expect(table?.rows).toHaveLength(1);
  expect(Object.values(table?.rows[0]?.values || {})).toEqual(expect.arrayContaining(["11/2026", "Xuất bán hàng", "3", "6"]));
});

it("explains that warehouse Excel export is unavailable and offers an in-chat result", () => {
  const reply = formatFriendlyAssistantResult(operationById("inventory.export.capability")!, { data: {
    finding: "Trợ lý hiện chưa có API tạo tệp Excel cho bảng tồn kho. Có thể xem kết quả trong cuộc trò chuyện.",
  } });

  expect(reply).toContain("chưa có API tạo tệp Excel");
  expect(reply).toContain("cuộc trò chuyện");
});
