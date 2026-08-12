export const RECEIVABLE_STATUSES = ["open", "partially_paid", "settled", "void", "written_off"] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

export const RECEIVABLE_ENTRY_TYPES = ["charge", "payment", "adjustment", "refund", "write_off", "reversal"] as const;
export type ReceivableEntryType = (typeof RECEIVABLE_ENTRY_TYPES)[number];

export type ReceivableTerminalStatus = Extract<ReceivableStatus, "void" | "written_off">;

export interface IReceivable {
  companyCode: string;
  branchId: string;
  receivableCode: string;
  customerId: string;
  customerName: string;
  sourceType: string;
  sourceId: string;
  sourceCode?: string;
  sourceEventId: string;
  occurredAt: Date;
  dueDate: Date;
  originalAmount: number;
  paidAmount: number;
  adjustedAmount: number;
  balance: number;
  status: ReceivableStatus;
  daysOverdue: number;
  lastReminderAt?: Date;
  reminderCount: number;
  reminderSuspendedUntil?: Date;
  reminderSuspendReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IReceivableEntry {
  companyCode: string;
  branchId: string;
  receivableId: string;
  customerId: string;
  type: ReceivableEntryType;
  amount: number;
  balanceAfter: number;
  reason?: string;
  paymentMethod?: string;
  reference?: string;
  sourceEventId?: string;
  idempotencyKey: string;
  reversalOfEntryId?: string;
  createdBy: string;
  createdByName: string;
  createdAt?: Date;
  updatedAt?: Date;
}
