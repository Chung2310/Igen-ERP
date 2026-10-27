import { Schema, model } from "mongoose";
import type { RepairTicketDocument } from "./repair-ticket.interface";
import { normalizeSerialNumber } from "../inventory/serials/serial-state";
import { normalizePhone } from "../customer-management/customer-normalization";

/** IMEI/serial là tuỳ chọn trên phiếu nên phải bọc lại: hàm gốc ném lỗi khi rỗng. */
const normalizeCode = (value: unknown) => (String(value ?? "").trim() ? normalizeSerialNumber(String(value)) : undefined);

const CoverageSchema = new Schema({ customer: { covered: Boolean, endAt: Date, daysLeft: Number }, supplier: { covered: Boolean, endAt: Date, daysLeft: Number, supplierId: String, supplierName: String }, costBearer: { type: String, enum: ["supplier", "shop", "customer"], required: true }, checkedAt: { type: Date, required: true } }, { _id: false });
const HistorySchema = new Schema({ from: String, to: String, at: { type: Date, required: true }, by: { type: String, required: true }, byName: { type: String, required: true }, note: String, customerNotified: { type: Boolean, default: false }, technicianId: String, technicianName: String }, { _id: false });
const DeviceSchema = new Schema({ productId: String, serialNumber: String, imei: String, normalizedSerialNumber: String, normalizedImei: String, name: { type: String, required: true }, condition: { type: String, required: true }, accessories: { type: [String], default: [] }, imeiVerified: { type: Boolean, default: false } }, { _id: false });
const ClaimSchema = new Schema({ sentAt: Date, supplierRef: String, expectedReturnAt: Date, returnedAt: Date, outcome: { type: String, enum: ["repaired", "replaced", "rejected"] }, replacementSerialUnitId: String, note: String }, { _id: false });
const RepairTicketSchema = new Schema<RepairTicketDocument>({ companyCode: { type: String, required: true, index: true }, branchId: { type: String, required: true, index: true }, ticketCode: { type: String, required: true, trim: true }, customerId: { type: String, required: true }, customerName: { type: String, required: true }, customerPhone: { type: String, required: true }, device: { type: DeviceSchema, required: true }, coverage: { type: CoverageSchema, required: true }, supplierClaim: ClaimSchema, symptom: { type: String, required: true }, diagnosis: String, status: { type: String, required: true, default: "received", index: true }, statusHistory: { type: [HistorySchema], default: [] }, laborFee: { type: Number, min: 0, default: 0 }, partCost: { type: Number, min: 0, default: 0 }, discountAmount: { type: Number, min: 0, default: 0 }, totalAmount: { type: Number, min: 0, default: 0 }, paidAmount: { type: Number, min: 0, default: 0 }, dueAmount: { type: Number, min: 0, default: 0 }, paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" }, receivedAt: { type: Date, required: true }, promisedAt: Date, completedAt: Date, deliveredAt: Date, createdBy: { type: String, required: true }, createdByName: { type: String, required: true } }, { timestamps: true });
RepairTicketSchema.add({ quotedAmount: { type: Number, min: 0 }, quotedAt: Date, customerApprovedAt: Date, feedbackToken: { type: String, unique: true, sparse: true } });
RepairTicketSchema.index({ companyCode: 1, ticketCode: 1 }, { unique: true });
RepairTicketSchema.index({ companyCode: 1, branchId: 1, status: 1, receivedAt: -1 });
RepairTicketSchema.index({ companyCode: 1, branchId: 1, customerId: 1, receivedAt: -1, _id: -1 });
RepairTicketSchema.index({ companyCode: 1, "device.serialNumber": 1 });
RepairTicketSchema.add({ normalizedCustomerPhone: { type: String, default: "" }, technicianId: String, technicianName: String, assignedAt: Date, assignedBy: String, partRevenue: { type: Number, min: 0, default: 0 } });
RepairTicketSchema.add({ retailPartnerId: { type: String, index: true }, retailPartnerSnapshot: { type: new Schema({ partnerId: String, code: String, name: String }, { _id: false }) } });
RepairTicketSchema.add({ paymentLedgerBaseline: Number });
RepairTicketSchema.add({ ticketType: { type: String, enum: ["service", "warranty"] }, subjectType: { type: String, enum: ["product", "equipment", "service"] }, intakeSource: { type: String, enum: ["external", "company_sale"] }, customerCode: String, linkedSerialUnitId: String, intakeRequestKey: String, intakeRequestFingerprint: String, partsVersion: { type: Number, default: 0 }, warrantyEvidence: { type: new Schema({ reference: String, endAt: Date, verifiedBy: String, verifiedAt: Date }, { _id: false }) } });
RepairTicketSchema.index({ companyCode: 1, intakeRequestKey: 1 }, { unique: true, partialFilterExpression: { intakeRequestKey: { $type: "string" } } });
RepairTicketSchema.index({ companyCode: 1, "device.normalizedImei": 1, receivedAt: -1 });
RepairTicketSchema.index({ companyCode: 1, "device.normalizedSerialNumber": 1, receivedAt: -1 });
RepairTicketSchema.index({ companyCode: 1, normalizedCustomerPhone: 1, receivedAt: -1 });
RepairTicketSchema.index({ companyCode: 1, technicianId: 1, status: 1 });

/** Khoá tra cứu chuẩn hoá được sinh tại model để mọi đường ghi đều có, không phụ thuộc caller. */
RepairTicketSchema.pre("validate", function normalizeLookupKeys(this: any) {
  if (this.device) {
    this.device.normalizedSerialNumber = normalizeCode(this.device.serialNumber);
    this.device.normalizedImei = normalizeCode(this.device.imei) || normalizeCode(this.device.serialNumber);
  }
  this.normalizedCustomerPhone = normalizePhone(this.customerPhone);
});
export const RepairTicketModel = model<RepairTicketDocument>("RepairTicket", RepairTicketSchema);
