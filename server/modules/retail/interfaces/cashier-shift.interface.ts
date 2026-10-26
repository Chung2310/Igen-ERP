export type CashierShiftStatus = "open" | "closed" | "reconciled";
export type CashierShiftClosingMode = "manual" | "midnight";
export type RetailPaymentMethod = "cash" | "card" | "transfer" | "ewallet";
export interface CashMovement { idempotencyKey?: string; key?: string; reversesKey?: string; type: "in" | "out"; amount: number; reason: string; at: Date; by: string; byName: string }
export interface ShiftMethodTotal { method: RetailPaymentMethod; collectedAmount: number; refundedAmount: number }
export interface ICashierShift {
  customerDebtAmount?: number; financingDebtAmount?: number;
  voidedCashMovements?: Array<{ key: string; payload: string; at: Date; by: string }>;
  drawerId?: string; drawerName?: string; openedByName?: string; countedBy?: string; countedAt?: Date;
  closingSnapshot?: { capturedAt: Date; orderCount: number; soldOrderCount: number; products: any[]; legacy?: boolean };
  auditLog?: Array<{ action: string; at: Date; by: string; byName: string; detail?: string }>;
  shiftCode: string; companyCode: string; branchId: string; terminalId?: string;
  pausedAt?: Date; pausedBy?: string; pauseReason?: string; terminalHistory?: Array<{ fromTerminalId?: string; toTerminalId?: string; changedAt: Date; changedBy: string }>;
  cashierId: string; cashierName: string; openingFloat: number; openedAt: Date; openedBy: string;
  cashMovements: CashMovement[]; grossSales: number; collectedAmount: number; newDebtAmount: number;
  refundedAmount: number; netCollectedAmount: number; methodTotals: ShiftMethodTotal[]; expectedCash: number;
  countedCash?: number; varianceAmount?: number; varianceReason?: string; status: CashierShiftStatus;
  workShiftId?: string; workShiftCode?: string; workShiftName?: string; workShiftSource?: "custom" | "employee" | "company" | "legacy"; workShiftBusinessDate?: string; scheduledStartAt?: Date; scheduledEndAt?: Date; operationalEndsAt?: Date;
  closingMode?: CashierShiftClosingMode; activityVersion?: number; lastActivityAt?: Date;
  businessDate: string; closedAt?: Date; closedBy?: string; approvedBy?: string; approvedByName?: string; approvedAt?: Date;
  createdAt?: Date; updatedAt?: Date;
}
