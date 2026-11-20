export interface BankTransferPayment {
  bank: string;
  accountNumber: string;
  accountName: string;
  qrAccountNumber: string;
  subAccount?: string;
  amountVND: number;
  transferContent: string;
  paymentCode: string;
  qrUrl: string;
}
