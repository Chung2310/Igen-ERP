export type LogisticsKind = "equipment" | "supplies";
export type EquipmentStatus =
  "available" | "requested" | "in-use" | "maintenance" | "retired";
export type DocumentStatus =
  "draft" | "submitted" | "approved" | "rejected" | "posted" | "cancelled";
export interface LogisticsRecord {
  _id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface Attachment {
  type?: string;
  number?: string;
  issuedDay?: string;
  authority?: string;
  notes?: string;
  name: string;
  url: string;
  expiryDay?: string;
}
export interface Equipment extends LogisticsRecord {
  imageUrl?: string;
  code: string;
  name: string;
  category: string;
  status: EquipmentStatus;
  departmentId: string;
  roomId: string;
  location: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  originCountry: string;
  riskClassification: string;
  purchaseDay: string;
  usageStartDay: string;
  inspectionCycleMonths: number;
  nextInspectionDay: string;
  lastInspectionDay?: string;
  lastInspectionResult?: "pass" | "fail" | "conditional" | "";
  lastInspectionProvider?: string;
  lastInspectionReportUrl?: string;
  notes: string;
  documents: Attachment[];
  currentBorrowerId?: string;
}
export interface EquipmentRequest extends LogisticsRecord {
  employeeName?: string;
  equipmentId: string;
  equipmentName: string;
  employeeId: string;
  type: "borrow" | "return";
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string;
  expectedReturnDay: string;
  decisionReason?: string;
}
export interface Inspection extends LogisticsRecord {
  equipmentId: string;
  day: string;
  nextDay: string;
  kind: "inspection" | "calibration" | "maintenance";
  result: "pass" | "fail" | "conditional";
  provider: string;
  notes: string;
  reportUrl: string;
}
export interface Supply extends LogisticsRecord {
  code: string;
  name: string;
  category: string;
  unit: string;
  minQuantity: number;
  requiresExpiry: boolean;
  active: boolean;
  supplierId: string;
  notes: string;
  documents: Attachment[];
  precision?: number;
  trackingMode?: "none" | "lot";
  conversions?: { unit: string; factor: string }[];
  warehouseId?: string;
  roomId?: string;
  warehouseLocation?: string;
  manufactureDay?: string;
  batchNumber?: string;
  expiryDay?: string;
  inspectionDay?: string;
  nextInspectionDay?: string;
  inspectionCertificateNumber?: string;
  imageUrl?: string;
  unitPrice?: number;
  quantity?: number;
  stockValue?: number;
  expired?: boolean;
  expiringSoon?: boolean;
  stockStatus?: string;
}
export interface StockLine {
  supplyId: string;
  quantity: number;
  lot: string;
  expiryDay: string;
  quality: "available" | "quarantine" | "damaged";
  value: number;
  unit?: string;
}
export interface StockDocument extends LogisticsRecord {
  type: "opening" | "receipt" | "issue";
  voucherCode?: string;
  voucherDay?: string;
  warehouseId: string;
  supplierId: string;
  departmentId: string;
  reason: string;
  status: DocumentStatus;
  lines: StockLine[];
  decisionReason?: string;
}
export interface Balance extends LogisticsRecord {
  warehouseId: string;
  supplyId: string;
  lot: string;
  expiryDay: string;
  quality: StockLine["quality"];
  quantity: number;
  value: number;
}
export interface Ledger extends LogisticsRecord {
  documentId: string;
  warehouseId: string;
  supplyId: string;
  lot: string;
  quantity: number;
  value: number;
  expiryDay: string;
  quality: StockLine["quality"];
}
export interface Reference {
  _id: string;
  name: string;
}
export interface LogisticsReferences {
  warehouses: Reference[];
  suppliers: Reference[];
  departments: Reference[];
  rooms: Reference[];
  categories?: Reference[];
}
export type DirectoryKind = "suppliers" | "warehouses" | "categories";
export interface DirectoryRecord {
  _id: string;
  code: string;
  name: string;
  active: boolean;
  revision: number;
  editable: boolean;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  contactPerson: string;
  location: string;
  managerName: string;
  managerPhone: string;
  notes: string;
}
export interface LogisticsList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export const equipmentLabels: Record<EquipmentStatus, string> = {
  available: "Sẵn sàng",
  requested: "Chờ duyệt mượn",
  "in-use": "Đang sử dụng",
  maintenance: "Bảo dưỡng",
  retired: "Ngừng sử dụng",
};
export const documentLabels: Record<DocumentStatus, string> = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  posted: "Đã ghi sổ",
  cancelled: "Đã hủy",
};
export const requestLabels = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};
export const documentTypes = {
  opening: "Tồn đầu kỳ",
  receipt: "Nhập kho",
  issue: "Xuất kho",
};
