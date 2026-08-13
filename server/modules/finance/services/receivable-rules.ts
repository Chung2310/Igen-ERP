import type {
  ReceivableEntryType,
  ReceivableStatus,
  ReceivableTerminalStatus,
} from "../interfaces/receivable.interface";
import { ValidationError } from "../../../errors/app-error";

type AmountOptions = {
  direction?: "increase" | "decrease";
  originalSignedAmount?: number;
};

function assertIntegerVnd(amount: number, allowZero = false): void {
  if (!Number.isSafeInteger(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new ValidationError("VALIDATION_FAILED", "INVALID_VND_AMOUNT");
  }
}

export function signedReceivableAmount(type: ReceivableEntryType, amount: number, options: AmountOptions = {}): number {
  assertIntegerVnd(amount);
  if (type === "reversal") {
    const original = options.originalSignedAmount;
    if (!Number.isSafeInteger(original) || original === 0) throw new ValidationError("VALIDATION_FAILED", "REVERSAL_ORIGINAL_AMOUNT_REQUIRED");
    return -original;
  }
  if (type === "payment" || type === "refund" || type === "write_off") return -amount;
  if (type === "adjustment" && options.direction === "decrease") return -amount;
  return amount;
}

type OperationInput = AmountOptions & {
  type: ReceivableEntryType;
  balance: number;
  amount: number;
  reason?: string;
};

export function assertReceivableOperation(input: OperationInput): number {
  assertIntegerVnd(input.balance, true);
  const reason = String(input.reason || "").trim();
  if (["adjustment", "write_off", "reversal"].includes(input.type) && !reason) {
    throw new ValidationError(input.type === "adjustment" ? "ADJUSTMENT_REASON_REQUIRED" : "VALIDATION_FAILED", "REASON_REQUIRED");
  }
  if ((input.type === "payment" || input.type === "refund" || input.type === "write_off") && input.amount > input.balance) {
    throw new ValidationError("PAYMENT_EXCEEDS_BALANCE", "PAYMENT_EXCEEDS_BALANCE");
  }
  return signedReceivableAmount(input.type, input.amount, input);
}

type StatusInput = {
  originalAmount: number;
  paidAmount: number;
  balance: number;
  terminal?: ReceivableTerminalStatus;
};

export function deriveReceivableStatus(input: StatusInput): ReceivableStatus {
  assertIntegerVnd(input.originalAmount);
  assertIntegerVnd(input.paidAmount, true);
  assertIntegerVnd(input.balance, true);
  if (input.terminal) return input.terminal;
  if (input.balance === 0) return "settled";
  if (input.paidAmount > 0 || input.balance < input.originalAmount) return "partially_paid";
  return "open";
}
