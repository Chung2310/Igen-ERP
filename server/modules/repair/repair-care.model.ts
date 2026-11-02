import { model, Schema } from "mongoose";

const careCase = new Schema({ companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  ticketId: { type: String, required: true }, ticketCode: { type: String, required: true }, customerId: { type: String, required: true },
  customerName: String, status: { type: String, enum: ["open", "waiting", "resolved"], default: "open", required: true },
  lastEventAt: Date, updatedBy: String,
}, { timestamps: true });
careCase.index({ companyCode: 1, ticketId: 1 }, { unique: true });
careCase.index({ companyCode: 1, branchId: 1, customerId: 1, lastEventAt: -1 });
export const RepairCareCaseModel = model("RepairCareCase", careCase);

const event = new Schema({ companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  ticketId: { type: String, required: true }, customerId: { type: String, required: true },
  idempotencyKey: { type: String, required: true }, type: { type: String, enum: ["message", "status"], required: true },
  channel: { type: String, enum: ["phone", "email", "zalo", "in_person", "internal"] },
  direction: { type: String, enum: ["incoming", "outgoing", "note"] }, body: String,
  fromStatus: String, toStatus: String, actorId: { type: String, required: true }, actorName: String,
  createdAt: { type: Date, default: Date.now },
});
event.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
event.index({ companyCode: 1, branchId: 1, ticketId: 1, createdAt: 1 });
export const RepairCareEventModel = model("RepairCareEvent", event);
