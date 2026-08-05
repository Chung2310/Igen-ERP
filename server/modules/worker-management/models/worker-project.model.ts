import { Schema, model } from "mongoose";
import { IWorkerProject } from "../interfaces/worker-project.interface";

const WorkerProjectSchema = new Schema<IWorkerProject>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, index: true },
    code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    quota: { type: Number, default: 0 },
    workerIds: [{ type: Schema.Types.ObjectId, ref: "Worker" }],
    daysOfWeek: [{ type: Number }],
    startTime: { type: String, default: "08:00" },
    endTime: { type: String, default: "17:00" },
    location: { type: String },
    geoLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      radiusMeters: { type: Number },
    },
    startDate: { type: String },
    endDate: { type: String },
    status: {
      type: String,
      enum: ["planned", "active", "completed"],
      default: "planned",
      index: true,
    },
    note: { type: String },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

// Compound index for companyCode + code to ensure logical uniqueness per company (excluding deleted projects)
WorkerProjectSchema.index({ companyCode: 1, code: 1, deletedAt: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

export const WorkerProjectModel = model<IWorkerProject>("WorkerProject", WorkerProjectSchema);
