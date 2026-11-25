import { operationById, type AssistantOperation } from "./catalog";
import { redactAssistantResult } from "./structured-data";
import { PERMISSION_CATALOG } from "../config/permission-catalog";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";
import { formatBusinessOverview } from "./overview-result";
import { assistantCompletedOperationSummary } from "./reply-presentation";

type ResultOperation = Pick<AssistantOperation, "id" | "title" | "fields" | "resultFields"> & Partial<Pick<AssistantOperation, "method" | "path" | "readOnly" | "resultChildFields">>;
type ResultRecord = Record<string, unknown>;
const normalizeReportStatus = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();

const collectionKeys = ["items", "records", "results", "rows", "transactions", "vouchers", "workers", "partners", "students", "courses", "batches", "enrollments", "exams", "payments", "notifications", "resources", "assignments", "roadmaps", "learningRoadmaps", "steps", "bookings", "categories", "assets", "campaigns", "data"];
const moneyKey = /(?:amount|salary|price|cost|paid|due|remaining|refund|total|tuition|fee|bookValue|depreciation|grossPay|grossProfit|deductions|netPay|cashNet|bankNet|expectedCash|countedCash|balance)/i;
const commonStatusLabels: Record<string, string> = {
  active: "Đang hoạt động", inactive: "Đã ngừng hoạt động", enabled: "Đang bật", disabled: "Đang tắt",
  pending: "Đang chờ", pending_review: "Đang chờ duyệt", pending_confirmation: "Đang chờ xác nhận",
  in_progress: "Đang xử lý", processing: "Đang xử lý", running: "Đang xử lý", queued: "Đang chờ xử lý",
  completed: "Đã hoàn tất", complete: "Đã hoàn tất", succeeded: "Thành công", success: "Thành công",
  failed: "Thất bại", error: "Có lỗi", approved: "Đã duyệt", rejected: "Đã từ chối",
  cancelled: "Đã hủy", canceled: "Đã hủy", open: "Đang mở", closed: "Đã đóng", draft: "Bản nháp",
  archived: "Đã lưu trữ", paused: "Đã tạm dừng", published: "Đã đăng", scheduled: "Đã lên lịch",
  confirmed: "Đã xác nhận", paid: "Đã thanh toán", unpaid: "Chưa thanh toán", expired: "Đã hết hạn",
  overdue: "Quá hạn", available: "Có sẵn", unavailable: "Không khả dụng", in_stock: "Còn hàng",
  out_of_stock: "Hết hàng", in_transit: "Đang vận chuyển", resolved: "Đã xử lý", waiting: "Đang chờ",
  on_hold: "Tạm hoãn", partial: "Hoàn tất một phần", partially_completed: "Hoàn tất một phần",
  review: "Chờ duyệt", unknown: "Chưa xác định", not_started: "Chưa bắt đầu", skipped: "Đã bỏ qua",
  sent: "Đã gửi", sending: "Đang gửi", preview: "Bản xem trước", counting: "Đang kiểm đếm",
  pending_approval: "Chờ duyệt", conflict: "Xung đột tồn kho", needs_assets: "Thiếu ảnh",
  ready: "Sẵn sàng", bulk_queued: "Đang tạo", expiring: "Sắp hết hạn", planned: "Đã lên kế hoạch",
  reviewed: "Đã duyệt", verified: "Đã xác minh", reversed: "Đã đảo", synced: "Đã đồng bộ", received: "Đã nhận",
  ready_for_review: "Chờ duyệt", awaiting_review: "Chờ duyệt", awaiting_provider: "Đang chờ nhà cung cấp",
  generating_context: "Đang tạo nội dung ngữ cảnh", transcribing: "Đang nhận dạng lời thoại", rendering: "Đang kết xuất",
  analyzing: "Đang phân tích", retrying: "Đang thử lại", publishing: "Đang đăng",
  none: "Không áp dụng", unrecorded: "Chưa ghi nhận", placed: "Đã bố trí", present: "Có mặt",
  late: "Đi muộn", absent: "Vắng", excused: "Có phép", "approved-leave": "Nghỉ phép", renewed: "Đã gia hạn", "missing-checkout": "Chưa ghi giờ ra",
  "left-early": "Về sớm", "half-day": "Nửa ngày", "late-left-early": "Đi muộn, về sớm",
  online: "Trực tuyến", offline: "Ngoại tuyến", busy: "Đang bận", away: "Vắng mặt",
  retired: "Đã ngừng áp dụng", ended: "Đã kết thúc", void: "Đã hủy", calculated: "Đã tính", terminated: "Đã chấm dứt",
  snapshotted: "Đã chốt vào bảng lương", receiving: "Đang nhập kho", shipped: "Đã giao",
  delivered: "Đã giao", returned: "Đã trả hàng", refunded: "Đã hoàn tiền", suspended: "Đã tạm khóa",
  locked: "Đã khóa", blocked: "Đã chặn", incomplete: "Chưa hoàn tất", not_required: "Không cần thực hiện",
  awaiting_receipt: "Đang chờ biên lai", receipt_received: "Đã nhận biên lai", untested: "Chưa kiểm tra",
  started: "Đã bắt đầu", reviewing: "Đang xem xét", negotiating: "Đang thương lượng", converted: "Đã chuyển đổi",
};
const enumValueLabelsByKey: Record<string, Record<string, string>> = {
  alertLevel: { ok: "Còn hạn", expiring: "Sắp hết hạn", expired: "Đã hết hạn" },
  discountType: { amount: "Giảm theo số tiền", percent: "Giảm theo phần trăm" },
  productType: { physical: "Hàng hóa", service: "Dịch vụ", bundle: "Gói sản phẩm" },
  type: {
    physical: "Hàng hóa", service: "Dịch vụ", bundle: "Gói sản phẩm", sale_refund: "Hoàn tiền đơn bán",
    sale_payment: "Thu tiền đơn bán", charge: "Phát sinh công nợ", payment: "Thanh toán", adjustment: "Điều chỉnh",
    reversal: "Đảo giao dịch", leave: "Nghỉ phép", training: "Đào tạo", campaign: "Chiến dịch", single: "Bài đơn",
    online: "Trực tuyến", phone: "Điện thoại", onsite: "Tại địa điểm",
  },
  kind: {
    sale_refund: "Hoàn tiền đơn bán", sale_payment: "Thu tiền đơn bán", charge: "Phát sinh công nợ",
    payment: "Thanh toán", adjustment: "Điều chỉnh", reversal: "Đảo giao dịch", bonus: "Thưởng",
    allowance: "Phụ cấp", deduction: "Khấu trừ", correction: "Điều chỉnh", advance: "Tạm ứng",
    content_generation: "Tạo nội dung", image_generation: "Tạo hình ảnh", video_generation: "Tạo video",
  },
  trackingMode: { quantity: "Số lượng", serial: "Số sê-ri/IMEI", lot: "Theo lô", none: "Không theo dõi tồn kho" },
  unitCategory: { count: "Đếm", weight: "Khối lượng", volume: "Thể tích", length: "Chiều dài", time: "Thời gian", other: "Khác" },
  employmentStatus: { official: "Chính thức", probation: "Thử việc", internship: "Thực tập" },
  laborType: { official: "Chính thức", seasonal: "Thời vụ", part_time: "Bán thời gian", full_time: "Toàn thời gian" },
  employmentType: { full_time: "Toàn thời gian", part_time: "Bán thời gian", contract: "Theo hợp đồng", internship: "Thực tập", temporary: "Tạm thời" },
  workplaceType: { onsite: "Tại văn phòng", hybrid: "Kết hợp", remote: "Từ xa" },
  gender: { male: "Nam", female: "Nữ", other: "Khác", undisclosed: "Không muốn nêu" },
  maritalStatus: { single: "Độc thân", married: "Đã kết hôn", divorced: "Đã ly hôn", widowed: "Góa" },
  contractType: { official: "Chính thức", probation: "Thử việc", internship: "Thực tập", temporary: "Tạm thời", fixed_term: "Có thời hạn", indefinite: "Không xác định thời hạn" },
  paymentMethod: { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", transfer: "Chuyển khoản", card: "Thẻ", ewallet: "Ví điện tử", wallet: "Ví điện tử" },
  commissionType: { percentage: "Phần trăm", fixed: "Số tiền cố định" },
  mode: { goods: "Hàng hóa", services: "Dịch vụ", mixed: "Hàng hóa và dịch vụ", speech: "Lời thoại", context: "Ngữ cảnh", combined: "Lời thoại và ngữ cảnh", fullscreen: "Toàn màn hình", window: "Cửa sổ nổi" },
  targetModule: { students: "Học viên", healthcare: "Bệnh nhân", workers: "Người lao động" },
  visibility: { public: "Công khai", private: "Riêng tư", company: "Trong doanh nghiệp" },
  sourceType: { manual: "Thủ công", campaign_orders: "Đơn sản xuất chiến dịch", sheet: "Bảng dữ liệu", system: "Hệ thống" },
  targetType: { standalone: "Tạo riêng", campaign: "Chiến dịch" },
  direction: { in: "Thu", out: "Chi", incoming: "Tiền vào", outgoing: "Tiền ra" },
  account: { cash: "Tiền mặt", bank: "Ngân hàng" },
  profitCategory: { expense: "Chi phí", other: "Khác" },
  costBearer: { supplier: "Nhà cung cấp", shop: "Cửa hàng", customer: "Khách hàng" },
  priority: { low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp" },
  role: { owner: "Chủ doanh nghiệp", admin: "Quản trị viên", deputy: "Phó quản trị viên", member: "Thành viên", cashier: "Thu ngân", manager: "Quản lý", employee: "Nhân viên" },
  actorType: { user: "Người dùng", ai: "Trợ lý AI", system: "Hệ thống" },
  operation: { create: "Tạo mới", update: "Cập nhật", delete: "Xóa", restore: "Khôi phục", list: "Tra cứu", read: "Xem", approve: "Duyệt", reject: "Từ chối", retry: "Thử lại", cancel: "Hủy" },
  format: { online: "Trực tuyến", phone: "Điện thoại", onsite: "Tại địa điểm", remote: "Từ xa", hybrid: "Kết hợp", image: "Hình ảnh", video: "Video", text: "Văn bản" },
  scope: { company: "Toàn doanh nghiệp", branch: "Chi nhánh", personal: "Cá nhân", global: "Toàn hệ thống" },
  trigger: { manual: "Thủ công", scheduled: "Theo lịch", automatic: "Tự động" },
  commissionScheme: { official_monthly: "Chính thức theo tháng", seasonal_hourly: "Thời vụ theo giờ" },
  confirmationSource: { contract: "Hợp đồng", manual: "Thủ công", attendance: "Chấm công" },
  channel: { online: "Trực tuyến", phone: "Điện thoại", onsite: "Tại địa điểm", network: "Mạng", web: "Web", mobile: "Ứng dụng di động", "in-app": "Trong ứng dụng", email: "Email" },
  connectionType: { network: "Mạng", wifi: "Wi-Fi", ethernet: "Mạng dây", mobile: "Mạng di động", wired: "Mạng dây", wireless: "Mạng không dây" },
  network: { network: "Mạng", wifi: "Wi-Fi", ethernet: "Mạng dây", mobile: "Mạng di động", wired: "Mạng dây", wireless: "Mạng không dây" },
  networkType: { network: "Mạng", wifi: "Wi-Fi", ethernet: "Mạng dây", mobile: "Mạng di động", wired: "Mạng dây", wireless: "Mạng không dây" },
};
const weekdayLabels = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const bulkCreateJobOperationIds = ["marketing.bulk-create.jobs.list", "marketing.bulk-create.jobs.detail", "marketing.bulk-create.jobs.cancel", "marketing.bulk-create.jobs.retry"];
const bulkCreateTemplateOperationIds = ["marketing.bulk-create.templates.list", "marketing.bulk-create.templates.detail"];
const labels: Record<string, string> = {
  address: "Địa chỉ", adjustment: "Điều chỉnh", adjustments: "Điều chỉnh", amount: "Số tiền", actorType: "Người thực hiện", bankAccountName: "Chủ tài khoản", baseRevision: "Phiên bản nền",
  bankAccountNo: "Số tài khoản ngân hàng", bankName: "Tên ngân hàng", branchName: "Chi nhánh",
  code: "Mã", countCode: "Mã phiếu kiểm kê", customerName: "Khách hàng", date: "Ngày", deliveredAt: "Ngày bàn giao", description: "Mô tả",
  device: "Thiết bị", dueAmount: "Còn phải trả", dueDate: "Hạn hoàn thành", email: "Email", endDate: "Ngày kết thúc", financeVoucherCode: "Mã phiếu chi", fullName: "Họ và tên",
  commissionRate: "Tỷ lệ hoa hồng", commissionType: "Hình thức hoa hồng", commissionValue: "Mức hoa hồng", isActive: "Đang hoạt động", item: "Thông tin giao dịch", kind: "Loại giao dịch", lines: "Hạng mục", maxStock: "Tồn tối đa", minStock: "Tồn tối thiểu", minTuition: "Doanh số tối thiểu", message: "Thông báo",
  accessoryBps: "Hoa hồng phụ kiện", account: "Tài khoản chi", businessDate: "Ngày giao dịch", effectiveAt: "Ngày áp dụng", effectiveFrom: "Ngày áp dụng từ", phoneAmount: "Hoa hồng mỗi điện thoại", ratePercent: "Tỷ lệ hoa hồng", reference: "Mã giao dịch", repairBps: "Hoa hồng công sửa chữa", sellingPrice: "Giá bán", costPrice: "Giá vốn", productCode: "Mã sản phẩm", productType: "Loại sản phẩm", categoryCode: "Mã thể loại / thư mục", variant: "SKU", variants: "Các SKU", trackingMode: "Theo dõi tồn theo",
  assetCode: "Mã tài sản", assetName: "Tài sản", barcode: "Mã vạch", group: "Nhóm tài sản", originalCost: "Nguyên giá", salvageValue: "Giá trị thanh lý", accumulatedDepreciation: "Khấu hao lũy kế", netBookValue: "Giá trị còn lại", usefulLifeMonths: "Thời gian sử dụng (tháng)", inServiceDate: "Ngày đưa vào sử dụng", disposalAmount: "Tiền thu hồi khi thanh lý", disposalReason: "Lý do thanh lý", accumulatedAfter: "Khấu hao lũy kế sau kỳ", netBookValueAfter: "Giá trị còn lại sau kỳ", custodianName: "Người quản lý", supplierName: "Nhà cung cấp", department: "Bộ phận", location: "Vị trí", period: "Kỳ", sessionCode: "Mã phiên kiểm kê", scope: "Phạm vi kiểm kê", total: "Tổng tài sản", counts: "Số lượng theo kết quả", variances: "Chênh lệch kiểm kê", grossPay: "Tổng thu nhập",
  laborType: "Loại lao động", name: "Tên", legalName: "Pháp nhân xuất hóa đơn", taxId: "Mã số thuế", invoiceEmail: "Email nhận hóa đơn", contactName: "Người liên hệ", isDefault: "Hồ sơ mặc định", warnings: "Lưu ý", netCollected: "Thực thu", note: "Ghi chú", occurredAt: "Thời điểm", occurredOn: "Ngày",
  outcome: "Kết quả quét", paidAmount: "Đã thanh toán", parentCode: "Mã đơn liên quan", payments: "Thanh toán", phone: "Điện thoại",
  productName: "Sản phẩm", quantity: "Số lượng", queued: "Đã xếp hàng gửi", skipped: "Bỏ qua", targetModule: "Phân hệ được liên kết", targetRecordName: "Hồ sơ được liên kết", refundedAmount: "Đã hoàn tiền", refunds: "Hoàn tiền", startDate: "Ngày bắt đầu", postsPerDay: "Số bài mỗi ngày",
  remaining: "Còn có thể hoàn", remainingLabor: "Còn có thể hoàn tiền công", remainingOther: "Còn có thể hoàn khoản khác",
  reservedQuantity: "Đã giữ chỗ", sku: "SKU", startAt: "Thời gian bắt đầu", status: "Trạng thái", summary: "Tóm tắt",
  question: "Câu hỏi", ticketCode: "Mã phiếu sửa chữa", title: "Tiêu đề", totalAmount: "Tổng tiền", unitCode: "Đơn vị", variantName: "Biến thể",
  warehouseName: "Kho", workerName: "Nhân sự",
};

Object.assign(labels, {
  workingDays: "Ngày làm việc", daysOfWeek: "Ngày trong tuần", createdAt: "Ngày tạo",
  clientName: "Khách hàng hoặc đơn vị sử dụng lao động", workerName: "Người lao động", projectName: "Dự án",
  alertLevel: "Cảnh báo hạn hợp đồng", previousEndDate: "Ngày kết thúc kỳ trước", renewedAt: "Ngày gia hạn",
  quota: "Chỉ tiêu lao động", workedMinutes: "Số phút làm việc", checkInAt: "Giờ vào", checkOutAt: "Giờ ra",
  productType: "Loại sản phẩm", employmentStatus: "Tình trạng làm việc", trackingMode: "Cách theo dõi tồn kho",
  unitCategory: "Nhóm đơn vị tính", priority: "Mức độ ưu tiên", role: "Vai trò", format: "Hình thức",
  sourceType: "Nguồn dữ liệu", trigger: "Cách khởi chạy", visibility: "Chế độ hiển thị", targetType: "Phạm vi tạo",
});
Object.assign(labels, { entityPreset: "Loại hồ sơ", isRequired: "Bắt buộc", isVisible: "Đang hiển thị", isArchived: "Đã lưu trữ", placeholder: "Gợi ý nhập" });
Object.assign(labels, { registrationDate: "Ngày đăng ký", fee: "Học phí", isGroup: "Phòng nhóm" });
Object.assign(labels, { recordedPaidAmount: "Đã đóng trên hồ sơ", receiptTotal: "Tổng tiền phiếu thu", historyTotal: "Tổng lịch sử thanh toán", paymentDifference: "Phiếu thu trừ số đã đóng", receiptCount: "Số phiếu thu", reconciliationStatus: "Kết quả đối chiếu", scopeDescription: "Phạm vi đối chiếu" });
Object.assign(labels, { stepsCount: "Số bước" });
Object.assign(labels, { allocated: "Đã bố trí", gap: "Còn thiếu", absentDays: "Số ngày chưa chấm công", courseTitle: "Khóa học", className: "Lớp học", present: "Có mặt", late: "Đi muộn", absent: "Vắng", excused: "Có phép", unrecorded: "Chưa ghi nhận", interviewers: "Người phỏng vấn", applicantName: "Ứng viên" });
Object.assign(labels, { contentGroup: "Nhóm nội dung", shootingContent: "Nội dung cần quay/chụp", productionRequirements: "Yêu cầu sản xuất", quantitySuggestion: "Số lượng đề xuất", headline: "Tiêu đề hiển thị", subheadline: "Mô tả ngắn", cta: "Lời kêu gọi hành động", visualBrief: "Mô tả hình ảnh", videoScript: "Kịch bản video", format: "Định dạng", revision: "Phiên bản", warnings: "Lưu ý" });
Object.assign(labels, { operation: "Loại thao tác", totalItems: "Tổng số mục", completedItems: "Đã xong", failedItems: "Lỗi", skippedItems: "Bỏ qua", conflictedItems: "Xung đột", progress: "Tiến độ" });
Object.assign(labels, { grossPay: "Tổng thu nhập", deductions: "Khấu trừ" });
Object.assign(labels, { receivableCode: "Mã khoản phải thu", sourceCode: "Mã chứng từ nguồn", sourceType: "Loại nguồn", dueDate: "Hạn thu", originalAmount: "Số tiền ban đầu", adjustedAmount: "Điều chỉnh", balance: "Số dư còn lại", daysOverdue: "Số ngày quá hạn", daysUntilDue: "Số ngày đến hạn", bucket: "Nhóm tuổi nợ", alert: "Cảnh báo", reminderCount: "Số lần nhắc", paymentMethod: "Phương thức thu", direction: "Chiều công nợ", partyName: "Đối tượng", partyKind: "Loại đối tượng", shiftCode: "Mã ca POS", cashierName: "Nhân viên thu ngân", paymentIndex: "Khoản thu số", paymentAmount: "Số tiền thu" });
Object.assign(labels, { type: "Loại bút toán", createdAt: "Ngày tạo", signedAmount: "Biến động số dư", runningBalance: "Số dư sau giao dịch" });
Object.assign(labels, { itemsSummary: "Sản phẩm", orderCode: "Mã đơn hàng" });
Object.assign(labels, {
  invoiceNo: "Số hóa đơn", issuedAt: "Ngày phát hành", invoiceCount: "Tổng số hóa đơn",
  issuedCount: "Đang phát hành", voidCount: "Đã hủy", issuedAmount: "Giá trị hóa đơn phát hành",
  voidAmount: "Giá trị hóa đơn đã hủy", averageOrderValue: "Giá trị đơn trung bình", grossSales: "Doanh số trước hoàn",
  netSales: "Doanh số sau hoàn", refunds: "Tiền hoàn", collectedAmount: "Đã thu", grossProfit: "Lợi nhuận gộp",
  grossMarginPercent: "Biên lợi nhuận (%)", paymentMix: "Theo phương thức thanh toán", timeSeries: "Theo ngày",
});
Object.assign(labels, { appId: "Facebook App ID", source: "Nguồn cấu hình" });
Object.assign(labels, { revertedRows: "Số dòng đã hoàn tác", conflictCount: "Số dòng xung đột" });
Object.assign(labels, { minGrossProfit: "Ngưỡng lợi nhuận gộp", customerTiers: "Các hạng khách hàng", evaluationWindow: "Khoảng xét hạng", tierEvaluationMetric: "Tiêu chí xếp hạng", connected: "Đã kết nối", created: "Đã tạo" });

Object.assign(labels, { previousDueDate: "Hạn thu cũ", newDueDate: "Hạn thu mới", reminderSuspendedUntil: "Tạm dừng nhắc đến", reminderSuspendReason: "Lý do tạm dừng nhắc" });
Object.assign(labels, { periodKey: "Kỳ lương", runStatus: "Trạng thái kỳ lương", stale: "Tình trạng dữ liệu", confirmedAt: "Thời điểm xác nhận", netPay: "Thực nhận", openIssueCount: "Số khoản đang khiếu nại", openIssueFields: "Các khoản đang khiếu nại", fieldLabel: "Khoản lương", updatedAt: "Cập nhật lúc" });
Object.assign(labels, { severity: "Mức độ", remediation: "Cách xử lý đề xuất" });
Object.assign(labels, { isConfirmed: "Trạng thái xác nhận" });
Object.assign(labels, { agreedSalary: "Lương thỏa thuận", reconciledDays: "Ngày công đối soát", reconciledHours: "Giờ công đối soát", allowance: "Phụ cấp", bonus: "Thưởng", deduction: "Khấu trừ", editable: "Còn chỉnh sửa", needsRefresh: "Cần tính lại", variables: "Biến tùy chỉnh", unit: "Đơn vị", defaultValue: "Giá trị mặc định" });
Object.assign(labels, { paymentCode: "Mã thanh toán", receivedAmount: "Số tiền nhận", appliedAmount: "Số tiền đã hạch toán", reviewReason: "Lý do chờ rà soát", reviewNote: "Kết quả rà soát", transactionDate: "Thời điểm giao dịch", reviewedAt: "Rà soát lúc" });
Object.assign(labels, { displayName: "Tên hiển thị", platform: "Kênh", isConnected: "Đã kết nối", updated: "Đã cập nhật", isWorkingDay: "Ngày làm việc", dayLabel: "Lịch làm việc", attendanceStatus: "Trạng thái chấm công", checkIn: "Giờ vào", checkOut: "Giờ ra", addressName: "Địa chỉ chấm công", allowedRadius: "Bán kính cho phép (m)", checkInLimit: "Giờ vào ca", checkOutLimit: "Giờ ra ca", lunchBreakStart: "Bắt đầu nghỉ trưa", lunchBreakEnd: "Kết thúc nghỉ trưa", annualLeaveDays: "Phép năm mặc định", workDays: "Ngày làm việc trong tuần", dayTypeLabel: "Loại ngày", isApplied: "Đã áp dụng" });
Object.assign(labels, { department: "Phòng ban", jobTitle: "Chức danh", qualification: "Trình độ" });
Object.assign(labels, { expiryAlertDays: "Số ngày báo trước", notifyManagers: "Gửi thông báo cho quản lý", salesKpiTarget: "Chỉ tiêu doanh số" });
Object.assign(labels, { extractedCount: "Số FAQ được tạo hoặc cập nhật", candidates: "Các câu hỏi đề xuất", candidate: "Câu hỏi FAQ", question: "Câu hỏi", category: "Nhóm câu hỏi" });
Object.assign(labels, { batchCode: "Mã lớp", batchName: "Lớp", studentName: "Học viên" });
Object.assign(labels, { linked: "Đã liên kết Telegram", linkedAt: "Liên kết lúc", botUsername: "Tài khoản bot Telegram" });
Object.assign(labels, { facebookConnected: "Facebook đã kết nối", facebookPageName: "Trang Facebook", tiktokConnected: "TikTok đã kết nối", tiktokUsername: "Tài khoản TikTok", zaloConnected: "Zalo đã kết nối", zaloName: "Tài khoản Zalo" });
Object.assign(labels, { plans: "Các gói AI", planName: "Tên gói", subscriptionStatus: "Trạng thái gói", billingScope: "Phạm vi gói", aiLimit: "Hạn mức lượt AI", used: "Đã sử dụng", expiresAt: "Hết hạn lúc", durationDays: "Thời hạn (ngày)", priceVnd: "Giá gói", model: "Mô hình AI", units: "Số lượt", completedAt: "Hoàn tất lúc" });
Object.assign(labels, { customerName: "Khách hàng", itemsSummary: "Sản phẩm", totalAmount: "Tổng tiền", orderStatus: "Trạng thái đơn", depositStatus: "Trạng thái đặt cọc", paymentMethod: "Phương thức thanh toán" });
Object.assign(labels, { enabled: "Đang bật", notifyNewOrder: "Báo đơn mới", botConfigured: "Bot đã cấu hình", botUsername: "Tên bot", lastTestedAt: "Kiểm tra gần nhất", lastTestStatus: "Kết quả kiểm tra", maxImagesPerReply: "Số ảnh tối đa mỗi lần trả lời", catalogName: "Tên thư viện", itemLabel: "Nhãn sản phẩm", selectionMessage: "Lời nhắn chọn sản phẩm", businessDescription: "Mô tả kinh doanh", webhookConfigured: "Đã cấu hình khóa webhook", depositEnabled: "Yêu cầu đặt cọc", depositPercent: "Tỷ lệ đặt cọc", paymentCodePrefix: "Tiền tố mã thanh toán", accountCount: "Số tài khoản nhận webhook", lastWebhookAt: "Webhook gần nhất", lastWebhookStatus: "Trạng thái webhook", categoryCount: "Số danh mục", imageCount: "Số ảnh", deletableCount: "Hồ sơ có thể xóa", blockedCount: "Hồ sơ bị chặn", impactSummary: "Dữ liệu vận hành liên quan", deletedCount: "Đã xóa" });

Object.assign(labels, { employeeName: "Nh\u00E2n vi\u00EAn", reason: "L\u00FD do" });
Object.assign(labels, { employeeCount: "Số nhân viên", blockingIssueCount: "Số lỗi cần xử lý", warningIssueCount: "Số cảnh báo", lockedAt: "Khóa công lúc", closedAt: "Chốt lúc", paidAt: "Đánh dấu thanh toán lúc", revision: "Lần tính lương" });
Object.assign(labels, { managerName: "Trưởng phòng", sortOrder: "Thứ tự hiển thị" });
Object.assign(labels, { publishedCount: "Số phiếu lương đã công bố" });
Object.assign(labels, { group: "Nhóm", action: "Thao tác" });
Object.assign(labels, { withdrawn: "Đã thu hồi phiếu lương" });
Object.assign(labels, { pendingOwnerSetup: "Cần thiết lập chủ chi nhánh" });
Object.assign(labels, { totalCount: "Tổng lượt gửi", sentCount: "Đã gửi", failedCount: "Gửi lỗi", pendingCount: "Đang chờ", skippedCount: "Đã bỏ qua", importedCount: "Đã nhập thành công", errors: "Dòng lỗi", row: "Dòng" });
Object.assign(labels, { configured: "Đã cài đặt", birthdayEnabled: "Gửi email sinh nhật", holidayEnabled: "Gửi email ngày lễ", sendTime: "Giờ gửi", holidayOverridesCount: "Số ngày ngoại lệ" });
Object.assign(labels, { areaM2: "Diện tích m²", floors: "Số tầng", style: "Phong cách", symbol: "Số ký hiệu", issuingAuthority: "Cơ quan ban hành", jurisdiction: "Phạm vi", province: "Tỉnh thành", expiryDate: "Ngày hết hiệu lực", reviewRequired: "Cần rà soát", chunksCount: "Số đoạn nội dung", taskType: "Loại rà soát", chapter: "Chương", article: "Điều", clause: "Khoản", point: "Điểm", versionNumber: "Phiên bản văn bản", asOf: "Ngày áp dụng", sourceUrl: "Nguồn", contractCode: "Mã hợp đồng", reportType: "Loại báo cáo", requestedStartDate: "Ngày phỏng vấn", requestedStartTime: "Giờ phỏng vấn" });

Object.assign(labels, { partnerName: "Đối tác", partnerCode: "Mã đối tác", periodStart: "Từ ngày", periodEnd: "Đến ngày", balanceAmount: "Còn lại", version: "Phiên bản" });
Object.assign(labels, { isDeleted: "Đã xóa mềm", headcount: "Số lượng tuyển", requirements: "Yêu cầu ứng viên", benefits: "Quyền lợi", employmentType: "Hình thức làm việc", workplaceType: "Nơi làm việc", applicationDeadline: "Hạn nhận hồ sơ", salaryMin: "Lương tối thiểu", salaryMax: "Lương tối đa", showSalary: "Hiển thị mức lương" });
Object.assign(labels, { effectiveTo: "Có hiệu lực đến", commissionScheme: "Cơ chế hoa hồng", confirmationSource: "Nguồn xác nhận", referredAt: "Ngày giới thiệu", employmentStartDate: "Ngày bắt đầu làm" });
Object.assign(labels, { account: "Tài khoản", direction: "Chiều thu chi", profitCategory: "Loại phiếu", cashNet: "Chênh lệch tiền mặt", bankNet: "Chênh lệch ngân hàng", count: "Số giao dịch", entries: "Khoản thu chi", shiftsReconciliation: "Đối soát ca", expectedCash: "Tiền mặt theo sổ", countedCash: "Tiền mặt đã đếm", varianceAmount: "Chênh lệch ca", balanced: "Khớp kỳ quỹ đã chốt", period: "Kỳ quỹ", reason: "Lý do" });

Object.assign(labels, { mode: "Ch\u1EBF \u0111\u1ED9 kho tri th\u1EE9c", documentsCount: "S\u1ED1 t\u00E0i li\u1EC7u", chunksCount: "S\u1ED1 m\u1EA3nh d\u1EEF li\u1EC7u", detectedTopics: "Ch\u1EE7 \u0111\u1EC1 \u0111\u00E3 nh\u1EADn di\u1EC7n", warnings: "C\u1EA3nh b\u00E1o", latestSyncAt: "\u0110\u1ED3ng b\u1ED9 g\u1EA7n nh\u1EA5t", cleared: "\u0110\u00E3 x\u00F3a to\u00E0n b\u1ED9 kho tri th\u1EE9c", campaignTopic: "Ch\u1EE7 \u0111\u1EC1", pillars: "Tr\u1EE5 c\u1ED9t n\u1ED9i dung", concepts: "\u00DD t\u01B0\u1EDFng", posts: "B\u1EA3n nh\u00E1p b\u00E0i \u0111\u0103ng", count: "S\u1ED1 k\u1EBFt qu\u1EA3", generatedByAi: "\u0110\u01B0\u1EE3c t\u1EA1o b\u1EB1ng AI" });

Object.assign(labels, { optimizedText: "Văn bản đã biên tập", subject: "Chủ thể", optimizedPrompt: "Prompt hình ảnh đã tối ưu", negativePrompt: "Nội dung cần tránh", suggestions: "Gợi ý chủ đề", feedbackUrl: "Liên kết đánh giá" });
Object.assign(labels, { found: "Đã tìm thấy thiết bị", serialNumber: "Số sê-ri/IMEI", soldAt: "Ngày bán", orderCode: "Mã đơn bán", customerCode: "Mã khách hàng", customerCovered: "Còn bảo hành khách hàng", customerWarrantyEndAt: "Hết bảo hành khách hàng", customerWarrantyDaysLeft: "Ngày bảo hành khách hàng còn lại", supplierCovered: "Còn bảo hành nhà cung cấp", supplierWarrantyEndAt: "Hết bảo hành nhà cung cấp", supplierWarrantyDaysLeft: "Ngày bảo hành nhà cung cấp còn lại", costBearer: "Bên chịu chi phí" });
Object.assign(labels, { sent: "Đã gửi", recipient: "Người nhận", content: "Nội dung", recipients: "Phạm vi người nhận", recipientCount: "Số người nhận", channels: "Kênh gửi" });
Object.assign(labels, { channel: "Kênh", senderName: "Khách hàng", lastMessageAt: "Hoạt động gần nhất", unreadCount: "Tin chưa đọc", isVip: "Khách VIP" });
Object.assign(labels, { mediaType: "Loại tệp", voiceName: "Giọng đọc", duration: "Thời lượng", url: "Liên kết tệp" });
Object.assign(labels, { aspectRatio: "Tỷ lệ ảnh", resolution: "Độ phân giải", modelName: "Mô hình tạo ảnh" });
Object.assign(labels, { revision: "Phiên bản ảnh", replayed: "Dùng lại kết quả đã tạo" });
Object.assign(labels, { campaignTitle: "Chiến dịch", campaignType: "Loại chiến dịch", scheduledAt: "Thời gian đăng", platform: "Kênh đăng", mediaType: "Loại media", topicBrief: "Chủ đề nội dung" });
Object.assign(labels, { deleted: "Đã xóa mục lịch sử" });
Object.assign(labels, { characters: "Số ký tự", category: "Nhóm giọng" });
Object.assign(labels, { eligibleCount: "Khoản quá hạn đủ điều kiện", queuedCount: "Thông báo đã xếp hàng", skippedCount: "Bỏ qua", failedCount: "Lỗi", duplicateCount: "Đã xử lý trước đó" });
Object.assign(labels, { trigger: "Nguồn khởi chạy", deliveryQueuedCount: "Thông báo đang chờ", deliverySentCount: "Thông báo đã gửi", deliverySkippedCount: "Thông báo bỏ qua", deliveryFailedCount: "Thông báo lỗi" });
Object.assign(labels, { bodyText: "Nội dung bài viết", contentType: "Loại nội dung", outline: "Dàn ý", mediaPrompt: "Gợi ý hình ảnh", generatedAt: "Tạo lúc", scheduledDate: "Ngày đăng", scheduledTime: "Giờ đăng", publishedAt: "Đã đăng lúc" });

Object.assign(labels, { category: "Nhóm giọng", stability: "Độ ổn định", similarity_boost: "Độ tương đồng", style: "Phong cách", use_speaker_boost: "Tăng cường người nói" });
Object.assign(labels, { windowMode: "Chế độ cửa sổ", enterToSend: "Enter để gửi", showSuggestions: "Hiện gợi ý", alwaysConfirm: "Luôn yêu cầu xác nhận", speakReplies: "Phát âm thanh câu trả lời", wakeWordEnabled: "Nghe lệnh bằng từ khóa Hey Igen" });
Object.assign(labels, {
  employmentType: "Hình thức làm việc", workplaceType: "Nơi làm việc", gender: "Giới tính", maritalStatus: "Tình trạng hôn nhân",
  contractType: "Loại hợp đồng", commissionType: "Hình thức hoa hồng", targetType: "Phạm vi tạo", account: "Tài khoản",
  profitCategory: "Nhóm thu chi", costBearer: "Bên chịu chi phí", channel: "Kênh", connectionType: "Loại kết nối", connectionStatus: "Trạng thái kết nối",
  network: "Mạng", networkType: "Loại mạng",
});
Object.assign(labels, { experience: "Kinh nghiệm", education: "Trình độ học vấn", skills: "Kỹ năng", expectedSalary: "Lương mong muốn" });

const fieldWordLabels: Record<string, string> = {
  account: "tài khoản", action: "thao tác", active: "hoạt động", address: "địa chỉ", amount: "số tiền",
  annual: "hằng năm", average: "trung bình", bank: "ngân hàng", branch: "chi nhánh", business: "kinh doanh",
  can: "có thể", category: "danh mục", check: "chấm", checkout: "giờ ra", checkin: "giờ vào", code: "mã",
  completed: "hoàn thành", company: "doanh nghiệp", connected: "kết nối", count: "số lượng", created: "ngày tạo",
  customer: "khách hàng", date: "ngày", days: "ngày", deleted: "đã xóa", department: "phòng ban", description: "mô tả",
  direction: "chiều", display: "hiển thị", document: "tài liệu", due: "hạn", duration: "thời lượng", effective: "hiệu lực",
  email: "email", employee: "nhân viên", end: "kết thúc", error: "lỗi", expiry: "hết hạn", failed: "thất bại",
  fee: "phí", first: "đầu tiên", from: "từ", full: "đầy đủ", group: "nhóm", has: "có", high: "cao",
  id: "mã", inactive: "ngừng hoạt động", in: "vào", item: "mục", items: "mục", kind: "loại", last: "gần nhất",
  leave: "nghỉ phép", level: "cấp", list: "danh sách", location: "vị trí", low: "thấp", manager: "quản lý",
  max: "tối đa", medium: "trung bình", min: "tối thiểu", minutes: "phút", mode: "chế độ", month: "tháng",
  name: "tên", net: "thực", new: "mới", number: "số", old: "cũ", operation: "thao tác", other: "khác",
  out: "ra", paid: "đã thanh toán", parent: "cha", payment: "thanh toán", percent: "phần trăm", phone: "điện thoại",
  platform: "nền tảng", price: "giá", product: "sản phẩm", project: "dự án", quantity: "số lượng", rate: "tỷ lệ",
  reason: "lý do", remaining: "còn lại", result: "kết quả", role: "vai trò", salary: "lương", scope: "phạm vi",
  serial: "sê-ri", source: "nguồn", start: "bắt đầu", state: "trạng thái", status: "trạng thái", student: "học viên",
  success: "thành công", summary: "tóm tắt", target: "mục tiêu", time: "thời gian", title: "tiêu đề", to: "đến",
  total: "tổng", tracking: "theo dõi", type: "loại", unit: "đơn vị", updated: "cập nhật", usage: "sử dụng",
  user: "người dùng", value: "giá trị", variant: "biến thể", warehouse: "kho", week: "tuần", worker: "lao động", year: "năm",
};

function localizedFieldKey(key: string) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return "Thông tin";
  const translated = words.map(word => fieldWordLabels[word]);
  if (translated.every(Boolean)) return translated.map((word, index) => index ? word : word[0].toLocaleUpperCase("vi") + word.slice(1)).join(" ");
  return "Thông tin";
}

export function localizedAssistantFieldLabel(key: string, label: string, operationId = ""): string {
  if (operationId.startsWith("recruitment.applicant.") && key === "source") return "Nguồn ứng viên";
  const configured = label.trim();
  if (configured && configured.toLocaleLowerCase("vi") !== key.toLocaleLowerCase("vi")) return configured;
  return labels[key] || localizedFieldKey(key);
}

function labelFor(operation: ResultOperation, key: string): string {
  if (operation.id === "student.batch.attendance.summary" && key === "total") return "Tổng học viên";
  if (operation.id.startsWith("architect.") && key === "requirements") return "Yêu cầu thiết kế";
  if (operation.id.startsWith("legal.")) {
    const legalLabels: Record<string, string> = { documents: "Số văn bản", chunks: "Số đoạn nội dung", pendingReviews: "Số mục chờ rà soát", latestDownloadAt: "Lần tải gần nhất", syncConfigured: "Đã cấu hình nguồn", citation: "Trích dẫn", answer: "Nội dung trả lời", sources: "Nguồn tham khảo", query: "Nội dung tra cứu" };
    if (legalLabels[key]) return legalLabels[key];
  }
  if (operation.id === "payroll.run.complaints.list") {
    const complaintLabels: Record<string, string> = { source: "Loại bảng lương", message: "Nội dung khiếu nại", response: "Phản hồi", createdAt: "Ngày gửi" };
    if (complaintLabels[key]) return complaintLabels[key];
  }
  if (operation.id.startsWith("worker.notification.")) {
    const notificationLabels: Record<string, string> = {
      recipients: "Phạm vi người nhận", recipientCount: "Số người nhận", channels: "Kênh gửi", createdAt: "Ngày tạo",
    };
    if (notificationLabels[key]) return notificationLabels[key];
  }
  if (operation.id.startsWith("task.") && key === "category") return "Danh mục công việc";
  if (operation.id.startsWith("recruitment.job.") && key === "code") return "Mã vị trí tuyển dụng";
  if (operation.id === "department.list") {
    const departmentLabels: Record<string, string> = {
      name: "T\u00EAn",
      code: "M\u00E3 ph\u00F2ng ban",
      managerName: "Tr\u01B0\u1EDFng ph\u00F2ng",
      isActive: "Tr\u1EA1ng th\u00E1i",
      employeeCount: "S\u1ED1 nh\u00E2n s\u1EF1",
    };
    if (departmentLabels[key]) return departmentLabels[key];
  }
  if (["employee.list", "employee.detail"].includes(operation.id)) {
    const employeeLabels: Record<string, string> = {
      displayName: "H\u1ECD v\u00E0 t\u00EAn",
      email: "Email",
      birthDate: "Ng\u00E0y sinh",
      phone: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
      department: "Ph\u00F2ng ban",
      division: "B\u1ED9 ph\u1EADn",
      qualification: "Tr\u00ECnh \u0111\u1ED9 chuy\u00EAn m\u00F4n",
    };
    if (employeeLabels[key]) return employeeLabels[key];
  }
  if (operation.id === "student.list") {
    const studentLabels: Record<string, string> = {
      fullName: "H\u1ECDc vi\u00EAn", phone: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i", email: "Email",
      registrationDate: "Ng\u00E0y \u0111\u0103ng k\u00FD", status: "Tr\u1EA1ng th\u00E1i",
      fee: "H\u1ECDc ph\u00ED", paidAmount: "\u0110\u00E3 thanh to\u00E1n",
    };
    if (studentLabels[key]) return studentLabels[key];
  }
  if (["marketing.video-caption.project.list", "marketing.video-caption.project.detail"].includes(operation.id)) {
    const projectLabels: Record<string, string> = {
      name: "Tên dự án", mode: "Chế độ phụ đề", status: "Trạng thái", currentVersion: "Phiên bản",
      createdAt: "Tạo lúc", updatedAt: "Cập nhật lúc",
    };
    if (projectLabels[key]) return projectLabels[key];
  }
  if (bulkCreateJobOperationIds.includes(operation.id)) {
    const jobLabels: Record<string, string> = {
      templateName: "Mẫu ảnh", targetType: "Phạm vi lượt tạo", sourceType: "Nguồn dữ liệu", status: "Trạng thái",
      totalItems: "Số ảnh", completedItems: "Đã hoàn tất", failedItems: "Ảnh lỗi", progress: "Tiến độ (%)",
      createdAt: "Tạo lúc", completedAt: "Kết thúc lúc",
    };
    if (jobLabels[key]) return jobLabels[key];
  }
  if (bulkCreateTemplateOperationIds.includes(operation.id)) {
    const templateLabels: Record<string, string> = {
      name: "Mẫu thiết kế", visibility: "Chia sẻ", version: "Phiên bản", useCount: "Lượt sử dụng", updatedAt: "Cập nhật lúc", status: "Trạng thái",
    };
    if (templateLabels[key]) return templateLabels[key];
  }
  if (operation.id.startsWith("omni-inbox.leads.")) {
    const leadLabels: Record<string, string> = {
      customerName: "Tên khách tiềm năng", company: "Công ty", phone: "Số điện thoại", email: "Email",
      value: "Giá trị cơ hội (VND)", productOfChoice: "Sản phẩm quan tâm", status: "Trạng thái", lastInteraction: "Tương tác gần nhất",
    };
    if (leadLabels[key]) return leadLabels[key];
  }
  if (operation.id === "marketing.content.draft.delete" && key === "deleted") return "Đã xóa bản nháp";
  if (operation.id === "department.delete" && key === "deleted") return "Đã xóa phòng ban";
  if (operation.id === "company-email.smtp.config") {
    const labels: Record<string, string> = { configured: "Đã cấu hình", host: "Máy chủ SMTP", port: "Cổng SMTP", secure: "TLS trực tiếp", user: "Tài khoản gửi", fromEmail: "Email người gửi", fromName: "Tên người gửi", hasPassword: "Đã lưu mật khẩu ứng dụng" };
    if (labels[key]) return labels[key];
  }
  if (operation.id === "company-email.smtp.verify" && key === "verified") return "Kết nối thành công";
  if (operation.id === "company-email.smtp.test" && key === "sent") return "Đã gửi email thử";
  if (operation.id === "branch.pending.delete" && key === "deleted") return "Đã hủy chi nhánh";
  if (operation.id === "marketing.elevenlabs.voice.delete" && key === "deleted") return "Đã xóa giọng đọc";
  if (operation.id.startsWith("notification.") && key === "type") return "Loại thông báo";
  if (operation.id.startsWith("notification.") && key === "read") return "Trạng thái đọc";
  if (operation.id.startsWith("notification.") && key === "createdAt") return "Thời điểm";
  if (operation.id === "notification.mark-all-read" && key === "success") return "Đã đánh dấu đọc toàn bộ";
  if (operation.id === "notification.delete" && key === "deleted") return "Đã xóa thông báo";
  if (operation.id === "marketing.elevenlabs.voices.list" && key === "name") return "Giọng đọc";
  if ((operation.id.startsWith("marketing.chat-flow.") || operation.id.startsWith("marketing.lead-intake-profile.")) && key === "goal") return "Mục tiêu thu thập thông tin";
  if ((operation.id.startsWith("marketing.chat-flow.") || operation.id.startsWith("marketing.lead-intake-profile.")) && key === "completionMessage") return "Lời nhắn sau khi thu thập đủ thông tin";
  if ((operation.id.startsWith("marketing.chat-flow.") || operation.id.startsWith("marketing.lead-intake-profile.")) && key === "fields") return "Thông tin cần thu thập";
  if ((operation.id.startsWith("marketing.chat-flow.") || operation.id.startsWith("marketing.lead-intake-profile.")) && key === "createdAt") return "Tạo lúc";
  if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "channel") return "Kênh";
  if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "feedback") return "Đánh giá";
  if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "status") return "Trạng thái gửi";
  if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "createdAt") return "Thời điểm phản hồi";
  if (operation.id.startsWith("omni-inbox.") && operation.id.endsWith("-conversations.list") && key === "status") return "Trạng thái hội thoại";
  if (operation.id === "student.email.send" && key === "subject") return "Tiêu đề email";
  if (operation.id === "timekeeping.work-calendar.audit" && key === "action") return "Thao tác";
  if (operation.id === "timekeeping.work-calendar.audit" && key === "createdAt") return "Thời điểm thay đổi";
  if (operation.id === "timekeeping.work-calendar.sync" && key === "calendarDaysCount") return "Số ngày trong lịch sau đồng bộ";
  if (operation.id.startsWith("retail.after-sale.") && key === "type") return "Loại chứng từ";
  if (operation.id.startsWith("retail.finance.cashbook.") && key === "businessDate") return "Ngày giao dịch";
  if (operation.id === "payroll.period.reset" && key === "deleted") return "D\u1EEF li\u1EC7u \u0111\u00E3 x\u00F3a";
  if (operation.id === "payroll.period.reset" && ["run", "results", "adjustments", "overrides", "audits"].includes(key)) {
    return ({ run: "B\u1EA3ng l\u01B0\u01A1ng", results: "K\u1EBFt qu\u1EA3 c\u00F4ng", adjustments: "Kho\u1EA3n \u0111i\u1EC1u ch\u1EC9nh", overrides: "Ghi \u0111\u00E8 d\u00F2ng l\u01B0\u01A1ng", audits: "Nh\u1EADt k\u00FD" } as Record<string, string>)[key];
  }
  if (operation.id.startsWith("payroll.adjustment.") && key === "kind") return "Lo\u1EA1i \u0111i\u1EC1u ch\u1EC9nh";
  if (operation.id === "marketing.canva.status") return key === "connected" ? "Đã kết nối Canva" : key === "connectedAt" ? "Kết nối lúc" : key;
  if (operation.id === "account.telegram-link.status" && key === "botUsername") return "Tài khoản bot Telegram";
  if (operation.id === "marketing.ai-subscription.summary" && key === "remaining") return "Lượt còn lại";
  if (operation.id === "payroll.employee.reconciliation.action" && key === "message") return "Trao đổi gần nhất";
  if (operation.id.startsWith("payroll.run.payslip.review-request") && key === "message") return "Nội dung yêu cầu";
  if (operation.id.startsWith("payroll.run.payslip.review-request") && key === "response") return "Phản hồi";
  if (operation.id.startsWith("payroll.run.payslip.review-request") && key === "createdAt") return "Gửi lúc";
  if (operation.id.startsWith("payroll.run.payslip.review-request") && key === "resolvedAt") return "Đã xử lý lúc";
  if (operation.id === "leave.balance.me") {
    const leaveLabels: Record<string, string> = {
      year: "Năm",
      entitlement: "Phép năm được hưởng",
      used: "Đã sử dụng",
      pending: "Đang chờ duyệt",
      unexcused: "Nghỉ không phép",
      remaining: "Số ngày còn lại",
    };
    if (leaveLabels[key]) return leaveLabels[key];
  }
  if (operation.id.startsWith("marketing.account.telegram-link.")) {
    const telegramLabels: Record<string, string> = { linked: "Đã liên kết Telegram", linkedAt: "Liên kết lúc", pendingCode: "Mã liên kết Telegram", pendingCodeExpiresAt: "Mã hết hạn lúc" };
    if (telegramLabels[key]) return telegramLabels[key];
  }
  if (operation.id === "account.business-settings.update" && key === "businessType") return "Lĩnh vực đào tạo";
  if (operation.id === "payroll.run.create") {
    const payrollRunLabels: Record<string, string> = { startDate: "Ngày bắt đầu", endDate: "Ngày kết thúc", type: "Loại lượt chạy" };
    if (payrollRunLabels[key]) return payrollRunLabels[key];
  }
  const relatedCreate = operationById(operation.id.replace(/\.(?:list|update|delete)$/, ".create"));
  const configured = operation.fields.find(field => field.key === key)?.label
    || relatedCreate?.fields.find(field => field.key === key)?.label || "";
  return localizedAssistantFieldLabel(key, configured, operation.id);
}

function celebrationHtmlToText(value: unknown): string {
  if (typeof value !== "string") return "";
  const decoded = value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
    const normalized = name.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return "\"";
    if (normalized === "apos") return "'";
    if (normalized === "nbsp") return " ";
    const codePoint = normalized.startsWith("#x") ? Number.parseInt(normalized.slice(2), 16) : Number.parseInt(normalized.slice(1), 10);
    if (!Number.isSafeInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return " ";
    try { return String.fromCodePoint(codePoint); } catch { return " "; }
  });
  return decoded
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|template|noscript|svg|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(script|style|template|noscript|svg|iframe|object)\b[^>]*>[\s\S]*$/gi, " ")
    .replace(/<(br|hr)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:p|div|h[1-6]|li|tr|table|section|article|blockquote|header|footer|ul|ol|td|th)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);
}

function recordOf(value: unknown): ResultRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ResultRecord : null;
}

function parseJsonText(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function formatIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return "";
  const timestamp = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(timestamp.valueOf())) return "";
  const utcMidnight = /T00:00(?::00(?:\.0+)?)?(?:Z|\+00:00)$/.test(value);
  const dateOnly = value.length === 10 || utcMidnight;
  const dateText = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: dateOnly ? "UTC" : "Asia/Ho_Chi_Minh",
  }).format(timestamp);
  if (dateOnly) return dateText;
  const timeText = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh",
  }).format(timestamp);
  return `${dateText} ${timeText}`;
}

function formatValueRaw(operation: ResultOperation, key: string, value: unknown, depth = 0): string {
  if (operation.id === "student.batch.attendance.summary" && ["total", "present", "late", "absent", "excused", "unrecorded"].includes(key) && typeof value === "number") return new Intl.NumberFormat("vi-VN").format(value);
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") {
    if (operation.id.startsWith("recruitment.job.") && key === "isDeleted") return value ? "Đã xóa mềm" : "Chưa xóa";
    if (operation.id === "department.list" && key === "isActive") return value ? "\u0110ang ho\u1EA1t \u0111\u1ED9ng" : "\u0110\u00E3 ng\u1EEBng ho\u1EA1t \u0111\u1ED9ng";
    if (operation.id.startsWith("notification.") && key === "read") return value ? "Có" : "Chưa đọc";
    if (operation.id === "notification.mark-all-read" && key === "success") return value ? "Hoàn tất" : "Chưa hoàn tất";
    if (operation.id === "notification.delete" && key === "deleted") return value ? "Có" : "Không";
    if (operation.id === "marketing.content.draft.delete" && key === "deleted") return value ? "Đã xóa" : "Chưa xóa";
    if (operation.id === "payroll.employee.me.reconciliation" && key === "stale") return value ? "Cần kiểm tra lại" : "Đang khớp";
    if (operation.id === "payroll.run.reconciliation.list" && key === "isConfirmed") return value ? "Đã xác nhận" : "Chưa xác nhận";
    if (operation.id === "payroll.run.reconciliation.list" && key === "stale") return value ? "Cần phát hành lại" : "Bản mới nhất";
    return value ? "Có" : "Không";
  }
  if (typeof value === "number") {
    const formatted = key === "year" ? String(value) : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
    if (bulkCreateJobOperationIds.includes(operation.id) && key === "totalItems") return formatted;
    if (bulkCreateTemplateOperationIds.includes(operation.id) && ["version", "useCount"].includes(key)) return formatted;
    if (key === "accessoryBps" || key === "repairBps") return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value / 100)}%`;
    if (operation.id.startsWith("omni-inbox.leads.") && key === "value") return `${formatted} ₫`;
    const countOrMeasure = /(?:count|days?|hours?|minutes?|quantity|stock|percent|rate|items)$/i.test(key);
    return moneyKey.test(key) && !countOrMeasure && operation.id !== "leave.balance.me" ? `${formatted} ₫` : formatted;
  }
  if (typeof value === "string") {
    if (["birthDate", "birthday"].includes(key)) {
      const date = formatAssistantTemporalValue(value.trim());
      if (date) return date.split(", ").at(-1)!;
    }
    if (operation.id === "student.list" && key === "fee" && /^\d+(?:\.\d+)?$/.test(value.trim())) {
      return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value))} \u20AB`;
    }
    if (["retail.order.list", "retail.order.detail", "retail.invoice.list", "retail.invoice.detail"].includes(operation.id) && key === "paymentStatus") {
      return ({ unpaid: "Chưa thanh toán", partial: "Thanh toán một phần", paid: "Đã thanh toán", refunded: "Đã hoàn tiền" } as Record<string, string>)[value] || value;
    }
    if (["retail.invoice.list", "retail.invoice.detail"].includes(operation.id) && key === "status") {
      return ({ issued: "Đang phát hành", void: "Đã hủy" } as Record<string, string>)[value] || value;
    }
    if (operation.id === "retail.report.summary" && key === "method") {
      return ({ cash: "Tiền mặt", card: "Thẻ", transfer: "Chuyển khoản", ewallet: "Ví điện tử" } as Record<string, string>)[value] || value;
    }
    if (operation.id.startsWith("recruitment.job.") && key === "status") return ({ draft: "Bản nháp", open: "Đang tuyển", paused: "Tạm dừng", closed: "Đã đóng" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("recruitment.job.") && key === "employmentType") return ({ full_time: "Toàn thời gian", part_time: "Bán thời gian", contract: "Hợp đồng", internship: "Thực tập" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("recruitment.job.") && key === "workplaceType") return ({ onsite: "Tại văn phòng", hybrid: "Kết hợp", remote: "Từ xa" } as Record<string, string>)[value] || value;
    if (key === "tierEvaluationMetric" && value === "gross_profit") return "Lợi nhuận gộp";
    if (key === "evaluationWindow" && value === "rolling12Months") return "12 tháng gần nhất";
    if (operation.id.startsWith("marketing.video-caption.project.") && key === "status") return ({
      draft: "B\u1EA3n nh\u00E1p",
      queued: "\u0110ang ch\u1EDD",
      queued_analysis: "Ch\u1EDD ph\u00E2n t\u00EDch",
      queued_render: "Ch\u1EDD k\u1EBFt xu\u1EA5t",
      analyzing: "\u0110ang ph\u00E2n t\u00EDch",
      transcribing: "\u0110ang nh\u1EADn d\u1EA1ng l\u1EDDi tho\u1EA1i",
      generating_context: "\u0110ang t\u1EA1o n\u1ED9i dung ng\u1EEF c\u1EA3nh",
      awaiting_provider: "\u0110ang ch\u1EDD nh\u00E0 cung c\u1EA5p",
      processing: "\u0110ang x\u1EED l\u00FD",
      ready_for_review: "Ch\u1EDD duy\u1EC7t",
      rendering: "\u0110ang k\u1EBFt xu\u1EA5t",
      completed: "Ho\u00E0n t\u1EA5t",
      retrying: "\u0110ang th\u1EED l\u1EA1i",
      failed: "Th\u1EA5t b\u1EA1i",
      cancelled: "\u0110\u00E3 h\u1EE7y",
    } as Record<string, string>)[value] || value;
    if (["marketing.video-caption.project.list", "marketing.video-caption.project.detail"].includes(operation.id) && key === "mode") return ({ speech: "Lời thoại", context: "Ngữ cảnh", combined: "Lời thoại và ngữ cảnh" } as Record<string, string>)[value] || value;
    if (["marketing.video-caption.project.list", "marketing.video-caption.project.detail"].includes(operation.id) && key === "status") return ({ draft: "Bản nháp", queued_analysis: "Chờ phân tích", analyzing: "Đang phân tích", transcribing: "Đang nhận dạng lời thoại", generating_context: "Đang tạo nội dung ngữ cảnh", ready_for_review: "Chờ duyệt", queued_render: "Chờ kết xuất", rendering: "Đang kết xuất", completed: "Hoàn tất", retrying: "Đang thử lại", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[value] || value;
    if (operation.id === "batch.attendance.record.update" && key === "status") return ({ present: "Có mặt", absent: "Vắng", excused: "Có phép", late: "Đi muộn" } as Record<string, string>)[value] || value;
    if (["marketing.video-caption.project.list", "marketing.video-caption.project.detail"].includes(operation.id) && ["createdAt", "updatedAt"].includes(key)) {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (bulkCreateJobOperationIds.includes(operation.id) && key === "status") return ({ queued: "Đang chờ", processing: "Đang xử lý", completed: "Hoàn tất", partial: "Một phần", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[value] || value;
    if (bulkCreateJobOperationIds.includes(operation.id) && key === "targetType") return ({ standalone: "Tạo riêng", campaign: "Chiến dịch" } as Record<string, string>)[value] || value;
    if (bulkCreateJobOperationIds.includes(operation.id) && key === "sourceType") return ({ manual: "Thủ công", campaign_orders: "Đơn sản xuất chiến dịch", sheet: "Bảng dữ liệu" } as Record<string, string>)[value] || value;
    if (bulkCreateJobOperationIds.includes(operation.id) && ["createdAt", "completedAt"].includes(key)) {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (bulkCreateTemplateOperationIds.includes(operation.id) && key === "visibility") return value === "public" ? "Đang chia sẻ" : value === "private" ? "Riêng tư" : value;
    if (bulkCreateTemplateOperationIds.includes(operation.id) && key === "status") return ({ active: "Đang hoạt động", archived: "Đã lưu trữ" } as Record<string, string>)[value] || value;
    if (bulkCreateTemplateOperationIds.includes(operation.id) && key === "updatedAt") {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (operation.id.startsWith("account.assistant-settings.") && key === "windowMode") return value === "fullscreen" ? "Toàn màn hình" : value === "window" ? "Cửa sổ nổi" : value;
    if (operation.id.startsWith("notification.") && key === "type") return ({ kho: "Kho", task: "Công việc", training: "Đào tạo", "he-thong": "Hệ thống" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("notification.") && key === "createdAt") {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if ((operation.id.startsWith("marketing.chat-flow.") || operation.id.startsWith("marketing.lead-intake-profile.")) && key === "status") return ({ draft: "Bản nháp", active: "Đang hoạt động", archived: "Đã lưu" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("marketing.content.") && key === "status") return ({ draft: "Bản nháp", pending: "Chờ duyệt", approved: "Đã duyệt", scheduled: "Đã lên lịch", published: "Đã đăng", processing: "Đang xử lý", failed: "Thất bại" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("marketing.chat-flow.") && key === "createdAt") {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (operation.id === "payroll.run.reconciliation.action" && key === "action") return ({ reply: "Đã gửi phản hồi", resolve: "Đã đánh dấu đã xử lý" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("payroll.run.payslip.review-request") && key === "status") return ({ open: "Đang chờ xử lý", resolved: "Đã xử lý" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("payroll.run.payslip.review-request") && ["createdAt", "resolvedAt"].includes(key)) {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (operation.id === "payroll.run.issues.list" && key === "severity") return ({ blocking: "Cần xử lý", warning: "Cảnh báo" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.media-history.list" && key === "mediaType") return ({ image: "Ảnh", voice: "Giọng đọc" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.media-history.list" && key === "createdAt") {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (operation.id.endsWith("-conversations.list") && operation.id.startsWith("omni-inbox.") && key === "channel") return ({ facebook: "Facebook", zalo: "Zalo", tiktok: "TikTok" } as Record<string, string>)[value.toLowerCase()] || value;
    if (operation.id.endsWith("-conversations.list") && operation.id.startsWith("omni-inbox.") && key === "status") return ({ open: "Đang mở", closed: "Đã đóng" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "channel") return ({ facebook: "Facebook", facebook_comment: "Bình luận Facebook", zalo: "Zalo", tiktok: "TikTok", test: "Bản kiểm thử" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "feedback") return ({ good: "Đạt", bad: "Không đạt", needs_fix: "Cần sửa" } as Record<string, string>)[value] || "Chưa đánh giá";
    if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "status") return ({ sent: "Đã gửi", failed: "Gửi lỗi", preview: "Bản xem trước" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("omni-inbox.ai-reply-log") && key === "createdAt") {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (operation.id.startsWith("omni-inbox.") && operation.id.endsWith("-conversations.list") && key === "lastMessageAt") {
      const timestamp = new Date(value);
      return Number.isNaN(timestamp.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    }
    if (operation.id === "account.business-settings.update" && key === "businessType") return ({ driving: "Đào tạo lái xe", language: "Đào tạo ngoại ngữ", general: "Đào tạo tổng hợp" } as Record<string, string>)[value] || value;
    if (key === "entityPreset") return ({ student: "Học viên", candidate: "Ứng viên", customer: "Khách hàng", worker: "Người lao động" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("inventory.serial.") && key === "status") return ({
      in_stock: "Trong kho", in_transit: "Đang điều chuyển", internal_use: "Đang sử dụng nội bộ", sold: "Đã bán",
      returned: "Đã trả hàng", defective: "Hư hỏng", repairing: "Đang sửa chữa", scrapped: "Đã thanh lý", lost: "Đã mất",
    } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("retail.payment-review.") && key === "status") return ({ pending_review: "Đang chờ rà soát", reviewed: "Đã rà soát" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.calendar" && key === "status") return ({ planned: "Đã lên kế hoạch", queued: "Đang chờ", pending_approval: "Chờ duyệt", ready_to_publish: "Sẵn sàng đăng", needs_attention: "Cần kiểm tra", publishing: "Đang đăng", published: "Đã đăng", failed: "Thất bại", cancelled: "Đã hủy", skipped: "Đã bỏ qua" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.asset-orders.list" && key === "status") return ({ draft: "Bản nháp", needs_assets: "Thiếu tài sản", ready: "Sẵn sàng", bulk_queued: "Đang xử lý", completed: "Đã hoàn tất", cancelled: "Đã hủy" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.sheet.ai.jobs.list" && key === "status") return ({ queued: "Đang chờ", processing: "Đang xử lý", awaiting_review: "Chờ duyệt", applying: "Đang áp dụng", completed: "Hoàn tất", partial: "Một phần", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("marketing.campaign.sheet.ai.job.") && key === "status") return ({ queued: "Đang chờ", processing: "Đang xử lý", awaiting_review: "Chờ duyệt", applying: "Đang áp dụng", completed: "Hoàn tất", partial: "Một phần", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.asset-order.ai.jobs.list" && key === "status") return ({ queued: "Đang chờ", processing: "Đang xử lý", completed: "Hoàn tất", partial: "Một phần", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.asset-order.ai.job.cancel" && key === "status") return ({ queued: "Đang chờ", processing: "Đang xử lý", completed: "Hoàn tất", partial: "Một phần", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.sheet.ai.jobs.list" && key === "operation") return ({ cell: "Ô dữ liệu", row: "Dòng", column: "Cột", selection: "Vùng dữ liệu" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.asset-order.ai.jobs.list" && key === "operation") return ({ fill_all: "Điền hàng loạt Order" } as Record<string, string>)[value] || value;
    if (["marketing.campaign.list", "marketing.campaign.lifecycle"].includes(operation.id) && key === "status") return ({ draft: "Bản nháp", active: "Đang chạy", paused: "Đã tạm dừng", cancelled: "Đã hủy", completed: "Đã hoàn tất", failed: "Thất bại" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.list" && key === "campaignType") return ({ campaign: "Chiến dịch", single: "Bài đơn" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.calendar" && key === "campaignType") return ({ single: "Một bài", campaign: "Chiến dịch" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.campaign.calendar" && key === "mediaType") return ({ text: "Văn bản", image: "Ảnh", video: "Video", "human-video": "Video người thật" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("payroll.run.") && key === "status") return ({ draft: "Bản nháp", review: "Chờ duyệt", closed: "Đã chốt", paid: "Đã thanh toán", confirmed: "Đã xác nhận", cancelled: "Đã hủy", reversed: "Đã hoàn", unknown: "Không xác định", succeeded: "Đã hoàn tất", completed: "Đã tính xong", running: "Đang xử lý", pending: "Đang chờ", failed: "Thất bại" } as Record<string, string>)[value] || value;
    if (operation.id === "retail.receivable.customer.history" && key === "type") return ({ charge: "Phát sinh công nợ", payment: "Đã thu", adjustment: "Điều chỉnh", reversal: "Đảo bút toán" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("retail.after-sale.") && key === "type") return ({ return: "Trả hàng", buyback: "Thu mua" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("retail.after-sale.") && key === "status") return value === "completed" ? "Đã hoàn tất" : value;
    if (operation.id.startsWith("retail.after-sale.") && key === "paymentMethod") return ({ cash: "Tiền mặt", card: "Thẻ", transfer: "Chuyển khoản", ewallet: "Ví điện tử" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("retail.finance.cashbook.") && key === "account") return ({ cash: "Tiền mặt", bank: "Ngân hàng" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("retail.finance.cashbook.") && key === "direction") return ({ in: "Thu", out: "Chi" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("retail.finance.cashbook.") && key === "profitCategory") return ({ expense: "Chi phí", other: "Khác" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("payroll.adjustment.") && key === "kind") return ({ allowance: "Ph\u1EE5 c\u1EA5p", bonus: "Th\u01B0\u1EDFng", deduction: "Kh\u1EA5u tr\u1EEB", correction: "\u0110i\u1EC1u ch\u1EC9nh", advance: "T\u1EA1m \u1EE9ng" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("payroll.adjustment.") && key === "status") return ({ pending: "\u0110ang ch\u1EDD", approved: "\u0110\u00E3 duy\u1EC7t", rejected: "\u0110\u00E3 t\u1EEB ch\u1ED1i", snapshotted: "\u0110\u00E3 ch\u1ED1t v\u00E0o b\u1EA3ng l\u01B0\u01A1ng" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.order-sheet.orders.list" && key === "orderStatus") return ({ draft: "Bản nháp", confirmed: "Đã xác nhận", synced: "Đã đồng bộ", failed: "Lỗi đồng bộ" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.order-sheet.orders.list" && key === "depositStatus") return ({ not_required: "Không cần đặt cọc", awaiting_receipt: "Đang chờ biên lai", receipt_received: "Đã nhận biên lai", verified: "Đã xác minh đặt cọc" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.order-sheet.orders.list" && key === "paymentMethod") return ({ cash: "Tiền mặt", bank_transfer: "Chuyển khoản" } as Record<string, string>)[value] || value;
    if (operation.id === "marketing.telegram-order.config-status" && key === "lastTestStatus") return ({ success: "Kết nối hoạt động", failed: "Kiểm tra thất bại", untested: "Chưa kiểm tra" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("marketing.sepay.config") && key === "lastWebhookStatus") return ({ success: "Đã nhận thanh toán", failed: "Lỗi xử lý webhook", untested: "Chưa nhận webhook" } as Record<string, string>)[value] || value;
    if (operation.id.startsWith("payroll.employee.")) {
      if (key === "runStatus") return ({ draft: "Bản nháp", calculated: "Đã tính", reviewed: "Đã duyệt", closed: "Đã chốt", paid: "Đã thanh toán" } as Record<string, string>)[value] || value;
      if (key === "action") return ({ confirm: "Đã xác nhận", dispute: "Đã gửi khiếu nại", reply: "Đã gửi phản hồi" } as Record<string, string>)[value] || value;
    }
    if (operation.id === "repair.device.lookup" && key === "costBearer") return ({ supplier: "Nhà cung cấp", shop: "Cửa hàng", customer: "Khách hàng" } as Record<string, string>)[value] || value;
    if (key === "bankAccountNo") {
      const accountDigits = value.replace(/\D/g, "");
      return accountDigits.length > 4 ? `•••• ${accountDigits.slice(-4)}` : "••••";
    }
    if (key === "commissionType" && value === "percentage") return "Phần trăm";
    if (key === "commissionType" && value === "fixed") return "Số tiền cố định";
    if (key === "kind") {
      const localizedKind: Record<string, string> = {
        sale_refund: "Hoàn tiền đơn bán", sale_payment: "Thu tiền đơn bán", charge: "Phát sinh công nợ",
        payment: "Thanh toán", adjustment: "Điều chỉnh", reversal: "Đảo giao dịch", bonus: "Thưởng",
        allowance: "Phụ cấp", deduction: "Khấu trừ", correction: "Điều chỉnh", advance: "Tạm ứng",
      };
      if (localizedKind[value]) return localizedKind[value];
    }
    if (key === "actorType") {
      const actorTypes: Record<string, string> = { user: "Người dùng", ai: "Trợ lý AI", system: "Hệ thống" };
      if (actorTypes[value]) return actorTypes[value];
    }
    if (/(?:status|state)$/i.test(key)) {
      const localizedStatus = commonStatusLabels[value.trim().toLowerCase()];
      if (localizedStatus) return localizedStatus;
    }
    const temporalField = operation.fields.find(field => (field.key === key || field.apiKey === key) && ["date", "datetime"].includes(field.type));
    const temporalKey = /(?:Date|At|Deadline)$/.test(key) || ["date", "asOf", "deadline", "checkIn", "checkOut", "scheduledStart", "scheduledEnd"].includes(key);
    const localizedDate = temporalField || temporalKey ? formatAssistantTemporalValue(value.trim()) : undefined;
    if (localizedDate) return temporalField?.type === "date" ? localizedDate.split(", ").at(-1)! : localizedDate;
    const parsed = parseJsonText(value);
    if (parsed !== value && depth < 2) return formatValue(operation, key, redactAssistantResult(parsed), depth + 1);
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > 280 ? `${compact.slice(0, 277)}…` : compact;
  }
  if (depth >= 3) return "Có thông tin chi tiết";
  if (Array.isArray(value)) {
    if (value.length === 0) return "Không có";
    if (key === "channels") {
      return value.filter((item): item is string => typeof item === "string")
        .map(item => enumValueLabelsByKey.channel[item] || item).join(", ") || "Không có";
    }
    if (["student.list", "student.detail"].includes(operation.id) && key === "status") {
      return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join(", ");
    }
    if (["workingDays", "daysOfWeek"].includes(key) && value.every(day => Number.isInteger(Number(day)) && Number(day) >= 0 && Number(day) <= 6)) {
      return [...new Set(value.map(day => weekdayLabels[Number(day)]))].join(", ");
    }
    const shown = value.slice(0, 4).map((item, index) => {
      const record = recordOf(item);
      if (!record) return `${index + 1}. ${formatValue(operation, key, item, depth + 1)}`;
      const fields = Object.entries(record).slice(0, 6)
        .map(([childKey, childValue]) => `${labelFor(operation, childKey)}: ${formatValue(operation, childKey, childValue, depth + 1)}`)
        .filter(entry => !entry.endsWith(": "));
      return `${index + 1}. ${fields.join(" · ")}`;
    }).filter(Boolean);
    if (value.length > shown.length) shown.push(`Còn ${value.length - shown.length} mục`);
    return shown.join("\n");
  }
  const record = recordOf(value);
  if (!record) return "";
  return Object.entries(record).slice(0, 6)
    .map(([childKey, childValue]) => `${labelFor(operation, childKey)}: ${formatValue(operation, childKey, childValue, depth + 1)}`)
    .filter(entry => !entry.endsWith(": "))
    .join(" · ");
}

function formatValue(operation: ResultOperation, key: string, value: unknown, depth = 0): string {
  if (operation.id.startsWith("legal.") && typeof value === "string") {
    if (key === "citation") return value;
    if (["asOf", "latestDownloadAt", "issueDate", "effectiveDate", "expiryDate", "createdAt"].includes(key)) return formatAssistantTemporalValue(value) ?? value;
    if (key === "jurisdiction") return ({ central: "Trung ương", ministry: "Bộ, ngành", local: "Địa phương" } as Record<string, string>)[value] ?? value;
    if (key === "status" && value === "accepted") return "Đã tiếp nhận, đang xử lý";
  }
  const formatted = formatValueRaw(operation, key, value, depth);
  if (typeof value === "string" && (formatted === value || formatted === value.trim())) {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const enumLabel = enumValueLabelsByKey[key]?.[value.trim()]
      || enumValueLabelsByKey[key]?.[normalized]
      || ((/(?:status|state)$/i.test(key)) ? commonStatusLabels[normalized] : undefined);
    if (enumLabel) return enumLabel;
  }
  return formatted;
}

function formatRecord(operation: ResultOperation, value: unknown): string {
  const record = recordOf(value);
  if (!record) return "";
  const populatedPartner = recordOf(record.partnerId);
  const displayRecord = (operation.id === "worker.partner.settlements.list" || operation.id === "worker.partner.worker-referral.list") && populatedPartner
    ? { ...record, partnerName: populatedPartner.name, partnerCode: populatedPartner.code }
    : record;
  if (operation.id === "retail.coupon.create") {
    const amount = (input: unknown) => typeof input === "number" && Number.isFinite(input)
      ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(input) + " ₫"
      : "";
    const valueText = Number.isFinite(Number(displayRecord.value))
      ? displayRecord.discountType === "percent"
        ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(displayRecord.value)) + "%"
        : amount(displayRecord.value)
      : "";
    const start = formatValue(operation, "startsAt", displayRecord.startsAt);
    const end = formatValue(operation, "endsAt", displayRecord.endsAt);
    const tiers = Array.isArray(displayRecord.customerTierCodes) ? displayRecord.customerTierCodes : [];
    return [
      typeof displayRecord.code === "string" ? "Mã ưu đãi: " + displayRecord.code : "",
      typeof displayRecord.name === "string" ? "Tên chương trình: " + displayRecord.name : "",
      valueText ? "Mức giảm: " + valueText : "",
      amount(displayRecord.minSubtotal) ? "Đơn tối thiểu: " + amount(displayRecord.minSubtotal) : "",
      amount(displayRecord.maxDiscount) ? "Mức giảm tối đa: " + amount(displayRecord.maxDiscount) : "",
      start && end ? "Thời gian áp dụng: " + start + " đến " + end : "",
      displayRecord.usageLimit == null ? "Lượt sử dụng: Không giới hạn" : "Lượt sử dụng tối đa: " + formatValue(operation, "usageLimit", displayRecord.usageLimit),
      typeof displayRecord.customerName === "string" && displayRecord.customerName
        ? "Khách hàng nhận mã: " + displayRecord.customerName
        : tiers.length ? "Đối tượng: Khách hàng thuộc các hạng đã chọn" : "Đối tượng: Tất cả khách hàng",
      typeof displayRecord.active === "boolean" ? "Trạng thái: " + (displayRecord.active ? "Đã kích hoạt" : "Đang tạm dừng") : "",
    ].filter(Boolean).join("\n");
  }
  const resultFields = operation.id === "department.list"
    ? ["name", "code", "managerName", "isActive", "employeeCount"]
    : operation.id === "employee.list"
      ? ["displayName", "department", "division"]
      : ["recruitment.job.delete", "recruitment.job.restore"].includes(operation.id)
        ? ["code", "title", "status"]
      : operation.resultFields;
  return resultFields
    .filter(key => Object.hasOwn(displayRecord, key) && displayRecord[key] !== null && displayRecord[key] !== undefined && displayRecord[key] !== "")
    .slice(0, 8)
    .map(key => {
      const value = displayRecord[key];
      const referralStatuses: Record<string, string> = { pending: "Đang chờ xác nhận", active: "Đang hoạt động", ended: "Đã kết thúc" };
      const referralSchemes: Record<string, string> = { official_monthly: "Chính thức", seasonal_hourly: "Thời vụ theo giờ" };
      const referralSources: Record<string, string> = { contract: "Hợp đồng", manual: "Thủ công", attendance: "Chấm công" };
      const calendarAuditActions: Record<string, string> = { created: "Tạo", updated: "Cập nhật", deleted: "Xóa", synced: "Đồng bộ" };
      const reminderTriggers: Record<string, string> = { manual: "Chạy thủ công", scheduled: "Theo lịch" };
      const childFields = operation.resultChildFields?.[key];
      const projectBySchema = (child: unknown, schema: NonNullable<typeof childFields>): unknown => {
        if (Array.isArray(schema)) {
          const childRecord = recordOf(child);
          return childRecord
            ? Object.fromEntries(schema.filter(childKey => Object.hasOwn(childRecord, childKey)).map(childKey => [childKey, childRecord[childKey]]))
            : child;
        }
        const childRecord = recordOf(child);
        if (!childRecord) return child;
        return Object.fromEntries(Object.entries(schema)
          .filter(([childKey]) => Object.hasOwn(childRecord, childKey))
          .map(([childKey, nestedSchema]) => [childKey, projectBySchema(childRecord[childKey], nestedSchema)]));
      };
      const displayValue = childFields
        ? Array.isArray(value) ? value.map(child => projectBySchema(child, childFields)) : projectBySchema(value, childFields)
        : value;
      const formatted = (operation.id.startsWith("marketing.chat-flow.") || operation.id.startsWith("marketing.lead-intake-profile.")) && key === "fields" && Array.isArray(value)
        ? value.map((field: any) => [field?.label, field?.question].filter((part: unknown) => typeof part === "string" && part.trim()).join(": ")).filter(Boolean).join("; ")
        : operation.id.startsWith("finance.reminders.runs.") && key === "trigger" && typeof value === "string"
        ? reminderTriggers[value] || formatValue(operation, key, value)
        : operation.id === "timekeeping.work-calendar.audit" && key === "action" && typeof value === "string"
        ? calendarAuditActions[value] || formatValue(operation, key, value)
        : operation.id.includes("referral") && key === "status" && typeof value === "string"
        ? referralStatuses[value] || formatValue(operation, key, value)
        : operation.id.includes("referral") && key === "commissionScheme" && typeof value === "string"
          ? referralSchemes[value] || formatValue(operation, key, value)
          : operation.id.includes("referral") && key === "confirmationSource" && typeof value === "string"
            ? referralSources[value] || formatValue(operation, key, value)
            : operation.id.startsWith("worker.notification.") && key === "recipients" && value === "all"
              ? "Tất cả người lao động"
              : formatValue(operation, key, displayValue);
      const commissionValue = key === "commissionRate" && typeof displayRecord[key] === "number"
        ? `${formatted}%`
        : key === "ratePercent" && typeof displayRecord[key] === "number"
          ? `${formatted}%`
        : key === "depositPercent"
          ? `${formatted}%`
        : key === "commissionValue" && typeof record[key] === "number"
          ? `${formatted}${record.commissionType === "percentage" ? "%" : record.commissionType === "fixed" ? " ₫" : ""}`
          : formatted;
      return `${labelFor(operation, key)}: ${commissionValue}`;
    })
    .filter(entry => !entry.endsWith(": "))
    .join("\n");
}

/** Build a table row from the same explicitly approved fields used by formatRecord. */
function formatRecordTableRow(operation: ResultOperation, value: unknown): Record<string, string> {
  const summary = formatRecord(operation, value);
  const fields = new Map<string, string>();
  const allowedLabels = new Set((operation.id === "department.list"
    ? ["name", "code", "managerName", "isActive", "employeeCount"]
    : operation.id === "employee.list"
      ? ["displayName", "department", "division"]
      : ["recruitment.job.delete", "recruitment.job.restore"].includes(operation.id)
        ? ["code", "title", "status"]
        : operation.resultFields).map(key => labelFor(operation, key)));
  for (const line of summary.split(/\r?\n/)) {
    const match = line.match(/^([^:\r\n]{1,80}):\s*(.*)$/);
    if (!match || !allowedLabels.has(match[1])) continue;
    fields.set(match[1], match[2].trim());
  }
  return Object.fromEntries(fields);
}

function collection(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  const record = recordOf(value);
  if (!record) return null;
  for (const key of collectionKeys) if (Array.isArray(record[key])) return record[key] as unknown[];
  return null;
}

function workerManagementTableResult(operation: ResultOperation, input: unknown): string {
  if (!/^\/worker-management\/(?:workers|projects|labor-contracts|attendance|notifications)(?:\/|$)/.test(operation.path || "")) return "";
  const safe = redactAssistantResult(input);
  const wrapper = recordOf(safe);
  const data = recordOf(wrapper?.data);
  const nested = recordOf(data?.worker) || recordOf(data?.project) || recordOf(data?.contract) || recordOf(data?.notification)
    || recordOf(wrapper?.worker) || recordOf(wrapper?.project) || recordOf(wrapper?.contract) || recordOf(wrapper?.notification) || data;
  const records = collection(safe) || collection(nested) || (nested ? [nested] : wrapper ? [wrapper] : []);
  if (!records.length) return operation.method === "GET" ? `${operation.title}\nMình chưa tìm thấy kết quả phù hợp.` : "";
  const rows = records.slice(0, 8).flatMap(value => {
    const record = recordOf(value);
    if (!record) return [];
    const row = Object.fromEntries(operation.resultFields
      .filter(key => Object.hasOwn(record, key) && record[key] !== null && record[key] !== undefined && record[key] !== "")
      .map(key => [labelFor(operation, key), operation.id.startsWith("worker.notification.") && key === "recipients" && record[key] === "all"
        ? "Tất cả người lao động" : formatValue(operation, key, record[key])]));
    return Object.keys(row).length ? [row] : [];
  });
  if (!rows.length) return "";
  const summary = operation.method === "GET" ? `Mình tìm thấy ${records.length} kết quả phù hợp cho bạn.`
    : operation.method === "DELETE" ? "Mình đã xóa xong."
      : operation.method === "POST" ? "Mình đã tạo xong."
        : "Mình đã cập nhật xong.";
  return formatAssistantResultTable(summary, rows,
    records.length > rows.length ? [`Còn ${records.length - rows.length} kết quả chưa hiển thị.`] : []);
}

function formatLaborPartnerPolicy(operation: ResultOperation, input: unknown): string {
  const wrapped = recordOf(redactAssistantResult(input));
  const policy = recordOf(wrapped?.data) || wrapped;
  if (!policy || typeof policy.name !== "string" || !recordOf(policy.settlementCycle)) return "";

  const lines: string[] = [`Tên: ${policy.name}`];
  if (policy.version !== undefined) lines.push(`Phiên bản: ${formatValue(operation, "version", policy.version)}`);
  if (policy.effectiveFrom !== undefined) lines.push(`Ngày áp dụng từ: ${formatValue(operation, "effectiveFrom", policy.effectiveFrom)}`);
  if (policy.effectiveTo) lines.push(`Ngày áp dụng đến: ${formatValue(operation, "effectiveTo", policy.effectiveTo)}`);
  if (typeof policy.status === "string") lines.push(`Trạng thái: ${formatValue(operation, "status", policy.status)}`);

  const cycle = recordOf(policy.settlementCycle)!;
  const cycleType = cycle.type === "calendar_month"
    ? "Theo tháng dương lịch"
    : cycle.type === "cutoff_day"
      ? `Theo ngày chốt${cycle.cutoffDay == null ? "" : ` ngày ${formatValue(operation, "cutoffDay", cycle.cutoffDay)}`}`
      : "Chưa xác định";
  lines.push(`Chu kỳ đối soát: ${cycleType}`);

  const official = recordOf(policy.official);
  if (official) {
    lines.push(`Hoa hồng lao động chính thức: ${official.enabled === true ? "Đang bật" : "Đang tắt"}`);
    if (official.enabled === true) {
      if (official.maxMonths != null) lines.push(`Số tháng tối đa: ${formatValue(operation, "maxMonths", official.maxMonths)}`);
      if (Array.isArray(official.milestones)) {
        const eligibilityLabels: Record<string, string> = {
          contract_active: "Hợp đồng còn hiệu lực",
          manual_confirmation: "Xác nhận thủ công",
          attendance_threshold: "Đạt ngưỡng chấm công",
        };
        for (const [index, rawMilestone] of official.milestones.entries()) {
          const milestone = recordOf(rawMilestone);
          if (!milestone) continue;
          const fields = [
            milestone.month == null ? "" : `Tháng ${formatValue(operation, "month", milestone.month)}`,
            milestone.amount == null ? "" : `Số tiền ${formatValue(operation, "amount", milestone.amount)}`,
            typeof milestone.eligibilityRule === "string" ? `Điều kiện: ${eligibilityLabels[milestone.eligibilityRule] || milestone.eligibilityRule}` : "",
            milestone.minWorkedDays == null ? "" : `Tối thiểu ${formatValue(operation, "minWorkedDays", milestone.minWorkedDays)} ngày làm`,
            milestone.minWorkedHours == null ? "" : `Tối thiểu ${formatValue(operation, "minWorkedHours", milestone.minWorkedHours)} giờ làm`,
          ].filter(Boolean);
          if (fields.length) lines.push(`Mốc ${index + 1}: ${fields.join(" · ")}`);
        }
      }
    }
  }

  const seasonal = recordOf(policy.seasonal);
  if (seasonal) {
    lines.push(`Hoa hồng lao động thời vụ: ${seasonal.enabled === true ? "Đang bật" : "Đang tắt"}`);
    if (seasonal.enabled === true) {
      const scopeLabels: Record<string, string> = {
        partner_period: "Cộng giờ theo đối tác trong kỳ",
        partner_project_period: "Cộng giờ theo đối tác, dự án và kỳ",
      };
      const tierModeLabels: Record<string, string> = {
        flat: "Áp dụng một mức cho toàn bộ số giờ",
        progressive: "Áp dụng mức theo từng bậc giờ",
      };
      if (typeof seasonal.aggregationScope === "string") lines.push(`Phạm vi tổng hợp: ${scopeLabels[seasonal.aggregationScope] || seasonal.aggregationScope}`);
      if (typeof seasonal.tierMode === "string") lines.push(`Cách tính bậc: ${tierModeLabels[seasonal.tierMode] || seasonal.tierMode}`);
      if (seasonal.minHoursPerWorker != null) lines.push(`Số giờ tối thiểu mỗi người: ${formatValue(operation, "minHoursPerWorker", seasonal.minHoursPerWorker)}`);
      if (seasonal.maxEligibleHoursPerWorker != null) lines.push(`Số giờ tối đa được tính mỗi người: ${formatValue(operation, "maxEligibleHoursPerWorker", seasonal.maxEligibleHoursPerWorker)}`);

      const roundingLabels: Record<string, string> = { floor: "Làm tròn xuống", nearest: "Làm tròn đến giá trị gần nhất", ceil: "Làm tròn lên" };
      const hourRounding = recordOf(seasonal.hourRounding);
      if (hourRounding) {
        const mode = typeof hourRounding.mode === "string" ? roundingLabels[hourRounding.mode] || hourRounding.mode : "";
        const unit = Number(hourRounding.unitMinutes);
        const interval = Number.isFinite(unit) ? (unit === 1 ? "mỗi phút" : `mỗi ${formatValue(operation, "unitMinutes", unit)} phút`) : "";
        if (mode || interval) lines.push(`Quy tắc làm tròn giờ: ${[mode, interval].filter(Boolean).join(" ")}`);
      }
      const moneyRounding = recordOf(seasonal.moneyRounding);
      if (moneyRounding) {
        const mode = typeof moneyRounding.mode === "string" ? roundingLabels[moneyRounding.mode] || moneyRounding.mode : "";
        const unit = Number(moneyRounding.unitVnd);
        const interval = Number.isFinite(unit) ? `mỗi ${formatValue(operation, "unitVnd", unit)} ₫` : "";
        if (mode || interval) lines.push(`Quy tắc làm tròn tiền: ${[mode, interval].filter(Boolean).join(" ")}`);
      }
      if (Array.isArray(seasonal.tiers)) {
        for (const [index, rawTier] of seasonal.tiers.entries()) {
          const tier = recordOf(rawTier);
          if (!tier) continue;
          const range = tier.maxHours == null
            ? `Từ ${formatValue(operation, "minHours", tier.minHours)} giờ trở lên`
            : `Từ ${formatValue(operation, "minHours", tier.minHours)} đến ${formatValue(operation, "maxHours", tier.maxHours)} giờ`;
          const rate = tier.hourlyRate == null ? "" : `${formatValue(operation, "hourlyRate", tier.hourlyRate)} ₫/giờ`;
          lines.push(`Bậc ${index + 1}: ${[range, rate].filter(Boolean).join(" · ")}`);
        }
      }
    }
  }

  return lines.join("\n");
}

function formatLaborPartnerKpi(input: unknown): string {
  const wrapped = recordOf(redactAssistantResult(input));
  const kpi = recordOf(wrapped?.data) || wrapped;
  if (!kpi || kpi.targetReferrals === undefined || kpi.periodStart === undefined) return "";
  const anchor = kpi.periodStart instanceof Date ? kpi.periodStart.toISOString() : String(kpi.periodStart);
  const month = anchor.match(/^(\d{4})-(\d{2})/);
  if (!month) return "";
  const partnerName = typeof kpi.partnerName === "string" && kpi.partnerName.trim() ? kpi.partnerName.trim() : "đối tác đã chọn";
  const target = Number(kpi.targetReferrals);
  if (!Number.isSafeInteger(target) || target < 0) return "";
  const lines = [
    `Xong rồi bạn nhé, mình đã đặt KPI giới thiệu cho ${partnerName}.`,
    `Tháng áp dụng: ${month[2]}/${month[1]}`,
    `Chỉ tiêu giới thiệu: ${target.toLocaleString("vi-VN")} người`,
  ];
  if (typeof kpi.note === "string" && kpi.note.trim()) lines.push(`Ghi chú: ${kpi.note.trim()}`);
  return lines.join("\n");
}

function studentQualityResultRow(operation: ResultOperation, record: ResultRecord): Record<string, string> {
  const row: Record<string, string> = {};
  const includes = (key: string) => operation.resultFields.includes(key);
  const text = (key: string) => typeof record[key] === "string" ? String(record[key]).trim() : "";
  const number = (key: string) => typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : null;
  const count = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
  const formatScore = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
  const rate = (value: number) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)}%`;

  if (includes("studentName") && text("studentName")) row["H\u1ECDc vi\u00EAn"] = text("studentName");
  if (includes("studentPhone") && text("studentPhone")) row["S\u1ED1 \u0111i\u1EC7n tho\u1EA1i"] = text("studentPhone");
  if (includes("batchCode") && text("batchCode")) row["M\u00E3 l\u1EDBp"] = text("batchCode");
  if (includes("courseTitle") && text("courseTitle")) row["Kh\u00F3a h\u1ECDc"] = text("courseTitle");

  if (includes("attendanceRate") || includes("attendanceAttended") || includes("attendanceTotal")) {
    const attended = number("attendanceAttended");
    const total = number("attendanceTotal");
    const attendanceRate = number("attendanceRate");
    row["Chuy\u00EAn c\u1EA7n"] = total !== null && total > 0
      ? `${attended === null ? "0" : count(attended)}/${count(total)}${attendanceRate === null ? "" : ` (${rate(attendanceRate)})`}`
      : attendanceRate === null ? "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u" : rate(attendanceRate);
  }
  if (includes("assignmentRate") || includes("assignmentCompleted") || includes("assignmentTotal")) {
    const completed = number("assignmentCompleted");
    const total = number("assignmentTotal");
    const assignmentRate = number("assignmentRate");
    row["B\u00E0i t\u1EADp"] = total !== null && total > 0
      ? `${completed === null ? "0" : count(completed)}/${count(total)}${assignmentRate === null ? "" : ` (${rate(assignmentRate)})`}`
      : assignmentRate === null ? "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u" : rate(assignmentRate);
  }

  if (includes("latestMiniTestTitle") || includes("latestMiniTestScore") || includes("latestMiniTestMaxScore")) {
    const title = text("latestMiniTestTitle");
    const score = number("latestMiniTestScore");
    const maxScore = number("latestMiniTestMaxScore");
    if (title || score !== null) {
      const scoreText = score === null ? "" : `: ${formatScore(score)}${maxScore === null ? "" : `/${formatScore(maxScore)}`}`;
      row["Ki\u1EC3m tra g\u1EA7n nh\u1EA5t"] = `${title || "B\u00E0i ki\u1EC3m tra"}${scoreText}`;
    }
  }
  if (includes("latestExamName") || includes("latestExamResult")) {
    const name = text("latestExamName");
    const examResult = record.latestExamResult;
    const result = text("latestExamResult") || (typeof examResult === "number" && Number.isFinite(examResult) ? formatScore(examResult) : "");
    if (name || result) row["K\u1EF3 thi g\u1EA7n nh\u1EA5t"] = [name, result].filter(Boolean).join(": ");
  }

  if (includes("warningLevel")) {
    const warningLabels: Record<string, string> = {
      risk: "C\u1EA7n can thi\u1EC7p", watch: "C\u1EA7n theo d\u00F5i", good: "\u1ED4n \u0111\u1ECBnh", unrated: "Ch\u01B0a \u0111\u00E1nh gi\u00E1",
    };
    const warning = text("warningLevel");
    if (warning) row["M\u1EE9c \u0111\u00E1nh gi\u00E1"] = warningLabels[warning] || warning;
  }
  if (includes("teacherAssessment") && text("teacherAssessment")) row["\u0110\u00E1nh gi\u00E1 c\u1EE7a gi\u1EA3ng vi\u00EAn"] = text("teacherAssessment");
  if (includes("attitudeNote") && text("attitudeNote")) row["Ghi ch\u00FA th\u00E1i \u0111\u1ED9"] = text("attitudeNote");
  return row;
}

function remainingTuition(record: ResultRecord): number | null {
  const tuitionNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || !value.trim()) return null;
    const digits = value.replace(/\D/g, "");
    return digits ? Number(digits) : null;
  };
  const fee = tuitionNumber(record.fee);
  const paid = tuitionNumber(record.paidAmount);
  return fee !== null && fee > 0 && paid !== null ? Math.max(0, fee - paid) : null;
}

/** Format only catalog-approved fields into a short, readable result for the conversation. */
export function formatAssistantResult(operation: ResultOperation, input: unknown): string {
  if (operation.id === "dashboard.business-overview") return formatBusinessOverview(input);
  const redacted = redactAssistantResult(input);
  if (["finance.asset.inventory.variance", "finance.asset.inventory.finalize"].includes(operation.id)) {
    const wrapper = recordOf(redacted);
    const result = recordOf(wrapper?.data) || wrapper || {};
    const session = recordOf(result.session) || {};
    const variance = recordOf(result.variance) || result;
    const total = Number.isSafeInteger(Number(variance.total)) && Number(variance.total) >= 0 ? Number(variance.total) : 0;
    const counts = recordOf(variance.counts) || {};
    const count = (key: string) => Number.isSafeInteger(Number(counts[key])) && Number(counts[key]) >= 0 ? Number(counts[key]) : 0;
    const countSummary = [
      ["present", "Có mặt"], ["missing", "Thiếu"], ["damaged", "Hư hỏng"], ["surplus", "Thừa"], ["pending", "Chưa kiểm kê"],
    ].map(([key, label]) => `${label}: ${count(key)}`).join(" · ");
    const sessionCode = typeof session.sessionCode === "string" ? session.sessionCode.trim() : "";
    const summary = operation.id === "finance.asset.inventory.finalize"
      ? `Đã chốt phiên kiểm kê${sessionCode ? ` ${sessionCode}` : ""}.`
      : "Kết quả chênh lệch kiểm kê tài sản.";
    const context = [
      ...(typeof session.name === "string" && session.name.trim() ? [`Phiên kiểm kê: ${session.name.trim()}`] : []),
      ...(typeof session.inventoryDate === "string" ? [`Ngày kiểm kê: ${formatValue(operation, "inventoryDate", session.inventoryDate)}`] : []),
      `Tổng tài sản: ${new Intl.NumberFormat("vi-VN").format(total)} · ${countSummary}`,
    ];
    const variances = Array.isArray(variance.variances) ? variance.variances : [];
    const labels: Record<string, string> = { present: "Có mặt", missing: "Thiếu", damaged: "Hư hỏng", surplus: "Thừa", pending: "Chưa kiểm kê" };
    const rows = variances.slice(0, 8).flatMap((value: unknown) => {
      const item = recordOf(value);
      if (!item) return [];
      const row: Record<string, string> = Object.fromEntries([
        ["assetCode", "Mã tài sản"], ["barcode", "Mã vạch"], ["name", "Tên tài sản"],
      ].flatMap(([key, label]) => typeof item[key] === "string" && String(item[key]).trim()
        ? [[label, String(item[key]).trim().slice(0, 160)]] : []));
      if (typeof item.result === "string") row["Kết quả"] = labels[item.result] || item.result;
      if (typeof item.expectedLocation === "string" && item.expectedLocation.trim()) row["Vị trí dự kiến"] = item.expectedLocation.trim();
      if (typeof item.expectedCustodianName === "string" && item.expectedCustodianName.trim()) row["Người phụ trách"] = item.expectedCustodianName.trim();
      if (typeof item.note === "string" && item.note.trim()) row["Ghi chú"] = item.note.trim().slice(0, 300);
      return Object.keys(row).length ? [row] : [];
    });
    if (!variances.length) return [summary, ...context, "Không có tài sản thiếu, hư hỏng hoặc thừa."].join("\n");
    if (!rows.length) return [summary, ...context, `Có ${variances.length} chênh lệch nhưng chưa đọc được chi tiết.`].join("\n");
    return formatAssistantResultTable(summary, rows, [
      ...context,
      ...(variances.length > rows.length ? [`Còn ${new Intl.NumberFormat("vi-VN").format(variances.length - rows.length)} chênh lệch chưa hiển thị.`] : []),
    ]);
  }
  if (operation.id === "recruitment.report") {
    const wrapper = recordOf(redacted);
    const report = recordOf(wrapper?.data) || wrapper || {};
    const reportType = typeof report.reportType === "string" ? report.reportType : "";
    const summary = typeof report.summary === "string" && report.summary.trim()
      ? report.summary.trim()
      : "Báo cáo tuyển dụng";
    const items = Array.isArray(report.items) ? report.items : [];
    const fieldsByType: Record<string, Array<[string, string]>> = {
      overview: [["name", "Chỉ số"], ["count", "Số lượng"]],
      interviews: [["applicantName", "Ứng viên"], ["jobTitle", "Vị trí"], ["scheduledStart", "Bắt đầu"], ["scheduledEnd", "Kết thúc"], ["interviewers", "Người phỏng vấn"], ["format", "Hình thức"], ["status", "Trạng thái"]],
      interviewers: [["applicantName", "Ứng viên"], ["jobTitle", "Vị trí"], ["scheduledStart", "Thời gian"], ["interviewers", "Người phỏng vấn"], ["format", "Hình thức"], ["status", "Trạng thái"]],
      "interview-results": [["applicantName", "Ứng viên"], ["jobTitle", "Vị trí"], ["scheduledStart", "Thời gian"], ["interviewers", "Người phỏng vấn"], ["result", "Kết quả"], ["status", "Trạng thái"]],
      hires: [["name", "Ứng viên"], ["jobTitle", "Vị trí"], ["outcome", "Kết quả"], ["occurredAt", "Ngày ghi nhận"]],
      onboarded: [["name", "Ứng viên"], ["jobTitle", "Vị trí"], ["outcome", "Kết quả"], ["occurredAt", "Ngày ghi nhận"]],
      "job-applications": [["title", "Vị trí"], ["department", "Phòng ban"], ["count", "Số hồ sơ"]],
      "staffing-gaps": [["name", "Phòng ban"], ["headcount", "Số lượng cần tuyển"], ["filled", "Đã tuyển"], ["gap", "Còn thiếu"], ["count", "Số vị trí"]],
      "job-deadlines": [["title", "Vị trí"], ["department", "Phòng ban"], ["applicationDeadline", "Hạn nhận hồ sơ"], ["status", "Trạng thái"], ["expired", "Đã hết hạn"]],
      "applicants-by-department": [["name", "Phòng ban"], ["count", "Số ứng viên"]],
    };
    const rows = items.slice(0, 50).flatMap((value: unknown) => {
      const item = recordOf(value);
      if (!item) return [];
      const fields = fieldsByType[reportType] || [];
      const row = Object.fromEntries(fields
        .filter(([key]) => Object.hasOwn(item, key) && item[key] !== undefined && item[key] !== null && item[key] !== "")
        .map(([key, label]) => [label, formatValue(operation, key, item[key])]));
      return Object.keys(row).length ? [row] : [];
    });
    if (!rows.length && reportType === "interview-count" && report.total !== undefined && report.total !== null) {
      rows.push({ "Số lịch phỏng vấn": new Intl.NumberFormat("vi-VN").format(Number(report.total)) });
    }
    if (!rows.length) rows.push({ "Thông tin": summary });
    return formatAssistantResultTable(summary, rows,
      items.length > rows.length ? [`Còn ${new Intl.NumberFormat("vi-VN").format(items.length - rows.length)} kết quả chưa hiển thị.`] : []);
  }
  if (operation.id === "payroll.run.complaints.list") {
    const records = collection(redacted) || [];
    const rows = records.slice(0, 8).flatMap(value => {
      const record = recordOf(value);
      if (!record) return [];
      return [Object.fromEntries(operation.resultFields.filter(key => record[key] !== undefined && record[key] !== null && record[key] !== "")
        .map(key => [labelFor(operation, key), formatValue(operation, key, record[key])]))];
    });
    return formatAssistantResultTable(`Có ${records.length} khiếu nại trong lượt lương đã chọn.`, rows,
      records.length > rows.length ? [`Còn ${records.length - rows.length} khiếu nại chưa hiển thị.`] : []);
  }
  const recalculatedSettlement = operation.id === "worker.partner.settlement.recalculate" ? recordOf(recordOf(redacted)?.settlement) : null;
  const safeResult = recalculatedSettlement || redacted;
  const wrappedResult = recordOf(safeResult);
  const reportCollectionRecord = ["employee.birthday.next-month", "hr.training.incomplete.list"].includes(operation.id) && Array.isArray(safeResult)
    ? recordOf(safeResult[0])
    : null;
  const dataResult = recordOf(wrappedResult?.data) || reportCollectionRecord || wrappedResult || {};
  const reportDateRange = (value: unknown) => {
    const range = recordOf(value);
    if (!range) return "";
    const from = typeof range.from === "string" ? formatIsoDate(range.from) : "";
    const to = typeof range.to === "string" ? formatIsoDate(range.to) : "";
    return from && to ? from === to ? from : `${from} đến ${to}` : from || to;
  };
  const countValue = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0
    ? new Intl.NumberFormat("vi-VN").format(Number(value))
    : "0";
  if (operation.id === "hr.contract.missing.list") {
    const employees = Array.isArray(dataResult.withoutContractEmployees) ? dataResult.withoutContractEmployees : [];
    const total = Number.isSafeInteger(Number(dataResult.withoutContractCount)) && Number(dataResult.withoutContractCount) >= 0
      ? Number(dataResult.withoutContractCount)
      : employees.length;
    if (total === 0) return `${operation.title}\nKhông có nhân sự nào đang thiếu hợp đồng hiệu lực trong phạm vi hiện tại.`;
    const rows = employees.slice(0, 8).flatMap((value: unknown) => {
      const employee = recordOf(value);
      return typeof employee?.name === "string" && employee.name.trim()
        ? [{ "Nhân sự": employee.name.trim().slice(0, 160) }]
        : [];
    });
    if (!rows.length) return `${operation.title}\nCó ${countValue(total)} nhân sự chưa có hợp đồng hiệu lực trong phạm vi hiện tại.`;
    return formatAssistantResultTable(
      `Mình tìm thấy ${countValue(total)} nhân sự chưa có hợp đồng hiệu lực.`,
      rows,
      total > rows.length ? [`Còn ${countValue(total - rows.length)} nhân sự chưa hiển thị.`] : [],
    );
  }
  if (operation.id === "department.lookup") {
    const departments = collection(safeResult) || [];
    const rows = departments.flatMap((value: unknown) => {
      const department = recordOf(value);
      if (!department || typeof department.name !== "string" || !department.name.trim()) return [];
      return [{
        "Phòng ban": department.name.trim().slice(0, 120),
        "Trưởng phòng": typeof department.managerName === "string" && department.managerName.trim() ? department.managerName.trim().slice(0, 160) : "Chưa phân công",
        "Số nhân sự": countValue(department.employeeCount),
      }];
    });
    return rows.length
      ? formatAssistantResultTable("Thông tin phòng ban", rows)
      : "Không tìm thấy phòng ban khớp với tên đã nêu trong phạm vi hiện tại.";
  }
  if (operation.id === "department.employees.list") {
    const employees = collection(safeResult) || [];
    const rows = employees.slice(0, 50).flatMap((value: unknown) => {
      const employee = recordOf(value);
      if (!employee || typeof employee.displayName !== "string" || !employee.displayName.trim()) return [];
      return [{
        "Nhân sự": employee.displayName.trim().slice(0, 160),
        ...(typeof employee.jobTitle === "string" && employee.jobTitle.trim() ? { "Chức danh": employee.jobTitle.trim().slice(0, 120) } : {}),
        ...(typeof employee.department === "string" && employee.department.trim() ? { "Phòng ban": employee.department.trim().slice(0, 120) } : {}),
      }];
    });
    if (!rows.length) return "Chưa có nhân sự phù hợp trong phòng ban được chọn.";
    const departmentName = rows[0]["Phòng ban"] || "đã chọn";
    return formatAssistantResultTable(
      `Danh sách nhân sự phòng ${departmentName} · ${countValue(employees.length)} kết quả`,
      rows,
      employees.length > rows.length ? [`Còn ${countValue(employees.length - rows.length)} nhân sự chưa hiển thị.`] : [],
    );
  }
  if (operation.id === "hr.contract.expiring.list") {
    const alerts = Array.isArray(dataResult.expiryAlerts) ? dataResult.expiryAlerts : [];
    const total = Number.isSafeInteger(Number(dataResult.expiryAlertTotal)) && Number(dataResult.expiryAlertTotal) >= 0
      ? Number(dataResult.expiryAlertTotal) : alerts.length;
    if (!total) return `${operation.title}\nKhông có hợp đồng nhân sự nào sắp hết hạn trong phạm vi hiện tại.`;
    const rows = alerts.slice(0, 8).flatMap((value: unknown) => {
      const alert = recordOf(value);
      if (!alert || typeof alert.employeeName !== "string" || !alert.employeeName.trim()) return [];
      return [{
        "Nhân sự": alert.employeeName.trim().slice(0, 160),
        ...(typeof alert.contractType === "string" && alert.contractType ? { "Loại hợp đồng": alert.contractType } : {}),
        ...(typeof alert.endDate === "string" ? { "Ngày hết hạn": formatIsoDate(alert.endDate) } : {}),
        ...(Number.isFinite(Number(alert.daysRemaining)) ? { "Còn lại": `${countValue(alert.daysRemaining)} ngày` } : {}),
      }];
    });
    return rows.length
      ? formatAssistantResultTable(`Có ${countValue(total)} hợp đồng sắp hết hạn.`, rows, total > rows.length ? [`Còn ${countValue(total - rows.length)} hợp đồng chưa hiển thị.`] : [])
      : `${operation.title}\nCó ${countValue(total)} hợp đồng sắp hết hạn trong phạm vi hiện tại.`;
  }
  if (operation.id === "employee.birthday.next-month") {
    const birthdays = Array.isArray(dataResult.birthdays) ? dataResult.birthdays : [];
    if (!birthdays.length) return "Không có nhân sự nào có sinh nhật vào tháng tới trong phạm vi hiện tại.";
    const month = Number.isInteger(Number(dataResult.month)) && Number(dataResult.month) >= 1 && Number(dataResult.month) <= 12
      ? new Intl.DateTimeFormat("vi-VN", { month: "long" }).format(new Date(Date.UTC(2020, Number(dataResult.month) - 1, 1)))
      : "tháng tới";
    const rows = birthdays.slice(0, 20).flatMap((value: unknown) => {
      const employee = recordOf(value);
      if (!employee || typeof employee.displayName !== "string" || typeof employee.birthday !== "string") return [];
      return [{ "Nhân sự": employee.displayName, "Ngày sinh": employee.birthday }];
    });
    return rows.length
      ? formatAssistantResultTable(`Có ${countValue(birthdays.length)} nhân sự sinh nhật trong ${month}.`, rows, birthdays.length > rows.length ? [`Còn ${countValue(birthdays.length - rows.length)} nhân sự chưa hiển thị.`] : [])
      : "Không có nhân sự nào có sinh nhật vào tháng tới trong phạm vi hiện tại.";
  }
  if (operation.id === "hr.training.incomplete.list") {
    const enrollments = Array.isArray(dataResult.incompleteEnrollments) ? dataResult.incompleteEnrollments : [];
    const total = Number.isSafeInteger(Number(dataResult.incompleteTotal)) ? Number(dataResult.incompleteTotal) : enrollments.length;
    const courseName = typeof dataResult.courseName === "string" && dataResult.courseName.trim() ? dataResult.courseName.trim() : "";
    const rows = enrollments.slice(0, 20).flatMap((value: unknown) => {
      const enrollment = recordOf(value);
      if (!enrollment || typeof enrollment.employeeName !== "string") return [];
      const status = enrollment.status === "in_progress" ? "Đang học" : enrollment.status === "not_started" ? "Chưa bắt đầu" : String(enrollment.status || "Chưa hoàn thành");
      return [{
        "Nhân sự": enrollment.employeeName,
        ...(typeof enrollment.courseTitle === "string" ? { "Khóa đào tạo": enrollment.courseTitle } : {}),
        ...(Number.isFinite(Number(enrollment.progress)) ? { "Tiến độ": `${countValue(enrollment.progress)}%` } : {}),
        "Trạng thái": status,
      }];
    });
    const incompleteNote = dataResult.truncated === true ? "Danh sách đăng ký đào tạo vượt quá giới hạn đọc 1.000 dòng. Kết quả có thể chưa bao gồm toàn bộ nhân sự." : "";
    if (!total) return incompleteNote || (courseName
      ? `Không có lượt học nào chưa hoàn thành khóa học ${courseName} trong phạm vi hiện tại.`
      : "Không có đăng ký đào tạo nội bộ nào chưa hoàn thành trong phạm vi hiện tại.");
    return rows.length
      ? formatAssistantResultTable(`Có ${countValue(total)} lượt học chưa hoàn thành${courseName ? ` trong khóa học ${courseName}` : ""}.`, rows, [
        ...(total > rows.length ? [`Còn ${countValue(total - rows.length)} lượt học chưa hiển thị.`] : []),
        ...(incompleteNote ? [incompleteNote] : []),
      ])
      : `${operation.title}\nCó ${countValue(total)} lượt học chưa hoàn thành.${incompleteNote ? `\n${incompleteNote}` : ""}`;
  }
  if (operation.id === "hr.contract.extend") {
    const name = typeof dataResult.employeeName === "string" ? dataResult.employeeName.trim() : "nhân sự đã chọn";
    const date = (value: unknown) => typeof value === "string" ? formatIsoDate(value) : value instanceof Date ? formatIsoDate(value.toISOString()) : "";
    const previous = date(dataResult.previousEndDate);
    const next = date(dataResult.newEndDate);
    const extensionDate = date(dataResult.extensionDate);
    const rows = [{
      "Nhân sự": name,
      ...(previous ? { "Ngày hết hạn cũ": previous } : {}),
      ...(next ? { "Ngày hết hạn mới": next } : {}),
      ...(extensionDate ? { "Ngày ghi nhận gia hạn": extensionDate } : {}),
    }];
    return formatAssistantResultTable(`Đã gia hạn hợp đồng cho ${name}.`, rows);
  }
  if (["timekeeping.records.list", "timekeeping.records.overview", "timekeeping.records.late", "timekeeping.records.absent", "timekeeping.records.unrecorded", "timekeeping.records.leave"].includes(operation.id)) {
    const records = collection(safeResult) || [];
    const matches = (record: unknown) => {
      const row = recordOf(record);
      if (!row) return false;
      const status = typeof row.attendanceStatus === "string" ? normalizeReportStatus(row.attendanceStatus) : "";
      if (operation.id === "timekeeping.records.late") return status.includes("di muon");
      if (operation.id === "timekeeping.records.absent") return status === "vang";
      if (operation.id === "timekeeping.records.unrecorded") return status.startsWith("chua ghi nhan");
      if (operation.id === "timekeeping.records.leave") return status === "nghi phep";
      return true;
    };
    const filtered = records.filter(matches).slice(0, 100);
    const labels: Record<string, string> = {
      "timekeeping.records.late": "nhân sự đi muộn",
      "timekeeping.records.absent": "nhân sự vắng",
      "timekeeping.records.unrecorded": "nhân sự chưa ghi nhận chấm công",
      "timekeeping.records.leave": "nhân sự nghỉ phép",
    };
    if (!filtered.length) {
      if (!records.length) return "Chưa có dữ liệu nhân sự/chấm công trong phạm vi này để xác định tình trạng đi làm.";
      const category = labels[operation.id];
      return category ? `Hôm nay không có ${category} trong phạm vi hiện tại.` : `${operation.title}\nKhông có dữ liệu chấm công trong phạm vi hiện tại.`;
    }
    const rows = filtered.flatMap((value: unknown) => {
      const record = recordOf(value);
      if (!record || typeof record.employeeName !== "string") return [];
      return [{
        "Nhân sự": record.employeeName,
        ...(typeof record.date === "string" ? { "Ngày": formatIsoDate(record.date) } : {}),
        ...(typeof record.attendanceStatus === "string" ? { "Trạng thái": record.attendanceStatus } : {}),
        ...(record.checkIn ? { "Giờ vào": formatValue(operation, "checkIn", record.checkIn) } : {}),
        ...(record.checkOut ? { "Giờ ra": formatValue(operation, "checkOut", record.checkOut) } : {}),
      }];
    });
    return formatAssistantResultTable(`Có ${countValue(filtered.length)} ${labels[operation.id] || "bản ghi chấm công"} hôm nay.`, rows);
  }
  if (operation.id.startsWith("timekeeping.records.monthly.")) {
    const records = Array.isArray(dataResult.records) ? dataResult.records : [];
    const year = Number(dataResult.year);
    const month = Number(dataResult.month);
    const period = Number.isInteger(month) && Number.isInteger(year) ? `${String(month).padStart(2, "0")}/${year}` : "tháng được chọn";
    const dayValue = (value: unknown) => Number.isFinite(Number(value))
      ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value))
      : "0";
    let filtered = records.map(recordOf).filter((record): record is Record<string, any> => Boolean(record));
    let summary: string;
    if (operation.id === "timekeeping.records.monthly.under-threshold") {
      const thresholdDays = Number(dataResult.thresholdDays);
      filtered = filtered.filter(record => Number(record.workedDays) < thresholdDays);
      const thresholdLabel = dayValue(thresholdDays);
      summary = filtered.length
        ? `Có ${countValue(filtered.length)} nhân sự chưa đủ ${thresholdLabel} công trong ${period}.`
        : `Không có nhân sự nào dưới ${thresholdLabel} công trong ${period}.`;
    } else if (operation.id === "timekeeping.records.monthly.most-absent") {
      const highest = filtered.reduce((max, record) => Math.max(max, Number(record.daysOff) || 0), 0);
      if (highest > 0) {
        filtered = filtered.filter(record => Number(record.daysOff) === highest);
        summary = `Nhân sự nghỉ nhiều nhất trong ${period}: ${dayValue(highest)} ngày vắng hoặc nghỉ phép.`;
      } else {
        const highestUnrecorded = filtered.reduce((max, record) => Math.max(max, Number(record.unrecordedDays) || 0), 0);
        filtered = highestUnrecorded > 0 ? filtered.filter(record => Number(record.unrecordedDays) === highestUnrecorded) : [];
        summary = filtered.length
          ? `Không có ngày vắng hoặc nghỉ phép được ghi nhận trong ${period}. Nhân sự thiếu bản ghi chấm công nhiều nhất có ${dayValue(highestUnrecorded)} ngày. Chưa thể xác nhận đây là ngày nghỉ.`
          : `Không có ngày vắng hoặc nghỉ phép được ghi nhận trong ${period}.`;
      }
    } else if (operation.id === "timekeeping.records.monthly.most-late") {
      filtered = filtered.filter(record => Number(record.lateDays) > 0).sort((left, right) => Number(right.lateDays) - Number(left.lateDays));
      summary = filtered.length ? `Có ${countValue(filtered.length)} nhân sự đi muộn trong ${period}. Danh sách xếp theo số lượt giảm dần.` : `Không ghi nhận lượt đi muộn trong ${period}.`;
    } else if (operation.id === "timekeeping.records.monthly.most-leave") {
      const highest = filtered.reduce((max, record) => Math.max(max, Number(record.leaveDays) || 0), 0);
      filtered = highest > 0 ? filtered.filter(record => Number(record.leaveDays) === highest) : [];
      summary = filtered.length ? `Nhân sự nghỉ phép nhiều nhất trong ${period}: ${dayValue(highest)} ngày.` : `Không ghi nhận ngày nghỉ phép trong ${period}.`;
    } else if (operation.id === "timekeeping.records.monthly.leave-summary") {
      filtered = filtered.filter(record => Number(record.leaveDays) > 0).sort((left, right) => Number(right.leaveDays) - Number(left.leaveDays));
      summary = filtered.length ? `Có ${countValue(filtered.length)} nhân sự nghỉ phép trong ${period}.` : `Không ghi nhận ngày nghỉ phép trong ${period}.`;
    } else if (operation.id === "timekeeping.records.monthly.unrecorded") {
      filtered = filtered.filter(record => Number(record.unrecordedDays) > 0).sort((left, right) => Number(right.unrecordedDays) - Number(left.unrecordedDays));
      summary = filtered.length ? `Có ${countValue(filtered.length)} nhân sự thiếu bản ghi chấm công trong ${period}.` : `Không có nhân sự nào thiếu bản ghi chấm công trong ${period}.`;
    } else {
      summary = `Tổng hợp chấm công tháng ${period}: ${countValue(filtered.length)} nhân sự.`;
    }
    const rows = filtered.slice(0, 20).flatMap(record => typeof record.employeeName === "string" && record.employeeName.trim() ? [{
      "Nhân sự": record.employeeName.trim().slice(0, 160),
      ...(operation.id !== "timekeeping.records.monthly.most-absent" ? { "Công đã làm": dayValue(record.workedDays) } : {}),
      "Ngày vắng": dayValue(record.absentDays),
      "Nghỉ phép": dayValue(record.leaveDays),
      "Tổng ngày nghỉ": dayValue(record.daysOff),
      "Đi muộn": dayValue(record.lateDays),
      "Về sớm": dayValue(record.leftEarlyDays),
      ...(operation.id === "timekeeping.records.monthly.unrecorded" || (operation.id === "timekeeping.records.monthly.most-absent" && Number(record.daysOff) === 0) ? { "Ngày thiếu chấm công": dayValue(record.unrecordedDays) } : {}),
    }] : []);
    return rows.length
      ? formatAssistantResultTable(summary, rows, filtered.length > rows.length ? [`Còn ${countValue(filtered.length - rows.length)} nhân sự chưa hiển thị.`] : [])
      : summary;
  }
  if (operation.id === "task.kpi.monthly") {
    const rows = Array.isArray(dataResult.rows) ? dataResult.rows.map(recordOf).filter((record): record is Record<string, any> => Boolean(record)) : [];
    const exact = dataResult.completionFilter === "exactly-100";
    const period = typeof dataResult.periodKey === "string" && /^\d{4}-\d{2}$/.test(dataResult.periodKey)
      ? `${dataResult.periodKey.slice(5, 7)}/${dataResult.periodKey.slice(0, 4)}` : "tháng được chọn";
    const label = exact ? "đạt 100% KPI" : "chưa đạt 100% KPI";
    const displayed = rows.filter(record => typeof record.employeeName === "string" && Number.isFinite(Number(record.percent)));
    const tableRows = displayed.slice(0, 50).map(record => ({
      "Nhân sự": String(record.employeeName).trim().slice(0, 160),
      "Tổng công việc": countValue(record.totalTasks),
      "Đã hoàn thành": countValue(record.completedTasks),
      "Còn lại": countValue(record.pendingTasks),
      "Tỷ lệ KPI": `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(record.percent))}%`,
    }));
    return tableRows.length
      ? formatAssistantResultTable(`Danh sách nhân sự ${label} trong ${period}.`, tableRows,
        displayed.length > tableRows.length ? [`Còn ${countValue(displayed.length - tableRows.length)} nhân sự chưa hiển thị.`] : [])
      : `Không có nhân sự ${label} trong ${period}.`;
  }
  if (operation.id === "hr.leave.applications.list") {
    const reportKind = String(dataResult.reportKind || "requests");
    const requests = Array.isArray(dataResult.requests) ? dataResult.requests.map(recordOf).filter((record): record is Record<string, any> => Boolean(record)) : [];
    if (reportKind === "leave-most" || reportKind === "wfh-most") {
      const leaders = Array.isArray(dataResult.leaders) ? dataResult.leaders.map(recordOf).filter((record): record is Record<string, any> => Boolean(record)) : [];
      const highest = Number(dataResult.maximumDays) || 0;
      const rows = leaders.slice(0, 20).map(row => ({ "Nhân sự": row.employeeName, "Số ngày": countValue(row.days), "Số đơn": countValue(row.requests) }));
      const subject = reportKind === "wfh-most" ? "làm việc từ xa" : "nghỉ phép";
      return rows.length ? formatAssistantResultTable(`Nhân sự ${subject} nhiều nhất trong khoảng thời gian được hỏi: ${countValue(highest)} ngày.`, rows)
        : `Không có dữ liệu ${subject} đã duyệt trong khoảng thời gian được hỏi.`;
    }
    if (!requests.length) return "Không có đơn nghỉ phép nào trong khoảng thời gian được hỏi.";
    const rows = requests.slice(0, 50).map(request => ({
      "Nhân sự": String(request.employeeName || "").slice(0, 160),
      "Loại đơn": request.requestKind === "wfh" ? "Làm việc từ xa" : request.type === "leave" || request.requestKind === "leave" ? "Nghỉ phép" : String(request.type || "Yêu cầu"),
      ...(typeof request.startDate === "string" ? { "Từ ngày": formatValue(operation, "startDate", request.startDate) } : {}),
      ...(typeof request.endDate === "string" ? { "Đến ngày": formatValue(operation, "endDate", request.endDate) } : {}),
      ...(typeof request.reason === "string" && request.reason.trim() ? { "Lý do": request.reason.trim().slice(0, 200) } : {}),
      ...(typeof request.status === "string" ? { "Trạng thái": ({ pending: "Đang chờ duyệt", approved: "Đã duyệt", rejected: "Đã từ chối" } as Record<string, string>)[request.status] || request.status } : {}),
    }));
    return formatAssistantResultTable(`Có ${countValue(requests.length)} đơn nghỉ phép trong khoảng thời gian được hỏi.`, rows,
      requests.length > rows.length ? [`Còn ${countValue(requests.length - rows.length)} đơn chưa hiển thị.`] : []);
  }
  if (operation.id === "hr.calendar.events.list") {
    const events = Array.isArray(safeResult) ? safeResult.map(recordOf).filter((record): record is Record<string, any> => Boolean(record))
      : Array.isArray(dataResult.events) ? dataResult.events.map(recordOf).filter((record): record is Record<string, any> => Boolean(record)) : [];
    const rows = events.slice(0, 50).map(event => ({
      "Sự kiện": String(event.title || "").slice(0, 200),
      "Loại": event.type === "meeting" ? "Cuộc họp" : event.type === "reminder" ? "Nhắc việc" : "Sự kiện",
      "Bắt đầu": typeof event.startDate === "string" && event.startDate.trim() ? formatValue(operation, "startDate", event.startDate) : "Chưa có thông tin",
      "Kết thúc": typeof event.endDate === "string" && event.endDate.trim() ? formatValue(operation, "endDate", event.endDate) : "Chưa có thông tin",
      ...(typeof event.location === "string" && event.location.trim() ? { "Địa điểm": event.location.trim().slice(0, 160) } : {}),
      "Trạng thái": typeof event.status === "string" && event.status.trim() ? formatValue(operation, "status", event.status) : "Chưa có thông tin",
    }));
    return rows.length ? formatAssistantResultTable(`Có ${countValue(events.length)} sự kiện trong khoảng thời gian được hỏi.`, rows,
      events.length > rows.length ? [`Còn ${countValue(events.length - rows.length)} sự kiện chưa hiển thị.`] : [])
      : "Không có sự kiện nào trong khoảng thời gian được hỏi.";
  }
  if (operation.id === "employee.count") {
    const record = (Array.isArray(safeResult) ? recordOf(safeResult[0]) : recordOf(safeResult)) || {};
    const rawCount = record.count;
    const count = typeof rawCount === "number" || (typeof rawCount === "string" && rawCount.trim()) ? Number(rawCount) : NaN;
    if (!Number.isSafeInteger(count) || count < 0) return "Mình chưa đọc được tổng số nhân sự trong phạm vi hiện tại.";
    const total = count;
    const branch = typeof record.branchName === "string" && record.branchName.trim()
      ? ` tại chi nhánh ${record.branchName.trim()}`
      : typeof record.branchCode === "string" && record.branchCode.trim()
        ? ` tại chi nhánh ${record.branchCode.trim()}`
        : record.scope === "company"
          ? " trong toàn công ty, bao gồm các chi nhánh"
          : " trong công ty hiện tại";
    const createdFrom = typeof record.createdFrom === "string" ? formatAssistantTemporalValue(record.createdFrom) : undefined;
    const createdTo = typeof record.createdTo === "string" ? formatAssistantTemporalValue(record.createdTo) : undefined;
    const period = createdFrom || createdTo ? ` có hồ sơ được tạo${createdFrom ? ` từ ${createdFrom}` : ""}${createdTo ? ` đến ${createdTo}` : ""}` : "";
    return `Có ${countValue(total)} nhân sự${period}${branch}.`;
  }
  if (operation.id === "department.unmanaged.list") {
    const departments = (collection(safeResult) || []).map(recordOf)
      .filter((record): record is ResultRecord & { name: string } => record !== null && typeof record.name === "string" && record.name.trim().length > 0);
    const rows = departments.slice(0, 50).map(record => ({ "Phòng ban": record.name.trim().slice(0, 120) }));
    const summary = departments.length
      ? `Có ${countValue(departments.length)} phòng ban chưa có người quản lý.`
      : "Không có phòng ban nào đang thiếu người quản lý.";
    return rows.length
      ? formatAssistantResultTable(summary, rows, departments.length > rows.length ? [`Còn ${countValue(departments.length - rows.length)} phòng ban chưa hiển thị.`] : [])
      : summary;
  }
  if (operation.id.startsWith("leave.balances.")) {
    const balances = Array.isArray(dataResult.balances) ? dataResult.balances : [];
    const year = Number(dataResult.year);
    const leaveDayValue = (value: unknown) => Number.isFinite(Number(value))
      ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value))
      : "0";
    let filtered = balances.map(recordOf).filter((record): record is Record<string, any> => Boolean(record));
    const thresholdDays = operation.id === "leave.balances.minimum" ? Number(dataResult.thresholdDays) : NaN;
    if (operation.id === "leave.balances.minimum") filtered = filtered.filter(record => Number(record.remaining) >= thresholdDays);
    if (operation.id === "leave.balances.exhausted") filtered = filtered.filter(record => Number(record.entitlement) > 0 && Number(record.remaining) <= 0);
    const rows = filtered.slice(0, 20).flatMap(record => typeof record.employeeName === "string" && record.employeeName.trim() ? [{
      "Nhân sự": record.employeeName.trim().slice(0, 160),
      ...(typeof record.department === "string" && record.department.trim() ? { "Phòng ban": record.department.trim().slice(0, 100) } : {}),
      "Phép được hưởng": leaveDayValue(record.entitlement),
      "Đã dùng": leaveDayValue(record.used),
      "Chờ duyệt": leaveDayValue(record.pending),
      "Nghỉ không phép": leaveDayValue(record.unexcused),
      "Còn lại": leaveDayValue(record.remaining),
    }] : []);
    const yearLabel = Number.isInteger(year) ? ` năm ${year}` : "";
    const summary = operation.id === "leave.balances.minimum"
      ? `Có ${countValue(filtered.length)} nhân sự còn từ ${leaveDayValue(thresholdDays)} ngày phép trở lên${yearLabel}.`
      : operation.id === "leave.balances.exhausted"
        ? `${countValue(filtered.length)} nhân sự đã dùng hết phép năm${yearLabel}.`
        : `Số dư phép năm${yearLabel} của ${countValue(filtered.length)} nhân sự.`;
    return rows.length
      ? formatAssistantResultTable(summary, rows, filtered.length > rows.length ? [`Còn ${countValue(filtered.length - rows.length)} nhân sự chưa hiển thị.`] : [])
      : summary;
  }
  if (operation.id === "timekeeping.work-calendar.month-holidays") {
    const days = collection(safeResult) || [];
    const rows = days.slice(0, 31).flatMap((value: unknown) => {
      const day = recordOf(value);
      if (!day || typeof day.date !== "string" || typeof day.name !== "string") return [];
      return [{ "Ngày": formatIsoDate(day.date), "Nội dung": day.name.trim().slice(0, 160), "Loại ngày": typeof day.dayTypeLabel === "string" ? day.dayTypeLabel : "Ngày nghỉ" }];
    });
    return rows.length ? formatAssistantResultTable("Các ngày nghỉ đã áp dụng trong tháng được hỏi.", rows) : "Không có ngày nghỉ lễ hoặc nghỉ bù đã áp dụng trong tháng được hỏi.";
  }
  if (operation.id === "timekeeping.work-calendar.named-holiday") {
    const days = collection(safeResult) || [];
    const rows = days.slice(0, 31).flatMap((value: unknown) => {
      const day = recordOf(value);
      if (!day || typeof day.date !== "string" || typeof day.name !== "string") return [];
      return [{ "Ngày": formatIsoDate(day.date), "Tên ngày nghỉ": day.name.trim().slice(0, 160) }];
    });
    return rows.length
      ? formatAssistantResultTable("Ngày nghỉ hoặc ngày đặc biệt đã lưu trong lịch làm việc công ty.", rows)
      : "Chưa tìm thấy ngày có tên này trong lịch làm việc của công ty.";
  }
  if (["student.bulk.preview", "student.bulk.create"].includes(operation.id)) {
    const errors = Array.isArray(dataResult.errors) ? dataResult.errors : [];
    const importedCount = Number.isSafeInteger(Number(dataResult.importedCount)) ? Math.max(0, Number(dataResult.importedCount)) : 0;
    const skippedCount = Number.isSafeInteger(Number(dataResult.skippedCount)) ? Math.max(0, Number(dataResult.skippedCount)) : errors.length;
    const rows = errors.slice(0, 20).flatMap((entry: unknown, index: number) => {
      const error = recordOf(entry);
      if (!error) return [];
      return [{
        "Dòng": String(Number.isSafeInteger(Number(error.row)) && Number(error.row) > 0 ? Number(error.row) : index + 1),
        ...(typeof error.name === "string" && error.name.trim() ? { "Học viên": error.name.trim().slice(0, 160) } : {}),
        ...(typeof error.phone === "string" && error.phone.trim() ? { "Số điện thoại": error.phone.trim().slice(0, 40) } : {}),
        "Lý do": typeof error.reason === "string" && error.reason.trim() ? error.reason.trim().slice(0, 240) : "Dữ liệu cần kiểm tra.",
      }];
    });
    const summary = operation.id === "student.bulk.preview"
      ? rows.length ? `Có ${errors.length} dòng cần sửa trước khi nhập.` : "Danh sách học viên chưa có dòng nào cần sửa."
      : `Đã nhập ${countValue(importedCount)} học viên. Bỏ qua ${countValue(skippedCount)} dòng.`;
    const after = errors.length > rows.length ? [`Còn ${errors.length - rows.length} dòng lỗi chưa hiển thị.`] : [];
    return rows.length ? formatAssistantResultTable(summary, rows, after) : summary;
  }
  const moneyValue = (value: unknown) => Number.isFinite(Number(value))
    ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value))} ₫`
    : "0 ₫";
  if (operation.id === "retail.invoice.summary") {
    return [
      operation.title,
      ...(reportDateRange(dataResult.range) ? [`Thời gian: ${reportDateRange(dataResult.range)}`] : []),
      `Tổng số hóa đơn: ${countValue(dataResult.invoiceCount)}`,
      `Đang phát hành: ${countValue(dataResult.issuedCount)} · ${moneyValue(dataResult.issuedAmount)}`,
      `Đã hủy: ${countValue(dataResult.voidCount)} · ${moneyValue(dataResult.voidAmount)}`,
      `Đã thanh toán: ${moneyValue(dataResult.paidAmount)} · Còn phải thu: ${moneyValue(dataResult.dueAmount)}`,
    ].join("\n");
  }
  if (operation.id === "retail.report.summary") {
    const summary = recordOf(dataResult.summary) || {};
    const paymentMix = Array.isArray(dataResult.paymentMix) ? dataResult.paymentMix : [];
    const products = Array.isArray(dataResult.products) ? dataResult.products : [];
    const timeSeries = Array.isArray(dataResult.timeSeries) ? dataResult.timeSeries : [];
    const lines = [
      operation.title,
      ...(reportDateRange(dataResult.range) ? [`Thời gian: ${reportDateRange(dataResult.range)}`] : []),
      `Đơn hàng: ${countValue(summary.orderCount)}`,
      `Doanh số: ${moneyValue(summary.grossSales)} · Hoàn tiền: ${moneyValue(summary.refunds)} · Sau hoàn: ${moneyValue(summary.netSales)}`,
      `Đã thu: ${moneyValue(summary.collectedAmount)} · Còn phải thu: ${moneyValue(summary.dueAmount)}`,
      `Giá trị đơn trung bình: ${moneyValue(summary.averageOrderValue)}`,
      ...(typeof summary.grossProfit === "number" ? [`Lợi nhuận gộp: ${moneyValue(summary.grossProfit)}${typeof summary.grossMarginPercent === "number" ? ` · Biên ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(summary.grossMarginPercent)}%` : ""}`] : []),
      ...(paymentMix.length ? [`Thanh toán: ${paymentMix.slice(0, 4).flatMap((value: unknown) => {
        const method = recordOf(value);
        return method ? [`${formatValue(operation, "method", method.method)} ${moneyValue(method.amount)}`] : [];
      }).join(" · ")}`] : []),
      ...(products.length ? ["Sản phẩm bán chạy:", ...products.slice(0, 5).flatMap((value: unknown, index: number) => {
        const product = recordOf(value);
        if (!product) return [];
        const name = typeof product.productName === "string" && product.productName ? product.productName : "Sản phẩm";
        return [`${index + 1}. ${name} · ${countValue(product.netQuantity)} sản phẩm · ${moneyValue(product.netSales)}`];
      })] : []),
      ...(timeSeries.length > 1 ? [`Số ngày có dữ liệu: ${countValue(timeSeries.filter((value: unknown) => Number(recordOf(value)?.orderCount) > 0).length)} / ${countValue(timeSeries.length)}`] : []),
    ];
    return lines.join("\n");
  }
  if (operation.id === "retail.invoice.list") {
    const rows = Array.isArray(dataResult.items) ? dataResult.items : collection(safeResult) || [];
    const total = Number.isSafeInteger(Number(dataResult.total)) && Number(dataResult.total) >= 0 ? Number(dataResult.total) : rows.length;
    if (!total) return `${operation.title}\nKhông có kết quả phù hợp.`;
    const displayed = rows.slice(0, 8).map((value: unknown, index: number) => {
      const invoice = recordOf(value);
      if (!invoice) return "";
      const snapshot = recordOf(invoice.snapshot) || {};
      const row = {
        invoiceNo: invoice.invoiceNo,
        orderCode: invoice.orderCode,
        customerName: snapshot.customerName,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        grandTotal: snapshot.grandTotal,
        paymentStatus: snapshot.paymentStatus,
        paidAmount: snapshot.paidAmount,
        dueAmount: snapshot.dueAmount,
      };
      const summary = formatRecord(operation, row).replace(/\n/g, " · ");
      return summary ? `${index + 1}. ${summary}` : "";
    }).filter(Boolean);
    const shown = displayed.length < total ? ` (hiển thị ${displayed.length})` : "";
    return `${operation.title} · ${total} kết quả${shown}:\n${displayed.join("\n")}`;
  }
  if (operation.id === "retail.order.detail") {
    const items = Array.isArray(dataResult.items) ? dataResult.items : [];
    const payments = Array.isArray(dataResult.payments) ? dataResult.payments : [];
    return [
      operation.title,
      ...(typeof dataResult.orderCode === "string" ? [`Mã đơn hàng: ${dataResult.orderCode}`] : []),
      ...(typeof dataResult.customerName === "string" ? [`Khách hàng: ${dataResult.customerName}`] : []),
      ...(typeof dataResult.status === "string" ? [`Trạng thái đơn: ${formatValue(operation, "status", dataResult.status)}`] : []),
      ...(typeof dataResult.paymentStatus === "string" ? [`Thanh toán: ${formatValue(operation, "paymentStatus", dataResult.paymentStatus)}`] : []),
      ...(typeof dataResult.businessDate === "string" ? [`Ngày bán: ${formatValue(operation, "businessDate", dataResult.businessDate)}`] : []),
      ...(items.length ? ["Sản phẩm:", ...items.slice(0, 10).flatMap((value: unknown, index: number) => {
        const item = recordOf(value);
        if (!item) return [];
        const product = String(item.productName || item.sku || "Sản phẩm");
        const sku = typeof item.sku === "string" && item.sku && item.sku !== product ? ` (${item.sku})` : "";
        return [`${index + 1}. ${product}${sku} · ${countValue(item.quantity)} × ${moneyValue(item.unitPrice)} · Thành tiền ${moneyValue(item.lineTotal)}`];
      })] : ["Sản phẩm: Chưa có thông tin dòng hàng."]),
      `Tổng đơn: ${moneyValue(dataResult.grandTotal)} · Đã thanh toán: ${moneyValue(dataResult.paidAmount)}`,
      ...(Number(dataResult.refundedAmount) > 0 ? [`Đã hoàn: ${moneyValue(dataResult.refundedAmount)}`] : []),
      `Còn phải trả: ${moneyValue(dataResult.dueAmount)}`,
      ...(payments.length ? [`Các khoản thu: ${payments.slice(0, 5).flatMap((value: unknown) => {
        const payment = recordOf(value);
        return payment ? [`${formatValue(operation, "paymentMethod", payment.method)} ${moneyValue(payment.amount)}`] : [];
      }).join(" · ")}`] : []),
    ].join("\n");
  }
  if (operation.id === "retail.invoice.detail") {
    const snapshot = recordOf(dataResult.snapshot) || {};
    const lines = [
      typeof dataResult.invoiceNo === "string" ? `Số hóa đơn: ${dataResult.invoiceNo}` : "",
      typeof dataResult.orderCode === "string" ? `Mã đơn hàng: ${dataResult.orderCode}` : "",
      typeof dataResult.status === "string" ? `Trạng thái: ${formatValue(operation, "status", dataResult.status)}` : "",
      typeof dataResult.issuedAt === "string" ? `Ngày phát hành: ${formatValue(operation, "issuedAt", dataResult.issuedAt)}` : "",
      typeof snapshot.customerName === "string" ? `Khách hàng: ${snapshot.customerName}` : "",
      ...(Array.isArray(snapshot.items) && snapshot.items.length ? ["Sản phẩm:", ...snapshot.items.slice(0, 10).flatMap((value: unknown, index: number) => {
        const item = recordOf(value);
        if (!item) return [];
        return [`${index + 1}. ${String(item.productName || item.sku || "Sản phẩm")} · ${countValue(item.quantity)} × ${moneyValue(item.unitPrice)} · Thành tiền ${moneyValue(item.lineTotal)}`];
      })] : []),
      `Tổng hóa đơn: ${moneyValue(snapshot.grandTotal)}`,
      `Đã thanh toán: ${moneyValue(snapshot.paidAmount)} · Còn phải trả: ${moneyValue(snapshot.dueAmount)}`,
      ...(Array.isArray(snapshot.payments) && snapshot.payments.length ? [`Các khoản thu: ${snapshot.payments.slice(0, 5).flatMap((value: unknown) => {
        const payment = recordOf(value);
        return payment ? [`${formatValue(operation, "paymentMethod", payment.method)} ${moneyValue(payment.amount)}`] : [];
      }).join(" · ")}`] : []),
    ].filter(Boolean);
    return [operation.title, ...(lines.length ? lines : ["Không tìm thấy hóa đơn phù hợp."])].join("\n");
  }
  if (["retail.points.policy.get", "retail.points.policy.update"].includes(operation.id)) {
    const wrapped = recordOf(safeResult);
    const policy = recordOf(wrapped?.data) || wrapped || {};
    const money = (value: unknown) => Number.isFinite(Number(value))
      ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value))} ₫`
      : "Chưa cài đặt";
    const percent = Number.isFinite(Number(policy.maxRedeemPercent))
      ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(policy.maxRedeemPercent))}%`
      : "Chưa cài đặt";
    return [
      operation.title,
      `Tích điểm: ${policy.enabled === true ? "Đang bật" : policy.enabled === false ? "Đang tắt" : "Chưa cài đặt"}`,
      `Chi tiêu để nhận 1 điểm: ${money(policy.earnVndPerPoint)}`,
      `Giá trị quy đổi mỗi điểm: ${money(policy.redeemVndPerPoint)}`,
      `Giới hạn thanh toán bằng điểm: tối đa ${percent} giá trị đơn hàng`,
    ].join("\n");
  }
  if (operation.id === "api.get.f741231162e2386f") {
    const wrapped = recordOf(safeResult);
    const result = recordOf(wrapped?.data) || wrapped || {};
    const workers = recordOf(result.workersByStatus) || {};
    const projects = recordOf(result.projectsByStatus) || {};
    const alerts = recordOf(result.contractAlerts) || {};
    const count = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? new Intl.NumberFormat("vi-VN").format(Number(value)) : "0";
    const topProjects = Array.isArray(result.topProjects) ? result.topProjects : [];
    const shownProjects = topProjects.slice(0, 4).flatMap((value: unknown) => {
      const project = recordOf(value);
      if (!project || typeof project.name !== "string") return [];
      return [`- ${project.name} · ${count(project.allocated)} người${project.quota ? ` / chỉ tiêu ${count(project.quota)}` : ""}`];
    });
    const lines = [
      `Người lao động: ${count(result.totalWorkers)} · Đang hoạt động: ${count(result.activeWorkers)}`,
      `Theo trạng thái: đang hoạt động ${count(workers.active)} · tạm ngừng ${count(workers.inactive)} · đã bố trí ${count(workers.placed)}`,
      `Dự án: ${count(result.projects)} · đang triển khai ${count(projects.active)} · dự kiến ${count(projects.planned)} · hoàn thành ${count(projects.completed)}`,
      `Hợp đồng sắp hết hạn: ${count(alerts.expiringCount)} · đã hết hạn: ${count(alerts.expiredCount)}`,
      ...(shownProjects.length ? ["Dự án có phân bổ:", ...shownProjects] : []),
    ];
    return [operation.title, ...lines].join("\n");
  }
  if (operation.id === "api.get.0c557a74cbc907f9") {
    const wrapped = recordOf(safeResult);
    const result = recordOf(wrapped?.data) || wrapped || {};
    const contracts = Array.isArray(result.contracts) ? result.contracts : [];
    const alerts = Array.isArray(result.expiryAlerts) ? result.expiryAlerts : [];
    const date = (value: unknown) => {
      if (typeof value !== "string" && !(value instanceof Date)) return "";
      const parsed = new Date(value);
      return Number.isNaN(parsed.valueOf()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(parsed);
    };
    const statuses: Record<string, string> = { draft: "Bản nháp", active: "Đang hiệu lực", expired: "Đã hết hạn", terminated: "Đã chấm dứt" };
    const total = Number.isSafeInteger(Number(result.total)) ? Number(result.total) : contracts.length;
    const lines = [
      `Hợp đồng: ${total}`,
      ...contracts.slice(0, 5).flatMap((value: unknown) => {
        const item = recordOf(value);
        if (!item) return [];
        const employee = typeof item.employeeName === "string" ? item.employeeName : "Người lao động";
        const kind = typeof item.contractType === "string" ? ` · ${formatValue(operation, "contractType", item.contractType)}` : "";
        const range = [date(item.startDate), date(item.endDate)].filter(Boolean).join(" đến ");
        const status = typeof item.status === "string" ? statuses[item.status] || formatValue(operation, "status", item.status) : "";
        return [`- ${employee}${kind}${range ? ` · ${range}` : ""}${status ? ` · ${status}` : ""}`];
      }),
      `Hợp đồng sắp hết hạn: ${Number.isSafeInteger(Number(result.expiryAlertTotal)) ? Number(result.expiryAlertTotal) : alerts.length}`,
      ...alerts.slice(0, 5).flatMap((value: unknown) => {
        const item = recordOf(value);
        if (!item || typeof item.employeeName !== "string") return [];
        const remaining = Number.isFinite(Number(item.daysRemaining)) ? ` · Còn ${Number(item.daysRemaining)} ngày` : "";
        return [`- ${item.employeeName}${typeof item.contractType === "string" ? ` · ${item.contractType}` : ""}${date(item.endDate) ? ` · Hết hạn ${date(item.endDate)}` : ""}${remaining}`];
      }),
      ...(total === 0 && alerts.length === 0 ? ["Hiện chưa có hợp đồng trong phạm vi đã chọn."] : []),
    ];
    return [operation.title, ...lines].join("\n");
  }
  if (operation.id === "api.get.b44c64519e939e0a") {
    const rows = Array.isArray(safeResult) ? safeResult : collection(safeResult) || [];
    if (rows.length === 0) return `${operation.title}\nHiện chưa có lịch sử gia hạn hợp đồng phù hợp.`;
    const date = (value: unknown) => {
      if (typeof value !== "string" && !(value instanceof Date)) return "";
      const parsed = new Date(value);
      return Number.isNaN(parsed.valueOf()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(parsed);
    };
    const shown = rows.slice(0, 8).flatMap((value: unknown) => {
      const item = recordOf(value);
      if (!item) return [];
      const employee = typeof item.employeeName === "string" ? item.employeeName : "Người lao động";
      const previous = date(item.previousEndDate);
      const current = date(item.newEndDate);
      const reason = typeof item.reason === "string" && item.reason.trim() ? ` · ${item.reason.trim().slice(0, 120)}` : "";
      return [`${employee}${previous || current ? ` · ${previous || "?"} → ${current || "?"}` : ""}${reason}`];
    });
    return [`Lịch sử gia hạn: ${rows.length}`, ...shown].join("\n");
  }
  if (operation.id === "api.get.a0937fb0c693e329") {
    const wrapped = recordOf(safeResult);
    const result = recordOf(wrapped?.data) || wrapped || {};
    const tasks = Array.isArray(result.overdueTasks) ? result.overdueTasks : [];
    const approvals = Array.isArray(result.pendingApprovals) ? result.pendingApprovals : [];
    const lowStock = Array.isArray(result.lowStockAlerts) ? result.lowStockAlerts : [];
    const lines = [
      `C\u00F4ng vi\u1EC7c qu\u00E1 h\u1EA1n: ${tasks.length}`,
      ...tasks.slice(0, 4).flatMap((value: unknown) => {
        const item = recordOf(value);
        if (!item || typeof item.title !== "string") return [];
        return [`- ${item.title}${typeof item.dueDate === "string" && item.dueDate ? ` \u00B7 H\u1EA1n: ${item.dueDate}` : ""}`];
      }),
      `Y\u00EAu c\u1EA7u ch\u1EDD duy\u1EC7t: ${approvals.length}`,
      ...approvals.slice(0, 4).flatMap((value: unknown) => {
        const item = recordOf(value);
        return item && typeof item.employeeName === "string" ? [`- Ngh\u1EC9 ph\u00E9p c\u1EE7a ${item.employeeName}`] : [];
      }),
      `C\u1EA3nh b\u00E1o t\u1ED3n kho: ${lowStock.length}`,
      ...lowStock.slice(0, 4).flatMap((value: unknown) => {
        const item = recordOf(value);
        if (!item || typeof item.name !== "string") return [];
        const sku = typeof item.sku === "string" && item.sku ? ` (${item.sku})` : "";
        const stock = Number.isFinite(Number(item.stock)) ? ` \u00B7 C\u00F2n ${new Intl.NumberFormat("vi-VN").format(Number(item.stock))}` : "";
        return [`- ${item.name}${sku}${stock}`];
      }),
      ...(tasks.length + approvals.length + lowStock.length === 0 ? ["Hi\u1EC7n ch\u01B0a c\u00F3 vi\u1EC7c n\u00E0o c\u1EA7n x\u1EED l\u00FD."] : []),
    ];
    return [operation.title, ...lines].join("\n");
  }
  if (operation.id === "worker.create") {
    const wrapper = recordOf(safeResult);
    const created = recordOf(wrapper?.worker) || recordOf(recordOf(wrapper?.data)?.worker) || recordOf(wrapper?.data)
      || (wrapper && operation.resultFields.some(key => Object.hasOwn(wrapper, key)) ? wrapper : null);
    const summary = created ? formatRecord(operation, created) : "";
    return summary ? `${operation.title}\n${summary}` : `${operation.title} đã hoàn tất.`;
  }
  if (operation.id === "company-email.celebration.preview") {
    const wrapped = recordOf(safeResult);
    const result = recordOf(wrapped?.data) || wrapped || {};
    const subject = typeof result.subject === "string" ? result.subject.trim().slice(0, 300) : "";
    const body = celebrationHtmlToText(result.html);
    return [
      operation.title,
      ...(subject ? [`Ti\u00EAu \u0111\u1EC1: ${subject}`] : []),
      ...(body ? [`N\u1ED9i dung:\n${body}`] : []),
      "Ch\u1EC9 xem tr\u01B0\u1EDBc; ch\u01B0a l\u01B0u ho\u1EB7c g\u1EEDi email.",
    ].join("\n");
  }
  if (operation.id === "company-email.celebration.update") {
    const wrapped = recordOf(safeResult);
    const result = recordOf(wrapped?.data) || wrapped || {};
    const updatedFields = Array.isArray(result.updatedFields)
      ? result.updatedFields.filter((field): field is string => typeof field === "string").slice(0, 20)
      : [];
    return [
      operation.title,
      ...(updatedFields.length ? [`\u0110\u00E3 c\u1EADp nh\u1EADt: ${updatedFields.join(", ")}`] : ["\u0110\u00E3 l\u01B0u c\u00E0i \u0111\u1EB7t email ch\u00FAc m\u1EEBng."]),
    ].join("\n");
  }
  if (["access.role-permissions.list", "access.role-permissions.detail", "access.role-permissions.save"].includes(operation.id)) {
    const wrapped = recordOf(safeResult);
    const result = recordOf(wrapped?.data) || wrapped || {};
    const saved = operation.id === "access.role-permissions.save" ? recordOf(result.rolePermission) : null;
    const rows = operation.id === "access.role-permissions.list" ? collection(result) || [] : [];
    const permissionNames = new Map(PERMISSION_CATALOG.map(permission => [permission.code, permission.label]));
    const roleName = (role: Record<string, unknown>) => {
      const names: Record<string, string> = { admin: "Quản trị viên", branch_owner: "Chủ chi nhánh", manager: "Quản lý", user: "Nhân viên", teacher: "Giáo viên", pos_cashier: "Thu ngân" };
      return `${String(role.displayName || names[String(role.role)] || role.role || "Vai trò")}${role.role ? ` (${String(role.role)})` : ""}`;
    };
    const formatRole = (role: Record<string, unknown>, limit: number) => {
      const permissions = Array.isArray(role.permissions) ? role.permissions.filter((code): code is string => typeof code === "string") : [];
      const displayed = permissions.slice(0, limit).map(code => permissionNames.get(code) || code);
      return [
        `${roleName(role)} · cấp ${Number.isSafeInteger(role.level) ? role.level : "chưa đặt"} · ${permissions.length} quyền`,
        ...(displayed.length ? [`Quyền: ${displayed.join("; ")}`] : []),
        ...(permissions.length > displayed.length ? [`Còn ${permissions.length - displayed.length} quyền.`] : []),
      ].join("\n");
    };
    if (operation.id === "access.role-permissions.list") {
      const shown = rows.slice(0, 8).flatMap((value: unknown) => {
        const role = recordOf(value);
        return role ? [formatRole(role, 4).replace(/\n/g, " · ")] : [];
      });
      return [operation.title, `Số vai trò: ${rows.length}`, ...shown].join("\n");
    }
    if (operation.id === "access.role-permissions.save" && saved) {
      const effective = Array.isArray(result.effective) ? result.effective : saved.permissions;
      return formatRole({ ...saved, permissions: effective }, 30).replace(" · ", " đã được cập nhật · ");
    }
    return formatRole(result, 80);
  }
  if (operation.id === "student.learning-history") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isFinite(Number(result[key])) ? new Intl.NumberFormat("vi-VN").format(Number(result[key])) : "0";
    const rate = typeof result.attendanceRate === "number"
      ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(result.attendanceRate)}%`
      : "Chưa có dữ liệu";
    const courses = Array.isArray(result.courseNames) ? result.courseNames.filter((name: unknown) => typeof name === "string").slice(0, 10).join(", ") : "";
    return [
      operation.title,
      `Lớp: ${count("totalClasses")} · Khóa học: ${count("totalCourses")}`,
      `Buổi đã tham gia: ${count("totalAttendedSessions")} · Chuyên cần: ${rate}`,
      `Bài tập hoàn thành: ${count("completedAssignments")}/${count("totalAssignments")}`,
      `Bài kiểm tra: ${count("totalMiniTests")} · Kỳ thi: ${count("totalExams")}`,
      ...(courses ? [`Khóa học: ${courses}`] : []),
    ].join("\n");
  }
  if (operation.id === "payroll.period.line-overrides.list") {
    const rows = collection(safeResult) || [];
    const fieldLabels: Record<string, string> = {
      baseSalary: "Lương cơ bản", adjustedBase: "Lương theo công", overtime: "Tăng ca", bonusTotal: "Tổng thưởng",
      penaltyTotal: "Tổng phạt", socialInsurance: "BHXH", healthInsurance: "BHYT", unemploymentInsurance: "BHTN",
      personalIncomeTax: "Thuế TNCN", otherDeductions: "Khấu trừ khác", advances: "Tạm ứng",
    };
    const money = (value: unknown) => Number.isFinite(value) ? `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫` : "";
    const items = rows.slice(0, 15).flatMap((item: any) => {
      if (!item || typeof item !== "object" || typeof item.employeeName !== "string") return [];
      const changes = Object.entries(fieldLabels).flatMap(([key, label]) => item[key] === undefined ? [] : [`${label}: ${money(item[key])}`]);
      if (item.customValues && typeof item.customValues === "object") {
        for (const [code, value] of Object.entries(item.customValues)) if (Number.isFinite(value)) changes.push(`${code}: ${new Intl.NumberFormat("vi-VN").format(Number(value))}`);
      }
      return [`${item.employeeName}${changes.length ? ` — ${changes.join(", ")}` : ""}${typeof item.reason === "string" && item.reason ? ` · Lý do: ${item.reason}` : ""}`];
    });
    return [operation.title, `Tìm thấy ${rows.length} nhân viên có khoản ghi đè.`, ...items].join("\n");
  }
  if (operation.id === "payroll.period.inputs.bulk") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isSafeInteger(Number(result[key])) && Number(result[key]) >= 0 ? Number(result[key]) : 0;
    const items = Array.isArray(result.items) ? result.items.slice(0, 20).flatMap((item: any) => {
      const name = typeof item?.employeeName === "string" ? item.employeeName : "Nhân viên";
      const status = typeof item?.status === "string" ? formatValue(operation, "status", item.status) : "Chưa rõ trạng thái";
      const fields = Array.isArray(item?.updatedFields) ? item.updatedFields.filter((field: unknown) => typeof field === "string").map((field: string) => labelFor(operation, field)).join(", ") : "";
      const detail = typeof item?.detail === "string" ? item.detail : "";
      return [`${name}: ${status}${fields ? ` (${fields})` : detail ? ` — ${detail}` : ""}`];
    }) : [];
    return [operation.title, `Đã cập nhật: ${count("updatedCount")} · Chưa cập nhật: ${count("failedCount")}`, ...items].join("\n");
  }
  if (operation.id === "payroll.period.line-overrides.bulk") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isSafeInteger(Number(result[key])) && Number(result[key]) >= 0 ? Number(result[key]) : 0;
    const items = Array.isArray(result.items) ? result.items.slice(0, 20).flatMap((item: any) => {
      const name = typeof item?.employeeName === "string" ? item.employeeName : "Nhân viên";
      const status = typeof item?.status === "string" ? formatValue(operation, "status", item.status) : "Chưa rõ trạng thái";
      const fields = Array.isArray(item?.updatedFields) ? item.updatedFields.filter((field: unknown) => typeof field === "string").map((field: string) => labelFor(operation, field)).join(", ") : "";
      const detail = typeof item?.detail === "string" ? item.detail : "";
      return [`${name}: ${status}${fields ? ` (${fields})` : detail ? ` — ${detail}` : ""}`];
    }) : [];
    return [operation.title, `Đã cập nhật: ${count("updatedCount")} · Chưa cập nhật: ${count("failedCount")}`, ...items].join("\n");
  }
  if (operation.id === "finance.reminders.run") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isSafeInteger(Number(result[key])) && Number(result[key]) >= 0 ? Number(result[key]) : 0;
    return [
      operation.title,
      `Khoản quá hạn đủ điều kiện: ${count("eligibleCount")}`,
      `Thông báo đã xếp hàng: ${count("queuedCount")} (chưa khẳng định đã gửi)`,
      `Bỏ qua: ${count("skippedCount")} · Lỗi: ${count("failedCount")} · Đã xử lý trước đó: ${count("duplicateCount")}`,
    ].join("\n");
  }
  if (operation.id === "finance.reminders.runs.detail") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isSafeInteger(Number(result[key])) && Number(result[key]) >= 0 ? Number(result[key]) : 0;
    const trigger = result.trigger === "manual" ? "Chạy thủ công" : result.trigger === "scheduled" ? "Theo lịch" : "";
    return [
      operation.title,
      ...(typeof result.date === "string" ? [`Ngày: ${formatValue(operation, "date", result.date)}`] : []),
      ...(trigger ? [`Nguồn khởi chạy: ${trigger}`] : []),
      ...(typeof result.status === "string" ? [`Trạng thái: ${formatValue(operation, "status", result.status)}`] : []),
      `Khoản quá hạn đủ điều kiện: ${count("eligibleCount")}`,
      `Thông báo đã xếp hàng: ${count("queuedCount")}`,
      `Kết quả gửi: ${count("deliverySentCount")} đã gửi · ${count("deliveryQueuedCount")} đang chờ · ${count("deliverySkippedCount")} bỏ qua · ${count("deliveryFailedCount")} lỗi`,
      `Bỏ qua lượt rà soát: ${count("skippedCount")} · Lỗi lượt rà soát: ${count("failedCount")} · Trùng lượt: ${count("duplicateCount")}`,
    ].join("\n");
  }
  if (operation.id === "retail.debt-reminders.run") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isSafeInteger(Number(result[key])) && Number(result[key]) >= 0 ? Number(result[key]) : 0;
    return [
      operation.title,
      ...(typeof result.businessDate === "string" ? [`Ngày kinh doanh: ${formatValue(operation, "businessDate", result.businessDate)}`] : []),
      ...(result.skipped === true ? ["Đã bỏ qua: cài đặt đang tắt hoặc chu kỳ này đã được chạy."] : [
        `Đơn quá hạn: ${count("overdueOrders")}`,
        `Người nhận: ${count("recipients")}`,
        `Thông báo tạo mới: ${count("created")}`,
        `Lượt trùng: ${count("duplicates")}`,
      ]),
    ].join("\n");
  }
  if (operation.id === "student.online-attendance.create-sessions") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isSafeInteger(Number(result[key])) && Number(result[key]) >= 0 ? Number(result[key]) : 0;
    return [
      operation.title,
      `Tổng số học viên: ${count("total")}`,
      `Email đã gửi: ${count("sent")}`,
      `Bỏ qua (chưa đăng ký khuôn mặt): ${count("skippedNotRegistered")}`,
      `Bỏ qua (chưa có email): ${count("skippedNoEmail")}`,
      `Lỗi gửi: ${count("failed")}`,
      "Mã chỉ có hiệu lực 5 phút. Không hiển thị mã hoặc địa chỉ email.",
    ].join("\n");
  }
  if (operation.id === "retail.debt-reminders.runs.list" || operation.id === "retail.debt-reminders.runs.detail") {
    const result = recordOf(safeResult) || {};
    const count = (key: string) => Number.isSafeInteger(Number(result[key])) && Number(result[key]) >= 0 ? Number(result[key]) : 0;
    const countFrom = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
    const statusLabels: Record<string, string> = { running: "Đang chạy", completed: "Đã hoàn tất", failed: "Lỗi" };
    if (operation.id === "retail.debt-reminders.runs.list") {
      const items = Array.isArray(result.items) ? result.items : [];
      const shown = items.slice(0, 8).map((value: unknown) => {
        const run = recordOf(value);
        if (!run) return "";
        return [
          typeof run.businessDate === "string" ? formatValue(operation, "businessDate", run.businessDate) : "",
          statusLabels[String(run.status)] || formatValue(operation, "status", run.status),
          `${countFrom(run.overdueOrders)} đơn quá hạn`,
          `${countFrom(run.failed)} lỗi`,
        ].filter(Boolean).join(" · ");
      }).filter(Boolean);
      return [operation.title, `Số lượt: ${items.length} / ${count("total")}`, ...shown].join("\n");
    }
    return [
      operation.title,
      ...(typeof result.businessDate === "string" ? [`Ngày kinh doanh: ${formatValue(operation, "businessDate", result.businessDate)}`] : []),
      ...(typeof result.status === "string" ? [`Trạng thái: ${statusLabels[result.status] || formatValue(operation, "status", result.status)}`] : []),
      `Đơn quá hạn: ${count("overdueOrders")} · Người nhận: ${count("recipients")}`,
      `Gửi thông báo: ${count("deliveryQueuedCount")} chờ · ${count("deliverySentCount")} đã gửi · ${count("deliveryFailedCount")} lỗi · ${count("deliveryDuplicateCount")} trùng`,
    ].join("\n");
  }
  if (["marketing.campaign.slot.reject", "marketing.campaign.slot.retry", "marketing.campaign.slot.approve", "marketing.campaign.slot.publish-now"].includes(operation.id)) {
    const result = recordOf(safeResult) || {};
    const timestamp = typeof result.scheduledAt === "string" ? new Date(result.scheduledAt) : null;
    const scheduledAt = timestamp && !Number.isNaN(timestamp.valueOf())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp)
      : "";
    const status = result.status === "needs_attention" ? "Cần kiểm tra"
      : operation.id === "marketing.campaign.slot.retry" && result.status === "planned" ? "Đã đưa vào hàng đợi thử lại"
      : operation.id === "marketing.campaign.slot.approve" && result.status === "ready_to_publish" ? "Đã duyệt, chờ hệ thống xử lý"
      : operation.id === "marketing.campaign.slot.publish-now" && result.status === "publishing" ? "Đang xử lý đăng ngay"
      : "Đã cập nhật";
    const mediaType = ({ text: "Văn bản", image: "Ảnh", video: "Video", "human-video": "Video người thật" } as Record<string, string>)[String(result.mediaType)] || "";
    return [
      operation.title,
      `Trạng thái: ${status}`,
      ...(scheduledAt ? [`Thời gian đăng: ${scheduledAt}`] : []),
      ...(typeof result.platform === "string" ? [`Kênh: ${result.platform}`] : []),
      ...(mediaType ? [`Loại nội dung: ${mediaType}`] : []),
    ].join("\n");
  }
  if (operation.id === "marketing.campaign.asset-order.ai.preview") {
    const result = recordOf(safeResult) || {};
    const fields: string[] = [];
    for (const key of ["headline", "subheadline", "cta", "visualBrief", "contentGroup", "shootingContent", "productionRequirements", "quantitySuggestion", "videoScript"]) {
      const value = result[key];
      if (typeof value === "string" && value.trim()) fields.push(`${labelFor(operation, key)}: ${formatValue(operation, key, value)}`);
    }
    if (result.format === "image" || result.format === "video") fields.push(`Định dạng: ${result.format === "video" ? "Video" : "Ảnh"}`);
    const warnings = Array.isArray(result.warnings)
      ? result.warnings.filter((warning: unknown): warning is string => typeof warning === "string" && Boolean(warning.trim())).slice(0, 5)
      : [];
    if (warnings.length) fields.push(`Lưu ý: ${warnings.join("; ")}`);
    return [
      operation.title,
      ...(typeof result.title === "string" && result.title.trim() ? [`Đơn hàng: ${result.title.trim().slice(0, 240)}`] : []),
      ...fields,
    ].join("\n");
  }
  if (operation.id === "marketing.ai.scheduled-campaign") {
    const result = recordOf(safeResult) || {};
    const pillars = Array.isArray(result.contentPillars)
      ? result.contentPillars.filter((item: unknown): item is string => typeof item === "string").slice(0, 6)
      : [];
    const slots = Array.isArray(result.slots) ? result.slots : [];
    const shown = slots.slice(0, 8).map((item: unknown) => {
      const slot = recordOf(item);
      if (!slot) return "";
      const date = typeof slot.scheduledDate === "string" ? formatValue(operation, "scheduledDate", slot.scheduledDate) : "";
      const time = typeof slot.scheduledTime === "string" ? slot.scheduledTime : "";
      const channel = typeof slot.channel === "string" ? formatValue(operation, "channel", slot.channel) : "";
      const pillar = typeof slot.pillar === "string" ? slot.pillar : "";
      const topic = typeof slot.topicBrief === "string" ? slot.topicBrief.trim().slice(0, 180) : "";
      return [`${date} ${time} · ${channel}`, pillar, topic].filter(Boolean).join(" — ");
    }).filter(Boolean);
    return [
      operation.title,
      ...(typeof result.campaignTitle === "string" && result.campaignTitle.trim() ? [`Chiến dịch: ${result.campaignTitle.trim().slice(0, 160)}`] : []),
      `Số lượt đăng: ${slots.length}`,
      ...(pillars.length ? [`Trụ cột: ${pillars.join(", ")}`] : []),
      ...(shown.length ? ["Các lượt đầu:", ...shown] : []),
      ...(slots.length > shown.length ? [`Còn ${slots.length - shown.length} lượt trong bản nháp.`] : []),
      "Bản nháp chưa được lưu hoặc lên lịch.",
    ].join("\n");
  }
  if (operation.id === "marketing.campaign.analytics.summary") {
    const wrapped = recordOf(safeResult);
    const result = recordOf(wrapped?.data) || wrapped || {};
    const overview = recordOf(result.overview) || {};
    const metrics = recordOf(result.platformMetrics) || {};
    const quality = recordOf(result.qualityScores) || {};
    const count = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= 0
      ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value))
      : "0";
    const percent = (value: unknown) => Number.isFinite(Number(value))
      ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value))}%`
      : "0%";
    const period = [result.startDate, result.endDate]
      .filter((value): value is string => typeof value === "string")
      .map(value => formatValue(operation, "date", value)).join(" – ");
    const platform = result.platform === "all" ? "Tất cả kênh" : typeof result.platform === "string" ? result.platform : "";
    const byPlatform = Array.isArray(result.byPlatform) ? result.byPlatform : [];
    const byDate = Array.isArray(result.byDate) ? result.byDate : [];
    const platformRows = byPlatform.slice(0, 2).flatMap((value: unknown) => {
      const row = recordOf(value);
      if (!row) return [];
      const label = typeof row.platform === "string" ? row.platform : "Kênh";
      return [`${label}: ${count(row.published)}/${count(row.total)} bài đã đăng, ${count(row.failed)} lỗi`];
    });
    const dailyRows = byDate.slice(0, 7).flatMap((value: unknown) => {
      const row = recordOf(value);
      if (!row || typeof row.date !== "string") return [];
      return [`${formatValue(operation, "date", row.date)}: ${count(row.published)}/${count(row.planned)} bài đã đăng, ${count(row.likes)} lượt thích, ${count(row.views)} lượt xem`];
    });
    const engagement = [
      ["Lượt thích", metrics.totalLikes], ["Bình luận", metrics.totalComments], ["Chia sẻ", metrics.totalShares],
      ["Lượt xem", metrics.totalViews], ["Tiếp cận", metrics.totalReach], ["Nhấp", metrics.totalClicks],
    ].filter(([, value]) => value !== undefined).map(([label, value]) => `${label}: ${count(value)}`);
    return [
      operation.title,
      ...(typeof result.campaignTitle === "string" && result.campaignTitle.trim() ? [`Chiến dịch: ${result.campaignTitle.trim().slice(0, 160)}`] : []),
      ...(period ? [`Thời gian: ${period}`] : []),
      ...(platform ? [`Kênh lọc: ${platform}`] : []),
      `Bài đăng: ${count(overview.publishedSlots)}/${count(overview.totalSlots)} đã đăng · ${count(overview.failedSlots)} lỗi · ${count(overview.pendingApprovalSlots)} chờ duyệt`,
      `Tỷ lệ đăng thành công: ${percent(overview.successRate)}`,
      ...(engagement.length ? [`Tương tác: ${engagement.join(" · ")}`] : []),
      ...(platformRows.length ? ["Theo kênh:", ...platformRows] : []),
      ...(dailyRows.length ? ["Theo ngày:", ...dailyRows] : []),
      ...(byDate.length > dailyRows.length ? [`Còn ${byDate.length - dailyRows.length} ngày trong báo cáo.`] : []),
      ...(quality.avgScore !== undefined ? [`Điểm chất lượng nội dung trung bình: ${count(quality.avgScore)}/100`] : []),
    ].join("\n");
  }
  if (operation.id === "company-knowledge.test-search") {
    const result = recordOf(safeResult) || {};
    const answer = typeof result.simulatedAnswer === "string" ? result.simulatedAnswer.trim() : "";
    const safeAnswer = /^\[(?:lỗi|loi) sinh câu trả lời\]/i.test(answer)
      ? "Chưa tạo được câu trả lời mô phỏng. Hãy kiểm tra cấu hình AI rồi thử lại."
      : answer.slice(0, 1200);
    const items = Array.isArray(result.items) ? result.items : [];
    const sources = items.slice(0, 3).map((item: unknown) => {
      const source = recordOf(item);
      if (!source || typeof source.title !== "string" || !source.title.trim()) return "";
      const type = typeof source.documentType === "string" ? ` (${formatValue(operation, "documentType", source.documentType)})` : "";
      return `- ${source.title.trim().slice(0, 160)}${type}`;
    }).filter(Boolean);
    const lines = [
      operation.title,
      `Số đoạn phù hợp: ${Number.isFinite(Number(result.matches)) ? Math.max(0, Number(result.matches)) : 0}`,
      safeAnswer ? `Câu trả lời mô phỏng: ${safeAnswer}` : "Chưa có câu trả lời mô phỏng.",
      ...(sources.length ? ["Tài liệu khớp:", ...sources] : []),
    ];
    return lines.join("\n");
  }
  if (operation.id === "omni-inbox.ai-reply.test") {
    const result = recordOf(safeResult) || {};
    const text = typeof result.text === "string" ? result.text.trim().slice(0, 1200) : "";
    const mode = result.mode === "trained" ? "Đã dùng dữ liệu kho tri thức" : result.mode === "default" ? "Câu trả lời mặc định" : "";
    const matches = Number(result.contextMatches);
    return [
      operation.title,
      text ? `Câu trả lời thử: ${text}` : "Chưa tạo được câu trả lời thử.",
      ...(mode ? [`Nguồn: ${mode}`] : []),
      ...(Number.isSafeInteger(matches) && matches >= 0 ? [`Số đoạn tham khảo: ${matches}`] : []),
      ...(result.dryRun === true ? ["Chỉ xem trước. Không gửi tin cho khách."] : []),
    ].join("\n");
  }
  if (operation.id === "company-knowledge.page-chat.simulate") {
    const result = recordOf(safeResult) || {};
    const text = typeof result.text === "string" ? result.text.trim().slice(0, 1200) : "";
    const stage = typeof result.stage === "string" ? result.stage.trim().slice(0, 100) : "";
    const nextStep = typeof result.nextStep === "string" ? result.nextStep.trim().slice(0, 240) : "";
    const sources = Array.isArray(result.sources)
      ? result.sources.filter((source: unknown): source is string => typeof source === "string").slice(0, 5).map(source => source.slice(0, 120))
      : [];
    return [
      operation.title,
      text ? `Nội dung mô phỏng: ${text}` : "Chưa tạo được câu trả lời mô phỏng.",
      ...(stage ? [`Giai đoạn: ${stage}`] : []),
      ...(nextStep ? [`Bước tiếp theo: ${nextStep}`] : []),
      ...(sources.length ? [`Nguồn tham khảo: ${sources.join(", ")}`] : []),
    ].join("\n");
  }
  const dataRecord = recordOf(recordOf(safeResult)?.data);
  let normalizedResult = dataRecord && operation.resultFields.some(key => Object.hasOwn(dataRecord, key)) ? dataRecord : safeResult;
  // Detail endpoints may return a parent record with its SKU collection.
  // Render each SKU with public parent context instead of dropping children.
  if (operation.id === 'inventory.product.detail') {
    const parent = recordOf(normalizedResult);
    if (Array.isArray(parent?.variants) && parent.variants.length) {
      normalizedResult = parent.variants.flatMap(value => {
        const variant = recordOf(value);
        return variant ? [{ ...parent, ...variant, name: parent.name, productCode: parent.productCode }] : [];
      });
    }
  }
  const isWorkWorkflowRecord = ["hr.workflow.create", "hr.workflow.update"].includes(operation.id)
    && typeof recordOf(normalizedResult)?.name === "string";
  // A saved record can contain empty child collections (student payments, steps...).
  // Those collections are not the result set of the write operation.
  const isWrittenRecord = operation.method !== "GET" && recordOf(normalizedResult)
    && operation.resultFields.some(key => {
      // Draft business documents may not have a public code until posting.
      // Their line items must not replace the saved document in the result table.
      if (!["name", "fullName", "displayName", "title", "code", "sku", "orderCode", "invoiceCode", "transferCode", "grandTotal"].includes(key)) return false;
      const value = recordOf(normalizedResult)![key];
      return value != null && typeof value !== "object";
    });
  const rows = isWorkWorkflowRecord || isWrittenRecord ? null : collection(normalizedResult);
  const isStudentManagementLookup = operation.method === "GET"
    && /^(?:student\.|course\.|batch\.)/.test(operation.id);
  if (isStudentManagementLookup) {
    const records = rows || (recordOf(normalizedResult) ? [normalizedResult] : []);
    if (!records.length) return "Chưa có kết quả phù hợp trong phạm vi đang xem.";
    const tableRows = records.slice(0, 8).flatMap(value => {
      const record = recordOf(value);
      if (!record) return [];
      const row = operation.id === "student.quality.list"
        ? studentQualityResultRow(operation, record)
        : Object.fromEntries(operation.resultFields
          .filter(key => Object.hasOwn(record, key) && record[key] !== null && record[key] !== undefined && record[key] !== "")
          .map(key => [labelFor(operation, key), formatValue(operation, key, record[key])]));
      if (operation.id === "student.list" && operation.resultFields.includes("fee") && operation.resultFields.includes("paidAmount")) {
        const remaining = remainingTuition(record);
        if (remaining !== null) row["C\u00F2n ph\u1EA3i \u0111\u00F3ng"] = `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(remaining)} \u20AB`;
      }
      return Object.keys(row).length ? [row] : [];
    });
    if (!tableRows.length) return "Chưa có thông tin phù hợp để hiển thị trong bảng.";
    const count = rows?.length ?? tableRows.length;
    return formatAssistantResultTable(
      `Mình tìm thấy ${count} kết quả phù hợp cho bạn.`,
      tableRows,
      count > tableRows.length ? [`Còn ${count - tableRows.length} kết quả chưa hiển thị.`] : [],
    );
  }
  if (rows) {
    if (rows.length === 0) return `${operation.title}\nKhông có kết quả phù hợp.`;
    const tableRows = rows.slice(0, 8).flatMap(row => {
      const fields = formatRecordTableRow(operation, row);
      if (Object.keys(fields).length) return [fields];
      const fallback = formatRecord(operation, row).replace(/\s*\n\s*/g, " · ").trim();
      return fallback ? [{ "Thông tin": fallback }] : [];
    });
    if (tableRows.length === 0) return `${operation.title} · ${rows.length} kết quả. Mở phân hệ để xem chi tiết.`;
    const count = rows.length;
    return formatAssistantResultTable(
      `Mình tìm thấy ${count} kết quả phù hợp cho bạn.`,
      tableRows,
      count > tableRows.length ? [`Còn ${count - tableRows.length} kết quả chưa hiển thị.`] : [],
    );
  }
  const summary = formatRecord(operation, normalizedResult);
  const tableFields = formatRecordTableRow(operation, normalizedResult);
  if (Object.keys(tableFields).length) {
    const success = operation.method === "GET" || operation.readOnly
      ? "Mình tìm thấy 1 kết quả phù hợp cho bạn."
      : assistantCompletedOperationSummary(operation.title);
    return formatAssistantResultTable(success, [tableFields]);
  }
  return summary
    ? `${operation.title}\n${summary}`
    : `${operation.title} đã hoàn tất. Mở phân hệ để xem chi tiết.`;
}

/** Add a natural Vietnamese conversational frame to the already-filtered result. */
export function formatFriendlyAssistantResult(operation: ResultOperation & { method?: string }, input: unknown): string {
  const workerTable = workerManagementTableResult(operation, input);
  if (workerTable) return workerTable;
  const formatted = formatAssistantResult(operation, input);
  if (["student.bulk.preview", "student.bulk.create"].includes(operation.id)) return formatted;
  if (parseAssistantResultTable(formatted)) return formatted;
  const lines = formatted.split("\n");
  const firstLine = lines[0] || "";
  const listMatch = firstLine.match(/·\s*(\d+)\s+kết quả/i);
  let details = formatted;

  if (operation.id === "worker.partner.kpi.set") {
    const kpiDetails = formatLaborPartnerKpi(input);
    if (kpiDetails) return kpiDetails;
  }

  if (["/worker-management/partners/policies", "/worker-management/partners/policies/:policyId"].includes(operation.path || "")) {
    const policyDetails = formatLaborPartnerPolicy(operation, input);
    if (policyDetails) {
      if (operation.method === "GET") return policyDetails;
      const action = operation.title.charAt(0).toLocaleLowerCase("vi") + operation.title.slice(1);
      return `Mình đã ${action}.\n${policyDetails}`;
    }
  }

  if (firstLine === operation.title) {
    details = lines.slice(1).join("\n").trim();
  } else if (firstLine.startsWith(`${operation.title} ·`)) {
    details = [firstLine.slice(operation.title.length).replace(/^\s*[·:]\s*/, ""), ...lines.slice(1)]
      .filter(Boolean).join("\n").trim();
  } else if (firstLine.startsWith(`${operation.title} `)) {
    details = [firstLine.slice(operation.title.length).trim(), ...lines.slice(1)]
      .filter(Boolean).join("\n").trim();
  }

  if (operation.id === "employee.detail" && operation.method === "GET") {
    const rows = collection(redactAssistantResult(input)) || [];
    if (!rows.length) return "Mình chưa tìm thấy hồ sơ nhân sự phù hợp. Bạn kiểm tra lại tên, email hoặc số điện thoại giúp mình nhé.";
    const records = rows.slice(0, 8).map(recordOf).filter((record): record is ResultRecord => Boolean(record));
    if (records.length === 1) {
      const record = records[0];
      const fields = operation.resultFields
        .filter(key => Object.hasOwn(record, key) && record[key] !== null && record[key] !== undefined && record[key] !== "")
        .map(key => `${labelFor(operation, key)}: ${formatValue(operation, key, record[key])}`);
      return [`Mình tìm thấy hồ sơ của ${String(record.displayName || "nhân sự này")}:`, ...fields].join("\n");
    }
    const options = records.map((record, index) => {
      const name = String(record.displayName || "Chưa có tên");
      const department = typeof record.department === "string" && record.department.trim() ? ` · Phòng ban: ${record.department}` : "";
      const division = typeof record.division === "string" && record.division.trim() ? ` · Bộ phận: ${record.division}` : "";
      return `${index + 1}. ${name}${department}${division}`;
    });
    if (rows.length > records.length) options.push(`Còn ${rows.length - records.length} kết quả khác.`);
    return [`Mình tìm thấy ${rows.length} hồ sơ phù hợp. Bạn cho mình biết họ tên đầy đủ hoặc phòng ban để chọn đúng người nhé.`, ...options].join("\n");
  }

  if (operation.id === "recruitment.job.detail" && operation.method === "GET") {
    const response = recordOf(redactAssistantResult(input));
    const job = recordOf(response?.data) || response;
    if (job) {
      const textValue = (key: string) => typeof job[key] === "string" ? String(job[key]).trim() : "";
      const missingToOpen: string[] = [];
      if (!textValue("title")) missingToOpen.push("Tiêu đề");
      if (!textValue("description")) missingToOpen.push("Mô tả công việc");
      if (!textValue("requirements")) missingToOpen.push("Yêu cầu ứng viên");
      if (!Number.isFinite(Number(job.headcount)) || Number(job.headcount) <= 0) missingToOpen.push("Số lượng tuyển");
      if (!textValue("workplaceType")) missingToOpen.push("Hình thức làm việc");
      if (!textValue("location")) missingToOpen.push("Địa điểm làm việc");
      const deadline = job.applicationDeadline ? new Date(String(job.applicationDeadline)) : null;
      if (!deadline || Number.isNaN(deadline.valueOf()) || deadline <= new Date()) missingToOpen.push("Hạn nhận hồ sơ trong tương lai");

      const optionalMissing: string[] = [];
      if (!textValue("department")) optionalMissing.push("Phòng ban");
      if (!textValue("benefits")) optionalMissing.push("Quyền lợi");
      if (job.salaryMin == null && job.salaryMax == null) optionalMissing.push("Khoảng lương");
      const title = textValue("title");
      const code = textValue("code");
      return [
        `Mình đã kiểm tra${title ? ` vị trí “${title}”` : " vị trí tuyển dụng này"} giúp bạn rồi nhé.`,
        code ? `Mã vị trí tuyển dụng: ${code}` : "",
        typeof job.status === "string" ? `Trạng thái: ${formatValue(operation, "status", job.status)}` : "",
        missingToOpen.length
          ? `Để mở tuyển, còn thiếu: ${missingToOpen.join(", ")}.`
          : "Tin tuyển dụng đã đủ thông tin bắt buộc để mở tuyển.",
        optionalMissing.length ? `Có thể bổ sung thêm (không bắt buộc để mở tuyển): ${optionalMissing.join(", ")}.` : "",
      ].filter(Boolean).join("\n");
    }
  }

  if (operation.path === "/inventory/catalog/products" && operation.method === "POST") {
    const record = recordOf(redactAssistantResult(input));
    const name = typeof record?.name === "string" ? record.name : "sản phẩm";
    const productCode = typeof record?.productCode === "string" ? record.productCode : "";
    const firstVariant = Array.isArray(record?.variants) ? record.variants.map(recordOf).find(Boolean) : null;
    const sku = typeof firstVariant?.sku === "string" ? firstVariant.sku : "";
    return [
      `Xong rồi bạn nhé, mình đã tạo sản phẩm ${name}.`,
      productCode ? `Mã sản phẩm: ${productCode}` : "",
      sku ? `SKU đầu tiên: ${sku}` : "",
    ].filter(Boolean).join("\n");
  }

  if (operation.method === "GET") {
    if (formatted.includes("Không có kết quả phù hợp.")) {
      return "Chưa có kết quả phù hợp trong phạm vi đang xem. Bạn có thể thử tên hoặc mã khác, hay chọn lại phạm vi cần tìm.";
    }
    if (listMatch) {
      const total = Number(listMatch[1]);
      const shown = firstLine.match(/hiển thị\s+(\d+)/i);
      const opening = total === 1
        ? "Mình tìm thấy một kết quả phù hợp cho bạn."
        : `Mình tìm thấy ${new Intl.NumberFormat("vi-VN").format(total)} kết quả phù hợp cho bạn.`;
      const note = shown && Number(shown[1]) < total
        ? ` Mình liệt kê ${shown[1]} mục đầu tiên bên dưới nhé.`
        : "";
      return [opening + note, lines.slice(1).join("\n").trim()].filter(Boolean).join("\n");
    }
    return details || "Mình chưa có thông tin chi tiết để hiển thị.";
  }

  const summary = assistantCompletedOperationSummary(operation.title);
  return details ? `${summary}\n${details}` : summary;
}
