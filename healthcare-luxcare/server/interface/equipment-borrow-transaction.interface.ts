import type { Document } from "mongoose";

export type EquipmentBorrowRequestType = "borrow" | "return";
export type EquipmentBorrowRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface IEquipmentBorrowTransaction extends Document {
  companyCode: string;
  branchId?: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  employeeId: string;
  employeeName: string;
  requestType: EquipmentBorrowRequestType;
  status: EquipmentBorrowRequestStatus;
  reason?: string;
  note?: string;
  expectedReturnAt?: Date;
  borrowTransactionId?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: Date;
  rejectionReason?: string;
  cancelledAt?: Date;
}
