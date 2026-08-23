import { Schema, model } from "mongoose";
import { IStockLog } from "../interface/stock-log.interface";

const StockLogItemSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, min: 0 },
    lineTotal: { type: Number, min: 0 },
    unitCost: { type: Number, min: 0 },
    category: { type: String, trim: true },
    unitIdentifiers: { type: [String], default: [] },
    serialNumbers: { type: [String], default: [] },
  },
  { _id: false }
);

const StockLogSchema = new Schema<IStockLog>({
  type: { type: String, enum: ["nhập", "xuất"], required: true, index: true },
  title: { type: String },
  items: { type: [StockLogItemSchema], default: [] },
  // No default: legacy outbound records stay explicitly unclassified.
  purpose: { type: String, enum: ["bán", "nội bộ", "hủy", "chuyển kho"], index: true },
  customerId: { type: String, trim: true, index: true },
  customerName: { type: String, trim: true },
  sku: { type: String },
  productName: { type: String },
  quantity: { type: Number, default: 0 },
  operatorName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  notes: { type: String },
  status: { type: String, enum: ["Thành công", "Đang xử lý", "Đang chờ", "Hoàn thành"], default: "Thành công" },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  refType: { type: String, enum: ["retail-order", "goods-receipt", "sales-return", "supplier-return"], index: true },
  refId: { type: String, index: true },
  idempotencyKey: { type: String, index: true },
});

StockLogSchema.index({ companyCode: 1, type: 1, createdAt: 1 });
StockLogSchema.index(
  { companyCode: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

export const StockLogModel = model<IStockLog>("StockLog", StockLogSchema);
