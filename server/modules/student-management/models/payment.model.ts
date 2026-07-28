import { Schema, model } from "mongoose";
import { IPayment } from "../interfaces/payment.interface";

const paymentSchema = new Schema<IPayment>(
  {
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    note: { type: String, default: "" },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  },
  {
    timestamps: true,
  }
);

export const Payment = model<IPayment>("Payment", paymentSchema);
