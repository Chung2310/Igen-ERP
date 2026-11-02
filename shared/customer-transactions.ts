export type CustomerTransactionKind = 'sale' | 'repair' | 'sale_refund' | 'repair_refund' | 'buyback';
export type CustomerTransactionFilter = 'all' | 'sale' | 'repair' | 'refund' | 'buyback';
export interface CustomerTransactionRow {
  id: string;
  kind: CustomerTransactionKind;
  sourceId: string;
  eventId?: string;
  code: string;
  parentCode?: string;
  occurredAt: string;
  status: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  description: string;
}
export interface CustomerTransactionsResult {
  items: CustomerTransactionRow[];
  total: number;
  page: number;
  limit: number;
  repairsVisible: boolean;
  summary: { charged: number; received: number; refunded: number; buybackPaid: number; outstanding: number };
}
export interface CustomerTransactionDetail {
  item: CustomerTransactionRow;
  lines: Array<{ name: string; sku?: string; quantity: number; unitPrice: number; total: number; serials?: string[] }>;
  payments: Array<{ at?: string; amount: number; method?: string; reference?: string }>;
  refunds: Array<{ at?: string; amount: number; reason?: string; reference?: string }>;
  note?: string;
  adjustments?: Array<{ label: string; amount: number }>;
  device?: { name: string; serialNumber?: string; condition?: string; symptom?: string; diagnosis?: string };
  financeVoucherCode?: string;
}
