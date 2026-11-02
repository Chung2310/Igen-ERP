import type { RepairRefundInput } from '../../../shared/repair-refund';

export function readRefundRequest(key: string): RepairRefundInput | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Yêu cầu hoàn đã lưu không hợp lệ.');
  const item = value as Partial<RepairRefundInput>;
  if (!Number.isSafeInteger(item.amount) || Number(item.amount) <= 0 || !Number.isSafeInteger(item.laborAmount) || Number(item.laborAmount) < 0 || Number(item.laborAmount) > Number(item.amount) || typeof item.reference !== 'string' || !item.reference || typeof item.reason !== 'string' || !item.reason || typeof item.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,120}$/.test(item.idempotencyKey)) throw new Error('Yêu cầu hoàn đã lưu không hợp lệ. Cần đối soát trước khi nhập yêu cầu khác.');
  return { amount: item.amount!, laborAmount: item.laborAmount!, reference: item.reference, reason: item.reason, idempotencyKey: item.idempotencyKey };
}
export function sameRefundRequest(a: RepairRefundInput, b: RepairRefundInput) {
  return a.idempotencyKey === b.idempotencyKey && a.amount === b.amount && a.laborAmount === b.laborAmount && a.reference === b.reference && a.reason === b.reason;
}
export async function withRefundRequestLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(key, work) : work();
}
