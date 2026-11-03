import { operationById, type AssistantOperation } from "./catalog";
import { redactAssistantResult } from "./structured-data";
import { PERMISSION_CATALOG } from "../config/permission-catalog";

type ResultOperation = Pick<AssistantOperation, "id" | "title" | "fields" | "resultFields">;
type ResultRecord = Record<string, unknown>;

const collectionKeys = ["items", "records", "results", "rows", "transactions", "vouchers", "workers", "partners", "students", "assets", "campaigns", "data"];
const moneyKey = /(?:amount|salary|price|cost|paid|due|remaining|refund|total|tuition|fee|bookValue|depreciation|grossPay|grossProfit|deductions|netPay|cashNet|bankNet|expectedCash|countedCash|balance)/i;
const bulkCreateJobOperationIds = ["marketing.bulk-create.jobs.list", "marketing.bulk-create.jobs.detail", "marketing.bulk-create.jobs.cancel", "marketing.bulk-create.jobs.retry"];
const bulkCreateTemplateOperationIds = ["marketing.bulk-create.templates.list", "marketing.bulk-create.templates.detail"];
const labels: Record<string, string> = {
  address: "Địa chỉ", adjustment: "Điều chỉnh", adjustments: "Điều chỉnh", amount: "Số tiền", actorType: "Người thực hiện", bankAccountName: "Chủ tài khoản", baseRevision: "Phiên bản nền",
  bankAccountNo: "Số tài khoản ngân hàng", bankName: "Tên ngân hàng", branchName: "Chi nhánh",
  code: "Mã", countCode: "Mã phiếu kiểm kê", customerName: "Khách hàng", date: "Ngày", deliveredAt: "Ngày bàn giao", description: "Mô tả",
  device: "Thiết bị", dueAmount: "Còn phải trả", dueDate: "Hạn hoàn thành", email: "Email", endDate: "Ngày kết thúc", financeVoucherCode: "Mã phiếu chi", fullName: "Họ và tên",
  commissionRate: "Tỷ lệ hoa hồng", commissionType: "Hình thức hoa hồng", commissionValue: "Mức hoa hồng", isActive: "Đang hoạt động", item: "Thông tin giao dịch", kind: "Loại giao dịch", lines: "Hạng mục", maxStock: "Tồn tối đa", minStock: "Tồn tối thiểu", minTuition: "Doanh số tối thiểu", message: "Thông báo",
  accessoryBps: "Hoa hồng phụ kiện", account: "Tài khoản chi", businessDate: "Ngày giao dịch", effectiveAt: "Ngày áp dụng", effectiveFrom: "Ngày áp dụng từ", phoneAmount: "Hoa hồng mỗi điện thoại", ratePercent: "Tỷ lệ hoa hồng", reference: "Mã giao dịch", repairBps: "Hoa hồng công sửa chữa", sellingPrice: "Giá bán", costPrice: "Giá vốn", productCode: "Mã sản phẩm", productType: "Loại sản phẩm", categoryCode: "Mã danh mục", variant: "SKU", variants: "Các SKU", trackingMode: "Theo dõi tồn theo",
  assetCode: "Mã tài sản", assetName: "Tài sản", barcode: "Mã vạch", group: "Nhóm tài sản", originalCost: "Nguyên giá", salvageValue: "Giá trị thanh lý", accumulatedDepreciation: "Khấu hao lũy kế", netBookValue: "Giá trị còn lại", usefulLifeMonths: "Thời gian sử dụng (tháng)", inServiceDate: "Ngày đưa vào sử dụng", disposalAmount: "Tiền thu hồi khi thanh lý", disposalReason: "Lý do thanh lý", accumulatedAfter: "Khấu hao lũy kế sau kỳ", netBookValueAfter: "Giá trị còn lại sau kỳ", custodianName: "Người quản lý", supplierName: "Nhà cung cấp", department: "Bộ phận", location: "Vị trí", period: "Kỳ", sessionCode: "Mã phiên kiểm kê", scope: "Phạm vi kiểm kê", total: "Tổng tài sản", counts: "Số lượng theo kết quả", variances: "Chênh lệch kiểm kê", grossPay: "Tổng thu nhập",
  laborType: "Loại lao động", name: "Tên", legalName: "Pháp nhân xuất hóa đơn", taxId: "Mã số thuế", invoiceEmail: "Email nhận hóa đơn", contactName: "Người liên hệ", isDefault: "Hồ sơ mặc định", warnings: "Lưu ý", netCollected: "Thực thu", note: "Ghi chú", occurredAt: "Thời điểm", occurredOn: "Ngày",
  outcome: "Kết quả quét", paidAmount: "Đã thanh toán", parentCode: "Mã đơn liên quan", payments: "Thanh toán", phone: "Điện thoại",
  productName: "Sản phẩm", quantity: "Số lượng", refundedAmount: "Đã hoàn tiền", refunds: "Hoàn tiền", startDate: "Ngày bắt đầu", postsPerDay: "Số bài mỗi ngày",
  remaining: "Còn có thể hoàn", remainingLabor: "Còn có thể hoàn tiền công", remainingOther: "Còn có thể hoàn khoản khác",
  reservedQuantity: "Đã giữ chỗ", sku: "SKU", startAt: "Thời gian bắt đầu", status: "Trạng thái", summary: "Tóm tắt",
  question: "Câu hỏi", ticketCode: "Mã phiếu sửa chữa", title: "Tiêu đề", totalAmount: "Tổng tiền", unitCode: "Đơn vị", variantName: "Biến thể",
  warehouseName: "Kho", workerName: "Nhân sự",
};

Object.assign(labels, { entityPreset: "Loại hồ sơ", isRequired: "Bắt buộc", isVisible: "Đang hiển thị", isArchived: "Đã lưu trữ", placeholder: "Gợi ý nhập" });
Object.assign(labels, { registrationDate: "Ngày đăng ký", fee: "Học phí", isGroup: "Phòng nhóm" });
Object.assign(labels, { contentGroup: "Nhóm nội dung", shootingContent: "Nội dung cần quay/chụp", productionRequirements: "Yêu cầu sản xuất", quantitySuggestion: "Số lượng đề xuất", headline: "Tiêu đề hiển thị", subheadline: "Mô tả ngắn", cta: "Lời kêu gọi hành động", visualBrief: "Mô tả hình ảnh", videoScript: "Kịch bản video", format: "Định dạng", revision: "Phiên bản", warnings: "Lưu ý" });
Object.assign(labels, { operation: "Loại thao tác", totalItems: "Tổng số mục", completedItems: "Đã xong", failedItems: "Lỗi", skippedItems: "Bỏ qua", conflictedItems: "Xung đột", progress: "Tiến độ" });
Object.assign(labels, { grossPay: "Tổng thu nhập", deductions: "Khấu trừ" });
Object.assign(labels, { receivableCode: "Mã khoản phải thu", sourceCode: "Mã chứng từ nguồn", sourceType: "Loại nguồn", dueDate: "Hạn thu", originalAmount: "Số tiền ban đầu", adjustedAmount: "Điều chỉnh", balance: "Số dư còn lại", daysOverdue: "Số ngày quá hạn", daysUntilDue: "Số ngày đến hạn", bucket: "Nhóm tuổi nợ", alert: "Cảnh báo", reminderCount: "Số lần nhắc", paymentMethod: "Phương thức thu", direction: "Chiều công nợ", partyName: "Đối tượng", partyKind: "Loại đối tượng", shiftCode: "Mã ca POS", cashierName: "Nhân viên thu ngân", paymentIndex: "Khoản thu số", paymentAmount: "Số tiền thu" });
Object.assign(labels, { type: "Loại bút toán", createdAt: "Ngày giao dịch", signedAmount: "Biến động số dư", runningBalance: "Số dư sau giao dịch" });
Object.assign(labels, { itemsSummary: "Sản phẩm", orderCode: "Mã đơn hàng" });
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
Object.assign(labels, { totalCount: "Tổng lượt gửi", sentCount: "Đã gửi", failedCount: "Gửi lỗi", pendingCount: "Đang chờ", skippedCount: "Đã bỏ qua" });
Object.assign(labels, { configured: "Đã cài đặt", birthdayEnabled: "Gửi email sinh nhật", holidayEnabled: "Gửi email ngày lễ", sendTime: "Giờ gửi", holidayOverridesCount: "Số ngày ngoại lệ" });

Object.assign(labels, { partnerName: "Đối tác", partnerCode: "Mã đối tác", periodStart: "Từ ngày", periodEnd: "Đến ngày", balanceAmount: "Còn lại", version: "Phiên bản" });
Object.assign(labels, { isDeleted: "Đã xóa mềm", headcount: "Số lượng tuyển", requirements: "Yêu cầu ứng viên", benefits: "Quyền lợi", employmentType: "Hình thức làm việc", workplaceType: "Nơi làm việc", applicationDeadline: "Hạn nhận hồ sơ", salaryMin: "Lương tối thiểu", salaryMax: "Lương tối đa", showSalary: "Hiển thị mức lương" });
Object.assign(labels, { effectiveTo: "Có hiệu lực đến", commissionScheme: "Cơ chế hoa hồng", confirmationSource: "Nguồn xác nhận", referredAt: "Ngày giới thiệu", employmentStartDate: "Ngày bắt đầu làm" });
Object.assign(labels, { account: "Tài khoản", direction: "Chiều thu chi", profitCategory: "Loại phiếu", cashNet: "Chênh lệch tiền mặt", bankNet: "Chênh lệch ngân hàng", count: "Số giao dịch", entries: "Khoản thu chi", shiftsReconciliation: "Đối soát ca", expectedCash: "Tiền mặt theo sổ", countedCash: "Tiền mặt đã đếm", varianceAmount: "Chênh lệch ca", balanced: "Khớp kỳ quỹ đã chốt", period: "Kỳ quỹ", reason: "Lý do" });

Object.assign(labels, { mode: "Ch\u1EBF \u0111\u1ED9 kho tri th\u1EE9c", documentsCount: "S\u1ED1 t\u00E0i li\u1EC7u", chunksCount: "S\u1ED1 m\u1EA3nh d\u1EEF li\u1EC7u", detectedTopics: "Ch\u1EE7 \u0111\u1EC1 \u0111\u00E3 nh\u1EADn di\u1EC7n", warnings: "C\u1EA3nh b\u00E1o", latestSyncAt: "\u0110\u1ED3ng b\u1ED9 g\u1EA7n nh\u1EA5t", cleared: "\u0110\u00E3 x\u00F3a to\u00E0n b\u1ED9 kho tri th\u1EE9c", campaignTopic: "Ch\u1EE7 \u0111\u1EC1", pillars: "Tr\u1EE5 c\u1ED9t n\u1ED9i dung", concepts: "\u00DD t\u01B0\u1EDFng", posts: "B\u1EA3n nh\u00E1p b\u00E0i \u0111\u0103ng", count: "S\u1ED1 k\u1EBFt qu\u1EA3", generatedByAi: "\u0110\u01B0\u1EE3c t\u1EA1o b\u1EB1ng AI" });

Object.assign(labels, { optimizedText: "Văn bản đã biên tập", subject: "Chủ thể", optimizedPrompt: "Prompt hình ảnh đã tối ưu", negativePrompt: "Nội dung cần tránh", suggestions: "Gợi ý chủ đề", feedbackUrl: "Liên kết đánh giá" });
Object.assign(labels, { found: "Đã tìm thấy thiết bị", serialNumber: "Số sê-ri/IMEI", soldAt: "Ngày bán", orderCode: "Mã đơn bán", customerCode: "Mã khách hàng", customerCovered: "Còn bảo hành khách hàng", customerWarrantyEndAt: "Hết bảo hành khách hàng", customerWarrantyDaysLeft: "Ngày bảo hành khách hàng còn lại", supplierCovered: "Còn bảo hành nhà cung cấp", supplierWarrantyEndAt: "Hết bảo hành nhà cung cấp", supplierWarrantyDaysLeft: "Ngày bảo hành nhà cung cấp còn lại", costBearer: "Bên chịu chi phí" });
Object.assign(labels, { sent: "Đã gửi", recipient: "Người nhận" });
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
Object.assign(labels, { windowMode: "Chế độ cửa sổ", enterToSend: "Enter để gửi", showSuggestions: "Hiện gợi ý", alwaysConfirm: "Luôn yêu cầu xác nhận", speakReplies: "Phát âm thanh câu trả lời" });

function labelFor(operation: ResultOperation, key: string): string {
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
  if (operation.id.startsWith("marketing.chat-flow.") && key === "goal") return "Mục tiêu workflow";
  if (operation.id.startsWith("marketing.chat-flow.") && key === "completionMessage") return "Lời nhắn sau khi thu thập đủ thông tin";
  if (operation.id.startsWith("marketing.chat-flow.") && key === "fields") return "Thông tin cần thu thập";
  if (operation.id.startsWith("marketing.chat-flow.") && key === "createdAt") return "Tạo lúc";
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
  return operation.fields.find(field => field.key === key)?.label
    || relatedCreate?.fields.find(field => field.key === key)?.label
    || labels[key]
    || key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, character => character.toLocaleUpperCase("vi"));
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

function formatValue(operation: ResultOperation, key: string, value: unknown, depth = 0): string {
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
    if (operation.id === "employee.detail" && key === "birthDate") {
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
    }
    if (operation.id === "student.list" && key === "fee" && /^\d+(?:\.\d+)?$/.test(value.trim())) {
      return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value))} \u20AB`;
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
    if (operation.id.startsWith("marketing.chat-flow.") && key === "status") return ({ draft: "Bản nháp", active: "Đang hoạt động", archived: "Đã lưu" } as Record<string, string>)[value] || value;
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
    const parsed = parseJsonText(value);
    if (parsed !== value && depth < 2) return formatValue(operation, key, redactAssistantResult(parsed), depth + 1);
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > 280 ? `${compact.slice(0, 277)}…` : compact;
  }
  if (depth >= 3) return "Có thông tin chi tiết";
  if (Array.isArray(value)) {
    if (value.length === 0) return "Không có";
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

function formatRecord(operation: ResultOperation, value: unknown): string {
  const record = recordOf(value);
  if (!record) return "";
  const populatedPartner = recordOf(record.partnerId);
  const displayRecord = (operation.id === "worker.partner.settlements.list" || operation.id === "worker.partner.worker-referral.list") && populatedPartner
    ? { ...record, partnerName: populatedPartner.name, partnerCode: populatedPartner.code }
    : record;
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
      const calendarAuditActions: Record<string, string> = { created: "Tạo", updated: "Cập nhật", synced: "Đồng bộ" };
      const reminderTriggers: Record<string, string> = { manual: "Chạy thủ công", scheduled: "Theo lịch" };
      const formatted = operation.id.startsWith("marketing.chat-flow.") && key === "fields" && Array.isArray(value)
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
            : formatValue(operation, key, value);
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

function collection(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  const record = recordOf(value);
  if (!record) return null;
  for (const key of collectionKeys) if (Array.isArray(record[key])) return record[key] as unknown[];
  return null;
}

/** Format only catalog-approved fields into a short, readable result for the conversation. */
export function formatAssistantResult(operation: ResultOperation, input: unknown): string {
  const redacted = redactAssistantResult(input);
  const recalculatedSettlement = operation.id === "worker.partner.settlement.recalculate" ? recordOf(recordOf(redacted)?.settlement) : null;
  const safeResult = recalculatedSettlement || redacted;
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
        const kind = typeof item.contractType === "string" ? ` · ${item.contractType}` : "";
        const range = [date(item.startDate), date(item.endDate)].filter(Boolean).join(" đến ");
        const status = typeof item.status === "string" ? statuses[item.status] || item.status : "";
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
    const created = recordOf(wrapper?.worker) || recordOf(recordOf(wrapper?.data)?.worker) || recordOf(wrapper?.data);
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
      const status = typeof item?.status === "string" ? item.status : "Chưa rõ trạng thái";
      const fields = Array.isArray(item?.updatedFields) ? item.updatedFields.filter((field: unknown) => typeof field === "string").join(", ") : "";
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
      const status = typeof item?.status === "string" ? item.status : "Chưa rõ trạng thái";
      const fields = Array.isArray(item?.updatedFields) ? item.updatedFields.filter((field: unknown) => typeof field === "string").join(", ") : "";
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
      ...(typeof result.date === "string" ? [`Ngày: ${result.date}`] : []),
      ...(trigger ? [`Nguồn khởi chạy: ${trigger}`] : []),
      ...(typeof result.status === "string" ? [`Trạng thái: ${result.status}`] : []),
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
      ...(typeof result.businessDate === "string" ? [`Ngày kinh doanh: ${result.businessDate}`] : []),
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
      "Mã chỉ có hiệu lực 5 phút; không hiển thị mã hoặc địa chỉ email.",
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
          typeof run.businessDate === "string" ? run.businessDate : "",
          statusLabels[String(run.status)] || "",
          `${countFrom(run.overdueOrders)} đơn quá hạn`,
          `${countFrom(run.failed)} lỗi`,
        ].filter(Boolean).join(" · ");
      }).filter(Boolean);
      return [operation.title, `Số lượt: ${items.length} / ${count("total")}`, ...shown].join("\n");
    }
    return [
      operation.title,
      ...(typeof result.businessDate === "string" ? [`Ngày kinh doanh: ${result.businessDate}`] : []),
      ...(typeof result.status === "string" ? [`Trạng thái: ${statusLabels[result.status] || result.status}`] : []),
      `Đơn quá hạn: ${count("overdueOrders")} · Người nhận: ${count("recipients")}`,
      `Delivery: ${count("deliveryQueuedCount")} chờ · ${count("deliverySentCount")} đã gửi · ${count("deliveryFailedCount")} lỗi · ${count("deliveryDuplicateCount")} trùng`,
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
      ...(typeof result.title === "string" && result.title.trim() ? [`Order: ${result.title.trim().slice(0, 240)}`] : []),
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
      const date = typeof slot.scheduledDate === "string" ? slot.scheduledDate : "";
      const time = typeof slot.scheduledTime === "string" ? slot.scheduledTime : "";
      const channel = typeof slot.channel === "string" ? slot.channel : "";
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
    const period = [result.startDate, result.endDate].filter((value): value is string => typeof value === "string").join(" – ");
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
      return [`${row.date}: ${count(row.published)}/${count(row.planned)} bài đã đăng, ${count(row.likes)} lượt thích, ${count(row.views)} lượt xem`];
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
      ? "Chưa tạo được câu trả lời mô phỏng; hãy kiểm tra cấu hình AI rồi thử lại."
      : answer.slice(0, 1200);
    const items = Array.isArray(result.items) ? result.items : [];
    const sources = items.slice(0, 3).map((item: unknown) => {
      const source = recordOf(item);
      if (!source || typeof source.title !== "string" || !source.title.trim()) return "";
      const type = typeof source.documentType === "string" ? ` (${source.documentType})` : "";
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
      ...(result.dryRun === true ? ["Chỉ xem trước; không gửi tin cho khách."] : []),
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
  const normalizedResult = dataRecord && operation.resultFields.some(key => Object.hasOwn(dataRecord, key)) ? dataRecord : safeResult;
  const rows = collection(normalizedResult);
  if (rows) {
    if (rows.length === 0) return `${operation.title}\nKhông có kết quả phù hợp.`;
    const displayed = rows.slice(0, 8).map((row, index) => {
      const summary = formatRecord(operation, row);
      return summary ? `${index + 1}. ${summary.replace(/\n/g, " · ")}` : "";
    }).filter(Boolean);
    if (displayed.length === 0) return `${operation.title} · ${rows.length} kết quả. Mở phân hệ để xem chi tiết.`;
    const count = rows.length > 8 ? ` (hiển thị ${displayed.length})` : "";
    return `${operation.title} · ${rows.length} kết quả${count}:\n${displayed.join("\n")}`;
  }
  const summary = formatRecord(operation, normalizedResult);
  return summary
    ? `${operation.title}\n${summary}`
    : `${operation.title} đã hoàn tất. Mở phân hệ để xem chi tiết.`;
}

/** Add a natural Vietnamese conversational frame to the already-filtered result. */
export function formatFriendlyAssistantResult(operation: ResultOperation & { method?: string }, input: unknown): string {
  const formatted = formatAssistantResult(operation, input);
  const lines = formatted.split("\n");
  const firstLine = lines[0] || "";
  const listMatch = firstLine.match(/·\s*(\d+)\s+kết quả/i);
  let details = formatted;

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

  if (operation.method === "GET") {
    if (formatted.includes("Không có kết quả phù hợp.")) {
      return "Mình kiểm tra rồi, hiện chưa thấy bản ghi nào phù hợp trong phạm vi dữ liệu đang xem. Bạn muốn tìm theo tên/mã cụ thể hoặc đổi chi nhánh không?";
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
    return details ? `Mình kiểm tra giúp bạn rồi nhé:\n${details}` : "Mình đã kiểm tra xong cho bạn rồi nhé.";
  }

  const action = operation.title.charAt(0).toLocaleLowerCase("vi") + operation.title.slice(1);
  return details
    ? `Xong rồi bạn nhé, mình đã ${action}.\n${details}`
    : `Xong rồi bạn nhé, mình đã ${action}.`;
}
