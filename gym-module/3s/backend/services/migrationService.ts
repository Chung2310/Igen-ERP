import { randomUUID } from 'node:crypto';
import mongoose, { type Model } from 'mongoose';
import ActivityCalorie from '../models/ActivityCalorie.js';
import AiBillingPolicy from '../models/AiBillingPolicy.js';
import CreditPricing from '../models/CreditPricing.js';
import CreditWallet from '../models/CreditWallet.js';
import FeatureFlag from '../models/FeatureFlag.js';
import Goal from '../models/Goal.js';
import InBodyRecord from '../models/InBodyRecord.js';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import MigrationRecord from '../models/MigrationRecord.js';
import NutritionFormula from '../models/NutritionFormula.js';
import NutritionPlan from '../models/NutritionPlan.js';
import Roadmap from '../models/Roadmap.js';
import User from '../models/User.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import { upCenterWorkspaceTypes, downCenterWorkspaceTypes } from '../migrations/006-center-workspace-types.js';
import { upPtOnboarding, downPtOnboarding } from '../migrations/007-pt-onboarding-and-ai-recovery.js';
import { upAiCompanyGlobalBudget, downAiCompanyGlobalBudget } from '../migrations/008-ai-company-global-budget.js';
import { downExerciseTrackingTypes, upExerciseTrackingTypes } from '../migrations/002-exercise-tracking-types.js';
import { downSuperAdminRole, upSuperAdminRole } from '../migrations/003-super-admin-role.js';
import { downCenterTenancy, upCenterTenancy } from '../migrations/004-center-tenancy.js';
import { downAiUsageQuotaCounters, upAiUsageQuotaCounters } from '../migrations/005-ai-usage-quota-counters.js';
import { AI_TASK_TYPES, type AiTaskType } from './creditTypes.js';
import { ensureWallet } from './creditWalletService.js';
import { runWithSystemCenterAccess } from '../tenancy/centerContext.js';

interface VersionedContent { version?: number; status?: string }
interface MigrationChange { model: string; versionIds: string[]; statusIds: string[] }
interface CreditMigrationMetadata { walletIds: string[]; pricingIds: string[]; policyIds: string[] }
interface MigrationDefinition {
  version: string;
  name: string;
  up: (options: { dryRun: boolean }) => Promise<Record<string, unknown>>;
  down: (metadata: Record<string, unknown>) => Promise<void>;
}

const featureKeys = ['OCR_INBODY', 'ROADMAP', 'EXERCISE_LIBRARY', 'PROGRESS', 'CARE', 'DASHBOARD', 'NUTRITION_AI', 'KNOWLEDGE_BASE', 'PT_ASSISTANT'] as const;
const LOCK_DURATION_MS = 60_000;

function isDuplicateKey(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function sanitizedError(error: unknown) {
  return { name: error instanceof Error && error.name ? error.name : 'Error', message: 'Migration failed.' };
}

async function applyContentDefaults({ dryRun }: { dryRun: boolean }) {
  const contentModels: Model<VersionedContent>[] = [KnowledgeDocument, Roadmap, InBodyRecord, Goal, WorkoutPlan, NutritionPlan].map((model) => model as unknown as Model<VersionedContent>);
  const changes: MigrationChange[] = [];
  let matched = 0;
  for (const Model of contentModels) {
    const [versionIds, statusIds] = await Promise.all([Model.find({ version: { $exists: false } }).distinct('_id'), Model.find({ status: { $exists: false } }).distinct('_id')]);
    if (!dryRun) {
      await Model.updateMany({ version: { $exists: false } }, { $set: { version: 1 } });
      await Model.updateMany({ status: { $exists: false } }, { $set: { status: 'DRAFT' } });
    }
    matched += new Set([...versionIds, ...statusIds].map(String)).size;
    changes.push({ model: Model.modelName, versionIds: versionIds.map(String), statusIds: statusIds.map(String) });
  }
  const templateModel = WorkoutTemplate as unknown as Model<VersionedContent>;
  const [versionIds, statusIds] = await Promise.all([templateModel.find({ version: { $exists: false } }).distinct('_id'), templateModel.find({ status: { $exists: false } }).distinct('_id')]);
  if (!dryRun) {
    await WorkoutTemplate.updateMany({ version: { $exists: false } }, { $set: { version: 1 } });
    await WorkoutTemplate.updateMany({ status: { $exists: false } }, { $set: { status: 'ACTIVE' } });
  }
  matched += new Set([...versionIds, ...statusIds].map(String)).size;
  changes.push({ model: WorkoutTemplate.modelName, versionIds: versionIds.map(String), statusIds: statusIds.map(String) });
  return { counts: { contentDocuments: { matched, modified: matched } }, changes };
}

async function downContentDefaults(metadata: Record<string, unknown>) {
  const changes = (metadata.changes || []) as MigrationChange[];
  for (const change of changes) {
    const Model = mongoose.model(change.model);
    if (change.versionIds.length) await Model.updateMany({ _id: { $in: change.versionIds } }, { $unset: { version: 1 } });
    if (change.statusIds.length) await Model.updateMany({ _id: { $in: change.statusIds } }, { $unset: { status: 1 } });
  }
}

const defaultPolicy = (taskType: AiTaskType) => {
  const isHeavyTask =
    taskType === 'TEXT_WORKOUT' ||
    taskType === 'TEXT_ROADMAP' ||
    taskType === 'TEXT_NUTRITION' ||
    taskType === 'IMAGE_GENERATION';

  const isMediumTask = taskType === 'OCR_INBODY';

  const credits = isHeavyTask ? 10 : isMediumTask ? 5 : 1;

  return {
    taskType,
    enabled: true,
    maxReservationCredits: credits,
    fallbackCredits: credits,
    markupBasisPoints: 12_500,
    minBillableCredits: credits,
  };
};

export async function ensureCreditReferenceData(): Promise<Pick<CreditMigrationMetadata, 'pricingIds' | 'policyIds'>> {
  await Promise.all([CreditPricing.createIndexes(), AiBillingPolicy.createIndexes()]);
  const pricing = await CreditPricing.updateOne(
    { key: 'GLOBAL' },
    {
      $set: { vndPerCredit: 100 },
      $setOnInsert: { key: 'GLOBAL', usdToVnd: 26_000 },
    },
    { upsert: true },
  );
  const policies = await Promise.all(
    AI_TASK_TYPES.map((taskType) => {
      const policy = defaultPolicy(taskType);
      return AiBillingPolicy.updateOne(
        { taskType },
        {
          $set: {
            enabled: policy.enabled,
            maxReservationCredits: policy.maxReservationCredits,
            fallbackCredits: policy.fallbackCredits,
            markupBasisPoints: policy.markupBasisPoints,
            minBillableCredits: policy.minBillableCredits,
          },
          $setOnInsert: { taskType },
        },
        { upsert: true },
      );
    }),
  );
  return {
    pricingIds: pricing.upsertedId ? [String(pricing.upsertedId)] : [],
    policyIds: policies.flatMap((result) => result.upsertedId ? [String(result.upsertedId)] : []),
  };
}

async function applyCreditWalletsAndPricing({ dryRun }: { dryRun: boolean }): Promise<Record<string, unknown>> {
  const users = await User.find().select({ _id: 1 }).lean();
  const existingWalletUserIds = new Set((await CreditWallet.find({ userId: { $in: users.map((user) => user._id) } }).distinct('userId')).map(String));
  const missingWalletUserIds = users.map((user) => String(user._id)).filter((id) => !existingWalletUserIds.has(id));
  const pricingMissing = !(await CreditPricing.exists({ key: 'GLOBAL' }));
  const existingTaskTypes = new Set((await AiBillingPolicy.find({ taskType: { $in: AI_TASK_TYPES } }).distinct('taskType')).map(String));
  const missingTaskTypes = AI_TASK_TYPES.filter((taskType) => !existingTaskTypes.has(taskType));
  const counts = {
    creditWallets: { matched: missingWalletUserIds.length, modified: missingWalletUserIds.length },
    creditPricing: { matched: pricingMissing ? 1 : 0, modified: pricingMissing ? 1 : 0 },
    aiBillingPolicies: { matched: missingTaskTypes.length, modified: missingTaskTypes.length },
  };
  if (dryRun) return { counts, walletIds: [], pricingIds: [], policyIds: [] };

  await CreditWallet.createIndexes();
  const walletIds: string[] = [];
  for (const userId of missingWalletUserIds) walletIds.push((await ensureWallet(userId)).id);
  const seeded = await ensureCreditReferenceData();
  return { counts, walletIds, ...seeded } satisfies CreditMigrationMetadata & { counts: typeof counts };
}

async function rollbackCreditWalletsAndPricing(metadata: Record<string, unknown>) {
  const credit = metadata as unknown as CreditMigrationMetadata;
  await Promise.all([
    CreditWallet.deleteMany({ _id: { $in: credit.walletIds || [] } }),
    CreditPricing.deleteMany({ _id: { $in: credit.pricingIds || [] } }),
    AiBillingPolicy.deleteMany({ _id: { $in: credit.policyIds || [] } }),
  ]);
}

const migrations: MigrationDefinition[] = [
  { version: '001-content-defaults', name: 'Add version and status defaults to legacy content', up: applyContentDefaults, down: downContentDefaults },
  {
    version: '002-credit-wallets-and-pricing',
    name: 'Backfill credit wallets and seed billing policies',
    up: applyCreditWalletsAndPricing,
    down: rollbackCreditWalletsAndPricing,
  },
  {
    version: '002-exercise-tracking-types',
    name: 'Add explicit tracking types to legacy exercises and workout plans',
    up: upExerciseTrackingTypes as MigrationDefinition['up'],
    down: downExerciseTrackingTypes,
  },
  {
    version: '003-super-admin-role',
    name: 'Enforce a single SUPER_ADMIN account',
    up: upSuperAdminRole as MigrationDefinition['up'],
    down: downSuperAdminRole,
  },
  {
    version: '004-center-tenancy',
    name: 'Backfill existing data into the 3S Gym center',
    up: upCenterTenancy as MigrationDefinition['up'],
    down: downCenterTenancy,
  },
  {
    version: '005-ai-usage-quota-counters',
    name: 'Create and backfill mobile AI usage quota counters',
    up: upAiUsageQuotaCounters as MigrationDefinition['up'],
    down: downAiUsageQuotaCounters,
  },
  {
    version: '006-center-workspace-types',
    name: 'Classify gym and personal PT workspaces',
    up: upCenterWorkspaceTypes as MigrationDefinition['up'],
    down: downCenterWorkspaceTypes,
  },
  { version: '007-pt-onboarding-and-ai-recovery', name: 'Personal PT features, gym invitations and AI recovery', up: upPtOnboarding, down: downPtOnboarding },
  { version: '008-ai-company-global-budget', name: 'Add monthly company-paid AI spend ledger', up: upAiCompanyGlobalBudget, down: downAiCompanyGlobalBudget },
];

async function prerequisitesApplied(index: number) {
  if (index === 0) return true;
  const required = migrations.slice(0, index).map((migration) => migration.version);
  return await MigrationRecord.countDocuments({ version: { $in: required }, status: 'APPLIED' }) === required.length;
}

async function applyMigration(migration: MigrationDefinition) {
  const ownerId = randomUUID();
  const lockedAt = new Date();
  const expiresAt = new Date(lockedAt.getTime() + LOCK_DURATION_MS);
  let lock;
  try {
    lock = await MigrationRecord.findOneAndUpdate(
      { version: migration.version, $or: [{ status: { $in: ['FAILED', 'ROLLED_BACK'] } }, { status: 'RUNNING', expiresAt: { $lte: lockedAt } }] },
      { $set: { name: migration.name, status: 'RUNNING', ownerId, lockedAt, expiresAt, metadata: {} }, $unset: { appliedAt: 1, rolledBackAt: 1, error: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
  } catch (error) {
    if (isDuplicateKey(error)) return false;
    throw error;
  }
  if (!lock || lock.ownerId !== ownerId) return false;
  const heartbeat = setInterval(() => {
    void MigrationRecord.updateOne(
      { version: migration.version, status: 'RUNNING', ownerId },
      { $set: { expiresAt: new Date(Date.now() + LOCK_DURATION_MS) } },
    ).catch(() => undefined);
  }, Math.floor(LOCK_DURATION_MS / 3));
  heartbeat.unref?.();
  try {
    const metadata = await migration.up({ dryRun: false });
    const applied = await MigrationRecord.findOneAndUpdate(
      { version: migration.version, status: 'RUNNING', ownerId },
      { $set: { status: 'APPLIED', appliedAt: new Date(), metadata }, $unset: { ownerId: 1, lockedAt: 1, expiresAt: 1, rolledBackAt: 1, error: 1 } },
      { returnDocument: 'after' },
    );
    return Boolean(applied);
  } catch (error) {
    await MigrationRecord.updateOne(
      { version: migration.version, status: 'RUNNING', ownerId },
      { $set: { status: 'FAILED', error: sanitizedError(error) }, $unset: { ownerId: 1, lockedAt: 1, expiresAt: 1 } },
    );
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

async function runMigrations(options: { dryRun?: boolean } = {}) {
  return runWithSystemCenterAccess(async () => {
  if (options.dryRun) {
    const appliedVersions = new Set((await MigrationRecord.find({ status: 'APPLIED' }).distinct('version')).map(String));
    const dryRun = [];
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      const metadata = await migration.up({ dryRun: true });
      dryRun.push({ version: migration.version, name: migration.name, ...metadata });
    }
    return { applied: [] as string[], dryRun };
  }

  await MigrationRecord.createIndexes();
  const applied: string[] = [];
  for (const [index, migration] of migrations.entries()) {
    if (!(await prerequisitesApplied(index))) continue;
    if (await applyMigration(migration)) applied.push(migration.version);
  }
  return { applied };
  });
}

async function migrateDown() {
  return runWithSystemCenterAccess(async () => {
  const record = await MigrationRecord.findOne({ status: 'APPLIED' }).sort({ appliedAt: -1, version: -1 });
  if (!record) return { rolledBack: null };
  const migration = migrations.find((item) => item.version === record.version);
  if (!migration) throw new Error(`Unknown migration version: ${record.version}`);
  await migration.down(record.metadata);
  record.status = 'ROLLED_BACK';
  record.rolledBackAt = new Date();
  await record.save();
  return { rolledBack: record.version };
  });
}

async function migrationStatus() {
  return runWithSystemCenterAccess(() => MigrationRecord.find().sort({ version: 1 }).select({ _id: 0, version: 1, name: 1, status: 1, appliedAt: 1, rolledBackAt: 1, error: 1, 'metadata.counts': 1 }).lean());
}

async function seedReferenceData() {
  return runWithSystemCenterAccess(async () => {
  for (const key of featureKeys) await FeatureFlag.updateOne(
    { key, $or: [{ centerId: null }, { centerId: { $exists: false } }] },
    { $setOnInsert: { key, centerId: null, enabled: false, roles: [], pilotUserIds: [] } },
    { upsert: true },
  );
  await NutritionFormula.updateOne({ name: 'MIFFLIN_ST_JEOR', version: 1 }, { $setOnInsert: { name: 'MIFFLIN_ST_JEOR', version: 1, active: true, fatLossFactor: 0.85, muscleGainFactor: 1.1, proteinPerKg: 2, fatPerKg: 0.8 } }, { upsert: true });
  const activities = [
    { name: 'Gym / Kháng lực cường độ cao (1h)', category: 'STRENGTH', met: 6.5 },
    { name: 'Tập tạ / Thể hình cơ bản (1h)', category: 'STRENGTH', met: 5.5 },
    { name: 'Chạy bộ 5km (Pace ~6:00)', category: 'CARDIO', met: 9.8 },
    { name: 'Chạy bộ nhanh / Chạy dốc (Pace ~5:00)', category: 'CARDIO', met: 11.5 },
    { name: 'Bơi lội 1km (Bơi sải / Bơi ếch)', category: 'CARDIO', met: 7.5 },
    { name: 'Cycling / Đạp xe ngoài trời 20km', category: 'CARDIO', met: 7.5 },
    { name: 'Đạp xe trong nhà / Spinning class (45p)', category: 'CARDIO', met: 8.5 },
    { name: 'Cardio Zone 2 (LISS 30-45 phút)', category: 'CARDIO', met: 5.5 },
    { name: 'Tabata / HIIT (Đốt mỡ ngắt quãng)', category: 'CARDIO', met: 9.5 },
    { name: 'Boxing / Kickfit (Đấm bao cát & Di chuyển)', category: 'MARTIAL_ARTS', met: 8.5 },
    { name: 'Nhảy dây (Jumping Rope)', category: 'CARDIO', met: 10 },
    { name: 'Cầu lông / Tennis đối kháng', category: 'SPORTS', met: 6.5 },
    { name: 'Yoga & Giãn cơ (Stretching / Mobility)', category: 'RECOVERY', met: 3 },
    { name: 'Đi bộ nhanh / Đi bộ dốc máy (Incline Walk)', category: 'CARDIO', met: 4.5 },
  ];
  for (const activity of activities) await ActivityCalorie.updateOne(
    { name: activity.name, $or: [{ centerId: null }, { centerId: { $exists: false } }] },
    { $set: { ...activity, active: true }, $setOnInsert: { centerId: null } },
    { upsert: true },
  );
  await ensureCreditReferenceData();
  });
}

export { runMigrations, migrateDown, migrationStatus, seedReferenceData };
