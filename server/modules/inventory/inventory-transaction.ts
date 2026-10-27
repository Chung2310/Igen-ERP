import type { ClientSession } from 'mongoose';
import { runInventoryTransaction } from '../../integrations/shared/inventory-transaction';

export function inInventoryTransaction<T>(work: (session: ClientSession) => Promise<T>, existing?: ClientSession): Promise<T> {
  if (existing) {
    if (!existing.inTransaction()) throw Object.assign(new Error('Thao tác kho yêu cầu transaction đang hoạt động.'), { statusCode: 503 });
    return work(existing);
  }
  return runInventoryTransaction(work);
}
