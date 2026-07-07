import { Schema, model } from "mongoose";
import { IResource } from "../interfaces/resource.interface";

const bookingSchema = new Schema(
  {
    purpose: { type: String, required: true, trim: true },
    by: { type: String, required: true, trim: true },
    date: { type: String, required: true },      // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },   // HH:mm
  },
  { _id: true }
);

const resourceSchema = new Schema<IResource>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    identifier: { type: String, required: true, trim: true },
    capacity: { type: String, required: true },
    status: {
      type: String,
      enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
      default: "AVAILABLE",
      index: true,
    },
    bookings: { type: [bookingSchema], default: [] },
    ownerId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

export const Resource = model<IResource>("Resource", resourceSchema);
