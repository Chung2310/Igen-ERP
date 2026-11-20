export const SUPPLY_V2_PERMISSIONS = [
  ["catalog-manage", "Quản lý danh mục vật tư"],
  ["document-create", "Lập chứng từ kho"],
  ["approve", "Duyệt chứng từ kho"],
  ["post", "Ghi sổ kho"],
  ["transfer", "Điều chuyển vật tư"],
  ["stocktake", "Kiểm kê vật tư"],
  ["adjust", "Điều chỉnh chênh lệch kho"],
  ["dispose", "Hủy vật tư"],
  ["reverse", "Đảo chứng từ kho"],
  ["quality-manage", "Quản lý chất lượng vật tư"],
  ["purchase", "Mua vật tư"],
  ["cost-read", "Xem giá trị vật tư"],
  ["report-export", "Xuất báo cáo vật tư"],
  ["settings-manage", "Cấu hình nghiệp vụ kho"],
] as const;

export type InventoryDocumentType = "opening" | "receipt" | "issue";
export type InventoryDocumentStatus = "draft" | "submitted" | "approved" | "rejected" | "posted" | "cancelled";
export type InventoryQuality = "available" | "quarantine" | "damaged";
export interface InventoryDraftLine {
  supplyId: string;
  quantity: string;
  unit: string;
  lotNumber?: string;
  manufacturerKey?: string;
  expiryDay?: string;
  lotId?: string;
  totalValueMinor?: number;
}
export interface InventoryDraft {
  type: InventoryDocumentType;
  warehouseId: string;
  reason: string;
  recipientDepartment?: string;
  supplierId?: string;
  lines: InventoryDraftLine[];
}
