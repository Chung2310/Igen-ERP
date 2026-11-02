export interface RepairRefundEntry {
  key: string;
  amount: number;
  laborAmount: number;
  reason: string;
  reference: string;
  financeVoucherId: string;
  at: string | Date;
  recordedAt: string | Date;
  by: string;
  byName: string;
}

export interface RepairRefundInput {
  amount: number;
  laborAmount: number;
  reference: string;
  reason: string;
  idempotencyKey: string;
}

export interface RepairRefundSummary {
  ticketId: string;
  ticketCode: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  netCollected: number;
  remaining: number;
  remainingLabor: number;
  remainingOther: number;
  refunds: RepairRefundEntry[];
}

export interface RepairRefundVoucher {
  _id: string;
  key: string;
  amount: number;
  occurredOn: string;
  description: string;
}

export type RepairRefundResult = { status: 'completed' | 'revoked' | 'not_found'; summary?: RepairRefundSummary };
