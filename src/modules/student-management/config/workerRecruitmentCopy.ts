import type { EntityPreset } from "./entityLabels";

export type CoursePageCopy = {
  pageTitle: string;
  addButton: string;
  searchPlaceholder: string;
  loadingMessage: string;
  emptyTitle: string;
  emptySubtitle: string;
  codeLabel: string;
  titleLabel: string;
  categoryLabel: string;
  durationLabel: string;
  feeLabel: string;
  capacityLabel: string;
  codePlaceholder: string;
  titlePlaceholder: string;
  durationPlaceholder: string;
  feePlaceholder: string;
  categoryManagerButton: string;
  categoryManagerTitle: string;
  categoryListTitle: string;
  categoryInputPlaceholder: string;
  deleteCategoryTitle: string;
  emptyCategory: string;
  deleteCategoryMessage: (name: string) => string;
  categoryCreatedMessage: string;
  categoryDeletedMessage: string;
  categoryCreateError: string;
  createModalTitle: string;
  editModalTitle: (code: string) => string;
  createSubmit: string;
  updateSubmit: string;
  creatingSubmit: string;
  updatingSubmit: string;
  paginationItemName: string;
  activeBatchUnit: string;
  tableTitleColumn: string;
  tableCapacityColumn: string;
  pauseTitle: string;
  resumeTitle: string;
  editTitle: string;
  deleteTitle: string;
  capacitySummary: (capacity: number | string) => string;
  tableCapacitySummary: (capacity: number | string, activeBatches: number) => string;
  createdMessage: (code: string) => string;
  updatedMessage: (code: string) => string;
  deletedMessage: (code: string) => string;
  statusMessage: (code: string, status: string) => string;
  createError: string;
  updateError: string;
  deleteError: string;
  feeValidationError: string;
};

const EDUCATION_COURSE_COPY: CoursePageCopy = {
  pageTitle: "Danh mục khóa học",
  addButton: "Thêm khóa học mới",
  searchPlaceholder: "Tìm theo tên hoặc mã khóa học...",
  loadingMessage: "Đang tải danh mục khóa học...",
  emptyTitle: "Chưa có khóa học nào",
  emptySubtitle: "Bấm 'Thêm khóa học mới' để khởi tạo chương trình đào tạo đầu tiên.",
  codeLabel: "Mã khóa học",
  titleLabel: "Tên chương trình đào tạo",
  categoryLabel: "Phân loại",
  durationLabel: "Số buổi học",
  feeLabel: "Học phí niêm yết",
  capacityLabel: "Tối đa học viên lớp",
  codePlaceholder: "Ví dụ: ENG-TOEIC",
  titlePlaceholder: "Ví dụ: Luyện thi TOEIC 650+ cam kết chuẩn đầu ra",
  durationPlaceholder: "Ví dụ: 12",
  feePlaceholder: "Ví dụ: 5.500.000",
  categoryManagerButton: "Quản lý phân loại",
  categoryManagerTitle: "Quản lý phân loại khóa học",
  categoryListTitle: "Danh sách phân loại hiện tại",
  categoryInputPlaceholder: "Nhập tên phân loại mới...",
  deleteCategoryTitle: "Xóa phân loại khóa học",
  emptyCategory: "Chưa có phân loại nào.",
  deleteCategoryMessage: (name) => `Bạn có chắc chắn muốn xóa phân loại "${name}" không? Hành động này không thể hoàn tác.`,
  categoryCreatedMessage: "Đã thêm phân loại mới thành công!",
  categoryDeletedMessage: "Đã xóa phân loại thành công.",
  categoryCreateError: "Có lỗi xảy ra khi tạo phân loại.",
  createModalTitle: "Thêm chương trình học mới",
  editModalTitle: (code) => `Chỉnh sửa chương trình học: ${code}`,
  createSubmit: "Khởi tạo chương trình",
  updateSubmit: "Cập nhật khóa học",
  creatingSubmit: "Đang khởi tạo...",
  updatingSubmit: "Đang cập nhật...",
  paginationItemName: "khóa học",
  activeBatchUnit: "lớp đang chạy",
  tableTitleColumn: "Tên khóa học",
  tableCapacityColumn: "Quy mô",
  pauseTitle: "Tạm dừng khóa học",
  resumeTitle: "Kích hoạt lại khóa học",
  editTitle: "Chỉnh sửa khóa học",
  deleteTitle: "Xóa khóa học",
  capacitySummary: (capacity) => `Max: ${capacity} HV`,
  tableCapacitySummary: (capacity, activeBatches) => `${capacity} HV (${activeBatches} lớp)`,
  createdMessage: (code) => `Đã thêm mới khóa học ${code} thành công!`,
  updatedMessage: (code) => `Đã cập nhật khóa học ${code} thành công!`,
  deletedMessage: (code) => `Đã xóa khóa học ${code}.`,
  statusMessage: (code, status) => `Khóa học ${code} đã chuyển sang "${status}".`,
  createError: "Có lỗi xảy ra khi tạo khóa học.",
  updateError: "Có lỗi xảy ra khi cập nhật khóa học.",
  deleteError: "Có lỗi xảy ra khi xóa khóa học.",
  feeValidationError: "Học phí phải là một số hợp lệ.",
};

const WORKER_PROJECT_COPY: CoursePageCopy = {
  ...EDUCATION_COURSE_COPY,
  pageTitle: "Danh sách dự án tuyển dụng",
  addButton: "Thêm dự án mới",
  searchPlaceholder: "Tìm theo tên hoặc mã dự án...",
  loadingMessage: "Đang tải danh sách dự án tuyển dụng...",
  emptyTitle: "Chưa có dự án tuyển dụng nào",
  emptySubtitle: 'Bấm "Thêm dự án mới" để tạo dự án tuyển dụng đầu tiên.',
  codeLabel: "Mã dự án",
  titleLabel: "Tên dự án tuyển dụng",
  categoryLabel: "Nhóm dự án",
  durationLabel: "Thời gian tuyển dụng",
  feeLabel: "Ngân sách dự kiến",
  capacityLabel: "Chỉ tiêu tuyển",
  codePlaceholder: "Ví dụ: DA-SAMSUNG-2026",
  titlePlaceholder: "Ví dụ: Tuyển 100 công nhân nhà máy Samsung",
  durationPlaceholder: "Ví dụ: 01/08/2026 - 30/09/2026",
  feePlaceholder: "Ví dụ: 150.000.000",
  categoryManagerButton: "Quản lý nhóm dự án",
  categoryManagerTitle: "Quản lý nhóm dự án",
  categoryListTitle: "Danh sách nhóm dự án hiện tại",
  categoryInputPlaceholder: "Nhập tên nhóm dự án mới...",
  deleteCategoryTitle: "Xóa nhóm dự án",
  emptyCategory: "Chưa có nhóm dự án nào.",
  deleteCategoryMessage: (name) => `Bạn có chắc chắn muốn xóa nhóm dự án "${name}" không? Hành động này không thể hoàn tác.`,
  categoryCreatedMessage: "Đã thêm nhóm dự án mới thành công!",
  categoryDeletedMessage: "Đã xóa nhóm dự án thành công.",
  categoryCreateError: "Có lỗi xảy ra khi tạo nhóm dự án.",
  createModalTitle: "Thêm dự án mới",
  editModalTitle: (code) => `Chỉnh sửa dự án: ${code}`,
  createSubmit: "Tạo dự án",
  updateSubmit: "Cập nhật dự án",
  creatingSubmit: "Đang tạo...",
  updatingSubmit: "Đang cập nhật...",
  paginationItemName: "dự án",
  activeBatchUnit: "đợt tuyển đang triển khai",
  tableTitleColumn: "Tên dự án",
  tableCapacityColumn: "Chỉ tiêu",
  pauseTitle: "Tạm dừng dự án",
  resumeTitle: "Tiếp tục dự án",
  editTitle: "Chỉnh sửa dự án",
  deleteTitle: "Xóa dự án",
  capacitySummary: (capacity) => `Chỉ tiêu: ${capacity} lao động`,
  tableCapacitySummary: (capacity, activeBatches) => `${capacity} lao động (${activeBatches} đợt tuyển)`,
  createdMessage: (code) => `Đã thêm mới dự án ${code} thành công!`,
  updatedMessage: (code) => `Đã cập nhật dự án ${code} thành công!`,
  deletedMessage: (code) => `Đã xóa dự án ${code}.`,
  statusMessage: (code, status) => `Dự án ${code} đã chuyển sang "${status}".`,
  createError: "Có lỗi xảy ra khi tạo dự án.",
  updateError: "Có lỗi xảy ra khi cập nhật dự án.",
  deleteError: "Có lỗi xảy ra khi xóa dự án.",
  feeValidationError: "Ngân sách dự kiến phải là một số hợp lệ.",
};

const CUSTOMER_SERVICE_COPY: CoursePageCopy = {
  ...EDUCATION_COURSE_COPY,
  pageTitle: "Danh mục dịch vụ",
  addButton: "Thêm dịch vụ mới",
  searchPlaceholder: "Tìm theo tên hoặc mã dịch vụ...",
  loadingMessage: "Đang tải danh mục dịch vụ...",
  emptyTitle: "Chưa có dịch vụ nào",
  emptySubtitle: 'Bấm "Thêm dịch vụ mới" để tạo dịch vụ đầu tiên.',
  codeLabel: "Mã dịch vụ",
  titleLabel: "Tên dịch vụ",
  categoryLabel: "Nhóm dịch vụ",
  durationLabel: "Thời gian cung cấp",
  feeLabel: "Giá dịch vụ",
  capacityLabel: "Số lượng khách hàng tối đa",
  codePlaceholder: "Ví dụ: DV-CHAM-SOC-01",
  titlePlaceholder: "Ví dụ: Gói chăm sóc khách hàng tiêu chuẩn",
  durationPlaceholder: "Ví dụ: 3 tháng / 12 tháng",
  feePlaceholder: "Ví dụ: 5.500.000",
  categoryManagerButton: "Quản lý nhóm dịch vụ",
  categoryManagerTitle: "Quản lý nhóm dịch vụ",
  categoryListTitle: "Danh sách nhóm dịch vụ hiện tại",
  categoryInputPlaceholder: "Nhập tên nhóm dịch vụ mới...",
  deleteCategoryTitle: "Xóa nhóm dịch vụ",
  emptyCategory: "Chưa có nhóm dịch vụ nào.",
  deleteCategoryMessage: (name) => `Bạn có chắc chắn muốn xóa nhóm dịch vụ "${name}" không? Hành động này không thể hoàn tác.`,
  categoryCreatedMessage: "Đã thêm nhóm dịch vụ mới thành công!",
  categoryDeletedMessage: "Đã xóa nhóm dịch vụ thành công.",
  categoryCreateError: "Có lỗi xảy ra khi tạo nhóm dịch vụ.",
  createModalTitle: "Thêm dịch vụ mới",
  editModalTitle: (code) => `Chỉnh sửa dịch vụ: ${code}`,
  createSubmit: "Tạo dịch vụ",
  updateSubmit: "Cập nhật dịch vụ",
  creatingSubmit: "Đang tạo...",
  paginationItemName: "dịch vụ",
  activeBatchUnit: "hợp đồng đang thực hiện",
  tableTitleColumn: "Tên dịch vụ",
  tableCapacityColumn: "Quy mô phục vụ",
  pauseTitle: "Tạm dừng dịch vụ",
  resumeTitle: "Kích hoạt lại dịch vụ",
  editTitle: "Chỉnh sửa dịch vụ",
  deleteTitle: "Xóa dịch vụ",
  capacitySummary: (capacity) => `Tối đa: ${capacity} khách hàng`,
  tableCapacitySummary: (capacity, activeBatches) => `${capacity} khách hàng (${activeBatches} hợp đồng)`,
  createdMessage: (code) => `Đã thêm mới dịch vụ ${code} thành công!`,
  updatedMessage: (code) => `Đã cập nhật dịch vụ ${code} thành công!`,
  deletedMessage: (code) => `Đã xóa dịch vụ ${code}.`,
  statusMessage: (code, status) => `Dịch vụ ${code} đã chuyển sang "${status}".`,
  createError: "Có lỗi xảy ra khi tạo dịch vụ.",
  updateError: "Có lỗi xảy ra khi cập nhật dịch vụ.",
  deleteError: "Có lỗi xảy ra khi xóa dịch vụ.",
  feeValidationError: "Giá dịch vụ phải là một số hợp lệ.",
};

export function getCoursePageCopy(preset: EntityPreset): CoursePageCopy {
  if (preset === "worker") return WORKER_PROJECT_COPY;
  if (preset === "customer") return CUSTOMER_SERVICE_COPY;
  return EDUCATION_COURSE_COPY;
}

export function getStudentManagementSubTabLabel(
  preset: EntityPreset,
  slug: string,
  fallback: string,
): string {
  if (preset === "worker" && slug === "khoa-hoc") return "Dự án";
  if (preset === "worker" && slug === "lop-hoc") return "Dự án";
  if (preset === "customer" && slug === "khoa-hoc") return "Dịch vụ";
  return fallback;
}

export type BatchPageCopy = {
  entityName: string;
  entityNameLower: string;
  pageTitle: string;
  createButton: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptySubtitle: string;
  codeLabel: string;
  courseLabel: string;
  instructorLabel: string;
  capacityLabel: string;
  createTitle: string;
  editTitle: string;
  createSubmit: string;
};

export function getBatchPageCopy(preset: EntityPreset): BatchPageCopy {
  if (preset === "worker") {
    return {
      entityName: "Dự án",
      entityNameLower: "dự án",
      pageTitle: "Dự án tuyển dụng",
      createButton: "Thêm dự án",
      searchPlaceholder: "Tìm theo mã dự án, vị trí, người phụ trách...",
      emptyTitle: "Chưa có dự án nào",
      emptySubtitle: "Bấm 'Thêm dự án' để khởi tạo dự án tuyển dụng đầu tiên.",
      codeLabel: "Mã dự án",
      courseLabel: "Tên dự án",
      instructorLabel: "Người phụ trách",
      capacityLabel: "Chỉ tiêu",
      createTitle: "Thêm dự án",
      editTitle: "Chỉnh sửa dự án",
      createSubmit: "Tạo dự án",
    };
  }
  return {
    entityName: "Lớp",
    entityNameLower: "lớp",
    pageTitle: "Lớp & Khai giảng",
    createButton: "Mở lớp mới",
    searchPlaceholder: "Tìm theo mã lớp, khóa học, giảng viên...",
    emptyTitle: "Chưa có lớp nào",
    emptySubtitle: "Bấm 'Mở lớp mới' để khai giảng lớp đầu tiên cho một khóa học.",
    codeLabel: "Mã lớp",
    courseLabel: "Khóa học",
    instructorLabel: "Giảng viên",
    capacityLabel: "Sĩ số",
    createTitle: "Mở lớp mới",
    editTitle: "Chỉnh sửa lớp học",
    createSubmit: "Khai giảng lớp",
  };
}

export function getBatchStatusLabel(preset: EntityPreset, status: string): string {
  if (preset !== "worker") return status;
  return {
    "Sắp khai giảng": "Sắp triển khai",
    "Đang học": "Đang triển khai",
    "Đã kết thúc": "Đã kết thúc",
  }[status] ?? status;
}

export type WorkerOperationalCopy = {
  isWorker: boolean;
  isCustomer: boolean;
  unassignedGroupLabel: string;
  registrationStatusLabels: Record<string, string>;
  exportFilePrefix: string;
  printTitle: string;
  printFooter: string;
  partnerReferralCountLabel: string;
  partnerReferralValueLabel: string;
  partnerReferralUnit: string;
  partnerValueLabel: string;
  notificationAudienceLabel: string;
  notificationSubtitle: string;
  settingsSavedMessage: string;
  settingsMailDescription: string;
};

const EDUCATION_OPERATIONAL_COPY: WorkerOperationalCopy = {
  isWorker: false,
  isCustomer: false,
  unassignedGroupLabel: "Chưa xếp lớp",
  registrationStatusLabels: {},
  exportFilePrefix: "danh_sach_hoc_vien",
  printTitle: "DANH SÁCH HỌC VIÊN",
  printFooter: "Hệ thống Quản lý Đào tạo & Học viên iGen",
  partnerReferralCountLabel: "Số học viên giới thiệu",
  partnerReferralValueLabel: "Tổng học phí giới thiệu",
  partnerReferralUnit: "học viên",
  partnerValueLabel: "Học phí",
  notificationAudienceLabel: "Tất cả học viên đang học",
  notificationSubtitle: "Gửi thông báo tự động đến học viên",
  settingsSavedMessage: "Cấu hình form học viên đã được lưu thành công!",
  settingsMailDescription: "Kết nối tài khoản Gmail của bạn để tự động gửi thông báo lớp học, lịch học cho giảng viên và học viên.",
};

const WORKER_OPERATIONAL_COPY: WorkerOperationalCopy = {
  isWorker: true,
  isCustomer: false,
  unassignedGroupLabel: "Chưa vào dự án",
  registrationStatusLabels: {
    "Đang học": "Đang tuyển",
    "Đang thi": "Đang phỏng vấn",
    "Đã đậu": "Đã trúng tuyển",
    "Thi lại": "Cần đánh giá lại",
    "Nghỉ học": "Ngừng xử lý",
  },
  exportFilePrefix: "danh_sach_lao_dong",
  printTitle: "DANH SÁCH LAO ĐỘNG",
  printFooter: "Hệ thống Quản lý Tuyển dụng & Lao động iGen",
  partnerReferralCountLabel: "Số lao động giới thiệu",
  partnerReferralValueLabel: "Tổng giá trị giới thiệu",
  partnerReferralUnit: "lao động",
  partnerValueLabel: "Giá trị giới thiệu",
  notificationAudienceLabel: "Tất cả lao động",
  notificationSubtitle: "Gửi thông báo tự động đến lao động",
  settingsSavedMessage: "Cấu hình form lao động đã được lưu thành công!",
  settingsMailDescription: "Kết nối tài khoản Gmail để tự động gửi thông báo tuyển dụng và lịch làm việc cho lao động, đối tác.",
};

const CUSTOMER_OPERATIONAL_COPY: WorkerOperationalCopy = {
  isWorker: false,
  isCustomer: true,
  unassignedGroupLabel: "Chưa sử dụng dịch vụ",
  registrationStatusLabels: {
    "Đang học": "Đang sử dụng",
    "Đang thi": "Đang tư vấn",
    "Đã đậu": "Đã hoàn thành",
    "Thi lại": "Cần chăm sóc lại",
    "Nghỉ học": "Ngừng sử dụng",
  },
  exportFilePrefix: "danh_sach_khach_hang",
  printTitle: "DANH SÁCH KHÁCH HÀNG",
  printFooter: "Hệ thống Quản lý Dịch vụ & Khách hàng iGen",
  partnerReferralCountLabel: "Số khách hàng giới thiệu",
  partnerReferralValueLabel: "Tổng giá trị dịch vụ giới thiệu",
  partnerReferralUnit: "khách hàng",
  partnerValueLabel: "Giá trị dịch vụ",
  notificationAudienceLabel: "Tất cả khách hàng",
  notificationSubtitle: "Gửi thông báo tự động đến khách hàng",
  settingsSavedMessage: "Cấu hình form khách hàng đã được lưu thành công!",
  settingsMailDescription: "Kết nối tài khoản Gmail để tự động gửi thông báo dịch vụ và lịch hẹn cho khách hàng, đối tác.",
};

export function getWorkerOperationalCopy(preset: EntityPreset): WorkerOperationalCopy {
  if (preset === "worker") return WORKER_OPERATIONAL_COPY;
  if (preset === "customer") return CUSTOMER_OPERATIONAL_COPY;
  return EDUCATION_OPERATIONAL_COPY;
}

export function getOperationalStatusLabel(preset: EntityPreset, status: string): string {
  return getWorkerOperationalCopy(preset).registrationStatusLabels[status] ?? status;
}

export function usesEducationBilling(preset: EntityPreset): boolean {
  return preset !== "worker" && preset !== "customer";
}
