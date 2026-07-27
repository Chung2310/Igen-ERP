import { Schema, model } from "mongoose";
import { IStockLog } from "../interface/stock-log.interface";

const StockLogItemSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const StockLogSchema = new Schema<IStockLog>({
  type: { type: String, enum: ["nhập", "xuất"], required: true, index: true },
  title: { type: String },
  items: { type: [StockLogItemSchema], default: [] },
  sku: { type: String },
  productName: { type: String },
  quantity: { type: Number, default: 0 },
  operatorName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  notes: { type: String },
  status: { type: String, enum: ["Thành công", "Đang xử lý", "Đang chờ", "Hoàn thành"], default: "Thành công" },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
});

export const StockLogModel = model<IStockLog>("StockLog", StockLogSchema);
