export type CashierShiftStatus = "open" | "closed" | "reconciled";
export type RetailPaymentMethod = "cash" | "card" | "transfer" | "ewallet";
export interface CashMovement { type: "in" | "out"; amount: number; reason: string; at: Date; by: string; byName: string }
export interface ShiftMethodTotal { method: RetailPaymentMethod; collectedAmount: number; refundedAmount: number }
export interface ICashierShift {
  shiftCode: string; companyCode: string; branchId: string; terminalId?: string;
  cashierId: string; cashierName: string; openingFloat: number; openedAt: Date; openedBy: string;
  cashMovements: CashMovement[]; grossSales: number; collectedAmount: number; newDebtAmount: number;
  refundedAmount: number; netCollectedAmount: number; methodTotals: ShiftMethodTotal[]; expectedCash: number;
  countedCash?: number; varianceAmount?: number; varianceReason?: string; status: CashierShiftStatus;
  businessDate: string; closedAt?: Date; closedBy?: string; approvedBy?: string; approvedByName?: string; approvedAt?: Date;
  createdAt?: Date; updatedAt?: Date;
}
