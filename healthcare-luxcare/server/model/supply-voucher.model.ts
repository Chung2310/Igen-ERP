import { model, Schema } from "mongoose";

const voucherItemSchema = new Schema(
  {
    supplyId: { type: String, required: true },
    supplyCode: { type: String, required: true },
    supplyName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    batchNumber: { type: String, trim: true },
    expiryDate: Date,
    unitPrice: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: true },
);

const voucherSchema = new Schema(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    batchCode: { type: String, required: true, trim: true },
    type: { type: String, enum: ["in", "out"], required: true, index: true },
    status: { type: String, enum: ["draft", "completing", "completed"], default: "draft", index: true },
    reason: { type: String, required: true, trim: true },
    supplier: { type: String, trim: true },
    warehouseLocation: { type: String, trim: true },
    recipientDepartment: { type: String, trim: true },
    performerId: { type: String, required: true },
    performerName: { type: String, required: true },
    items: { type: [voucherItemSchema], required: true },
    completedAt: Date,
  },
  { timestamps: true },
);

voucherSchema.index({ companyCode: 1, batchCode: 1 }, { unique: true });
voucherSchema.index({ companyCode: 1, branchId: 1, status: 1, createdAt: -1 });

export const SupplyVoucherModel = model("SupplyVoucher", voucherSchema);
