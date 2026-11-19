import AiUsage, { type IAiUsage } from '../models/AiUsage.js';
import type { QueryFilter } from 'mongoose';
import AiNutritionGenerationJob from '../models/AiNutritionGenerationJob.js';
import AiWorkoutGenerationJob from '../models/AiWorkoutGenerationJob.js';
import { logger } from '../config/logger.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';
import { withRequiredTransaction } from './transactionService.js';
import { makeAiUsageQuotaPlan, releaseAiUsageQuotaCounters } from './aiUsageQuotaService.js';
import { releaseCredits } from './creditWalletService.js';
import { releaseGlobalAiBudget } from './aiGlobalBudgetService.js';

export const AI_RESERVATION_LEASE_MS = 10 * 60_000;
export const newAiLease = () => new Date(Date.now() + AI_RESERVATION_LEASE_MS);

export async function invokeWithAiLease<T>(usageId: string, invoke: () => Promise<T>): Promise<T> {
  const heartbeat = setInterval(() => {
    void AiUsage.updateOne({ _id: usageId, status: 'RESERVED' }, { $set: { leaseExpiresAt: newAiLease() } })
      .catch(error => logger.error({ err: error, usageId }, 'Unable to renew AI reservation'));
  }, 30_000);
  heartbeat.unref();
  try { return await invoke(); }
  finally { clearInterval(heartbeat); }
}

export async function recoverExpiredAiReservations(now = new Date()) {
  const expired: QueryFilter<IAiUsage> = { status: 'RESERVED', $or: [
    { leaseExpiresAt: { $lte: now } },
    { leaseExpiresAt: { $exists: false }, createdAt: { $lte: new Date(now.getTime() - AI_RESERVATION_LEASE_MS) } },
  ] };
  const candidates = await runWithSystemCenterAccess(() => AiUsage.find(expired).select('_id centerId').limit(200).lean());
  let recovered = 0;
  for (const item of candidates) {
    const centerId = String((item as typeof item & { centerId?: unknown }).centerId || '');
    if (!centerId) continue;
    try {
      const changed = await runWithCenter(centerId, () => withRequiredTransaction(async session => {
        // Recheck expiry within the transaction; a healthy process may have renewed its lease.
        const usage = await AiUsage.findOne({ _id: item._id, ...expired }).session(session);
        if (!usage) return false;
        if (usage.billingMode === 'COMPANY_PAID') {
          if (usage.globalBudgetMonthKey && usage.reservedProviderCostVnd) {
            await releaseGlobalAiBudget(usage.globalBudgetMonthKey, usage.reservedProviderCostVnd, session);
          }
          if (usage.quotaPeriodKeys?.dayKey) {
            const plan = makeAiUsageQuotaPlan(String(usage.userId), new Date(`${usage.quotaPeriodKeys.dayKey}T12:00:00+07:00`));
            await releaseAiUsageQuotaCounters(plan, session);
          }
          // Legacy reservations without period keys were counted as used by migration 005.
        } else if (usage.reservedCredits > 0) {
          await releaseCredits({ userId: String(usage.userId), usageId: usage.id, credits: usage.reservedCredits, idempotencyKey: `release:${usage.id}` }, session);
          usage.releasedCredits = usage.reservedCredits;
        }
        usage.status = 'FAILED';
        usage.failureCode = 'GENERATION_INTERRUPTED';
        await usage.save({ session });
        const job = usage.requestKey.match(/^ai-(nutrition|workout)-job:([a-f0-9]{24})(?::|$)/i);
        if (job) {
          const update = { $set: { status: 'FAILED', completedAt: now, error: { code: 'GENERATION_INTERRUPTED', message: 'Tác vụ AI bị gián đoạn. Hạn mức giữ chỗ đã được hoàn lại. Hãy kiểm tra dữ liệu trước khi tạo lại.' } } };
          if (job[1] === 'nutrition') await AiNutritionGenerationJob.updateOne({ _id: job[2], status: 'PROCESSING' }, update, { session });
          else await AiWorkoutGenerationJob.updateOne({ _id: job[2], status: 'PROCESSING' }, update, { session });
        }
        return true;
      }));
      if (changed) recovered += 1;
    } catch (error) {
      logger.error({ err: error, usageId: String(item._id) }, 'AI reservation recovery will be retried');
    }
  }
  return recovered;
}

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
export function startAiReservationRecovery() {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await recoverExpiredAiReservations(); }
    catch (error) { logger.error({ err: error }, 'AI reservation recovery failed'); }
    finally { running = false; }
  };
  timer = setInterval(() => { void tick(); }, 60_000);
  timer.unref();
  void tick();
}
export function stopAiReservationRecovery() { if (timer) clearInterval(timer); timer = undefined; }
