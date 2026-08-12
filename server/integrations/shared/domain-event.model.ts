import { model, Schema } from "mongoose";

const DeliverySchema = new Schema({ consumer: { type: String, required: true }, status: { type: String, enum: ["pending", "done", "skipped", "failed"], default: "pending" }, attempts: { type: Number, default: 0 }, lastError: String, nextAttemptAt: Date, completedAt: Date }, { _id: false });
const DomainEventSchema = new Schema({ eventId: { type: String, required: true }, eventType: { type: String, required: true }, companyCode: { type: String, required: true }, branchId: String, aggregateType: { type: String, required: true }, aggregateId: { type: String, required: true }, payload: { type: Schema.Types.Mixed, required: true }, occurredAt: { type: Date, required: true }, actorId: { type: String, required: true }, actorName: { type: String, required: true }, deliveries: { type: [DeliverySchema], default: [] } }, { timestamps: true });
DomainEventSchema.index({ eventId: 1 }, { unique: true });
DomainEventSchema.index({ companyCode: 1, eventType: 1, occurredAt: -1 });
DomainEventSchema.index({ "deliveries.status": 1, "deliveries.nextAttemptAt": 1 });
DomainEventSchema.index({ aggregateType: 1, aggregateId: 1 });
export const DomainEventModel = model("DomainEvent", DomainEventSchema);
