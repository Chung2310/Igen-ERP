import mongoose from 'mongoose';
import AiUsage from '../models/AiUsage.js';
import AiUsageQuotaCounter from '../models/AiUsageQuotaCounter.js';
import { runWithSystemCenterAccess } from '../tenancy/centerContext.js';

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1_000;

interface UsageGroup {
  _id: { centerId: mongoose.Types.ObjectId; userId?: mongoose.Types.ObjectId };
  requests: number;
  providerCostMicrousd: number;
}

function periodKeys(now: Date) {
  const local = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    dayKey: `${year}-${pad(month)}-${pad(day)}`,
    monthKey: `${year}-${pad(month)}`,
    dayStart: new Date(Date.UTC(year, month - 1, day) - VIETNAM_OFFSET_MS),
    monthStart: new Date(Date.UTC(year, month - 1, 1) - VIETNAM_OFFSET_MS),
  };
}

async function aggregateUsage(start: Date, now: Date, groupBy: 'USER' | 'CENTER') {
  const groupId = groupBy === 'USER'
    ? { centerId: '$centerId', userId: '$userId' }
    : { centerId: '$centerId' };
  return AiUsage.collection.aggregate<UsageGroup>([
    { $match: {
      billingMode: 'COMPANY_PAID',
      status: { $in: ['SUCCEEDED', 'RESERVED'] },
      centerId: { $type: 'objectId' },
      ...(groupBy === 'USER' ? { userId: { $type: 'objectId' } } : {}),
      createdAt: { $gte: start, $lte: now },
    } },
    { $group: {
      _id: groupId,
      requests: { $sum: 1 },
      providerCostMicrousd: { $sum: { $ifNull: ['$providerCostMicrousd', 0] } },
    } },
  ]).toArray();
}

async function seedCounters(groups: UsageGroup[], input: {
  scope: 'USER' | 'CENTER';
  periodType: 'DAY' | 'MONTH';
  periodKey: string;
  now: Date;
}) {
  for (const group of groups) {
    const filter = {
      centerId: group._id.centerId,
      scope: input.scope,
      periodType: input.periodType,
      periodKey: input.periodKey,
      ...(input.scope === 'USER' ? { userId: group._id.userId } : {}),
    };
    await AiUsageQuotaCounter.collection.updateOne(
      filter,
      {
        $set: {
          usedRequests: group.requests,
          reservedRequests: 0,
          providerCostMicrousd: group.providerCostMicrousd,
          updatedAt: input.now,
        },
        $setOnInsert: { createdAt: input.now },
      },
      { upsert: true },
    );
  }
}

export async function upAiUsageQuotaCounters({ dryRun }: { dryRun: boolean }) {
  return runWithSystemCenterAccess(async () => {
    const now = new Date();
    const periods = periodKeys(now);
    const [dailyUsers, monthlyUsers, monthlyCenters] = await Promise.all([
      aggregateUsage(periods.dayStart, now, 'USER'),
      aggregateUsage(periods.monthStart, now, 'USER'),
      aggregateUsage(periods.monthStart, now, 'CENTER'),
    ]);

    if (!dryRun) {
      await AiUsageQuotaCounter.createIndexes();
      await AiUsageQuotaCounter.collection.createIndex({ centerId: 1 }, { name: 'centerId_1' });
      await Promise.all([
        seedCounters(dailyUsers, { scope: 'USER', periodType: 'DAY', periodKey: periods.dayKey, now }),
        seedCounters(monthlyUsers, { scope: 'USER', periodType: 'MONTH', periodKey: periods.monthKey, now }),
        seedCounters(monthlyCenters, { scope: 'CENTER', periodType: 'MONTH', periodKey: periods.monthKey, now }),
      ]);
    }

    return {
      periods: { day: periods.dayKey, month: periods.monthKey },
      counts: {
        dailyUserCounters: { matched: dailyUsers.length, modified: dailyUsers.length },
        monthlyUserCounters: { matched: monthlyUsers.length, modified: monthlyUsers.length },
        monthlyCenterCounters: { matched: monthlyCenters.length, modified: monthlyCenters.length },
      },
      note: 'Existing mobile company-paid usage for the current Vietnam day and month was preserved in quota counters.',
    };
  });
}

export async function downAiUsageQuotaCounters() {
  throw new Error('AI quota counters cannot be rolled back safely after requests have been processed.');
}
