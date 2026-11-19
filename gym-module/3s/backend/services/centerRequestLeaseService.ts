import Center from '../models/Center.js';
import CenterRequestLease from '../models/CenterRequestLease.js';
import { supportsTransactions, withRequiredTransaction } from './transactionService.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { logger } from '../config/logger.js';

const REQUEST_LEASE_MS = 10 * 60_000;
export async function acquireCenterRequestLease(centerId: string, userId: string) {
  // Standalone MongoDB cannot accept invitations. Existing ordinary requests
  // remain usable there; transaction-only operations fail before modifying data.
  if (!await supportsTransactions()) return null;
  const lease = await withRequiredTransaction(async session => {
    const center = await Center.findOneAndUpdate({ _id: centerId, status: 'ACTIVE', workspaceType: 'PERSONAL' }, { $inc: { membershipVersion: 1 } }, { session });
    if (!center) throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Không gian làm việc đang thay đổi. Vui lòng đăng nhập lại.' });
    const [created] = await CenterRequestLease.create([{ centerId, userId, expiresAt: new Date(Date.now() + REQUEST_LEASE_MS) }], { session });
    return created;
  });
  const heartbeat = setInterval(() => {
    void CenterRequestLease.updateOne({ _id: lease._id }, { $set: { expiresAt: new Date(Date.now() + REQUEST_LEASE_MS) } })
      .catch(error => logger.error({ err: error }, 'Unable to renew center request lease'));
  }, 30_000);
  heartbeat.unref();
  let released = false;
  return { id: lease.id, abandon: () => {
    // A disconnected client does not cancel the controller. Keep the lease
    // until expiry so a transfer cannot immediately overtake its writes.
    clearInterval(heartbeat);
  }, release: async () => {
    if (released) return;
    released = true; clearInterval(heartbeat);
    await CenterRequestLease.deleteOne({ _id: lease._id });
  } };
}
