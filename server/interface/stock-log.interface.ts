import { Document } from "mongoose";

export interface IStockLogItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
}

export interface IStockLog extends Document {
  type: "nhập" | "xuất";
  title?: string;
  items: IStockLogItem[];
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
