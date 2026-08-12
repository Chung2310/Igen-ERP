const PAYMENT_METHODS = ["cash", "card", "transfer", "ewallet", "retail"] as const;

function text(value: unknown, code: string) {
  const result = String(value || "").trim();
  if (!result) throw new ValidationError(code === "ADJUSTMENT_REASON_REQUIRED" ? "ADJUSTMENT_REASON_REQUIRED" : "VALIDATION_FAILED", code);
  return result;
}

function vnd(value: unknown) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError("VALIDATION_FAILED", "INVALID_VND_AMOUNT");
  return amount;
}

export function validateCollection(input: any, balance?: number) {
  const amount = vnd(input?.amount);
  if (balance !== undefined && amount > balance) throw new ValidationError("PAYMENT_EXCEEDS_BALANCE", "PAYMENT_EXCEEDS_BALANCE");
  const paymentMethod = String(input?.paymentMethod || "");
  if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) throw new ValidationError("VALIDATION_FAILED", "INVALID_PAYMENT_METHOD");
  const reference = String(input?.reference || "").trim();
  return { amount, paymentMethod, ...(reference ? { reference } : {}), idempotencyKey: text(input?.idempotencyKey, "IDEMPOTENCY_KEY_REQUIRED") };
}

export function validateReason(input: any) {
  return { reason: text(input?.reason, "REASON_REQUIRED"), idempotencyKey: text(input?.idempotencyKey, "IDEMPOTENCY_KEY_REQUIRED") };
}

export function validateAdjustment(input: any) {
  const direction = String(input?.direction || "increase");
  if (direction !== "increase" && direction !== "decrease") throw new ValidationError("VALIDATION_FAILED", "INVALID_ADJUSTMENT_DIRECTION");
  return { amount: vnd(input?.amount), direction, reason: text(input?.reason, "ADJUSTMENT_REASON_REQUIRED"), idempotencyKey: text(input?.idempotencyKey, "IDEMPOTENCY_KEY_REQUIRED") };
}

export function validateSuspension(input: any) {
  const raw = String(input?.until || "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) throw new ValidationError("VALIDATION_FAILED", "INVALID_DATE");
  const until = new Date(raw);
  if (Number.isNaN(until.valueOf())) throw new ValidationError("VALIDATION_FAILED", "INVALID_DATE");
  return { until, reason: text(input?.reason, "REASON_REQUIRED") };
}
import { ValidationError } from "../../../errors/app-error";
