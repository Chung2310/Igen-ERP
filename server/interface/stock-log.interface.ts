import { Document } from "mongoose";

export interface IStockLogItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  unitCost?: number;
  category?: string;
}

export type StockLogPurpose = "bán" | "nội bộ" | "hủy" | "chuyển kho";

export interface IStockLog extends Document {
  type: "nhập" | "xuất";
  title?: string;
  items: IStockLogItem[];
  purpose?: StockLogPurpose;
  customerId?: string;
  customerName?: string;
  // Các trường cũ để đảm bảo tương thích ngược
  sku: string;
  productName: string;
  quantity: number;
  operatorName: string;
  createdAt: Date;
  notes: string;
  status: "Thành công" | "Đang xử lý" | "Đang chờ" | "Hoàn thành";
  companyCode: string;
  branchId?: string;
}
