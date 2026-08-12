export type RetailReceivableEntryType = "charge" | "payment" | "adjustment" | "reversal";

export interface PostReceivableEntryInput {
  type: RetailReceivableEntryType;
  customerId: string;
  orderId?: string;
  amount: number;
  reason?: string;
  reversesEntryId?: string;
  idempotencyKey: string;
  direction?: "increase" | "decrease";
}

export interface IRetailReceivableEntry extends PostReceivableEntryInput {
  companyCode: string;
  branchId: string;
  signedAmount: number;
  createdBy: string;
  createdByName: string;
  createdAt?: Date;
  updatedAt?: Date;
}
