import { model, Schema } from "mongoose";

export type PointTransactionType =
  | "EARN_ORDER"
  | "EARN_REPAIR"
  | "REDEEM_ORDER"
  | "REDEEM_REPAIR"
  | "MANUAL_GRANT"
  | "MANUAL_DEDUCT"
  | "REFUND_REVERT";

export interface ICustomerPointLedger {
  companyCode: string;
  branchId?: string;
  customerId: string;
  transactionCode: string;
  type: PointTransactionType;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  sourceType: "retail_order" | "repair_ticket" | "manual";
  sourceId?: string;
  sourceCode?: string;
  reasonCategory?: "purchase" | "repair" | "birthday" | "compensation" | "loyalty_gift" | "refund" | "correction";
  reason: string;
  actorId?: string;
  actorName?: string;
  createdAt: Date;
}

const CustomerPointLedgerSchema = new Schema<ICustomerPointLedger>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  customerId: { type: String, required: true, index: true },
  transactionCode: { type: String, required: true },
  type: {
    type: String,
    enum: [
      "EARN_ORDER",
      "EARN_REPAIR",
      "REDEEM_ORDER",
      "REDEEM_REPAIR",
      "MANUAL_GRANT",
      "MANUAL_DEDUCT",
      "REFUND_REVERT",
    ],
    required: true,
    index: true,
  },
  points: { type: Number, required: true },
  balanceBefore: { type: Number, required: true, min: 0 },
  balanceAfter: { type: Number, required: true, min: 0 },
  sourceType: {
    type: String,
    enum: ["retail_order", "repair_ticket", "manual"],
    required: true,
  },
  sourceId: { type: String, index: true },
  sourceCode: String,
  reasonCategory: {
    type: String,
    enum: [
      "purchase",
      "repair",
      "birthday",
      "compensation",
      "loyalty_gift",
      "refund",
      "correction",
    ],
  },
  reason: { type: String, required: true, trim: true },
  actorId: String,
  actorName: String,
  createdAt: { type: Date, default: Date.now, required: true, index: true },
}, {
  timestamps: false,
  versionKey: false,
});

CustomerPointLedgerSchema.index({ companyCode: 1, customerId: 1, createdAt: -1 });
CustomerPointLedgerSchema.index({ companyCode: 1, transactionCode: 1 }, { unique: true });
CustomerPointLedgerSchema.index(
  { companyCode: 1, sourceId: 1, type: 1 },
  { partialFilterExpression: { sourceId: { $type: "string" } } }
);

export const CustomerPointLedgerModel = model<ICustomerPointLedger>(
  "CustomerPointLedger",
  CustomerPointLedgerSchema
);
