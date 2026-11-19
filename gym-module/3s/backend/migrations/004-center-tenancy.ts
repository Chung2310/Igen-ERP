import type { Model } from 'mongoose';
import ActivityCalorie from '../models/ActivityCalorie.js';
import AiNutritionGenerationJob from '../models/AiNutritionGenerationJob.js';
import AiUsage from '../models/AiUsage.js';
import AiWorkoutGenerationJob from '../models/AiWorkoutGenerationJob.js';
import AssistantConversation from '../models/AssistantConversation.js';
import AssistantSuggestion from '../models/AssistantSuggestion.js';
import AuditLog from '../models/AuditLog.js';
import BodyMeasurement from '../models/BodyMeasurement.js';
import CalendarEvent from '../models/CalendarEvent.js';
import CareAlert from '../models/CareAlert.js';
import CareLog from '../models/CareLog.js';
import CareTask from '../models/CareTask.js';
import Center from '../models/Center.js';
import ConsultationNote from '../models/ConsultationNote.js';
import CreditLedgerEntry from '../models/CreditLedgerEntry.js';
import CreditWallet from '../models/CreditWallet.js';
import CustomerProfile from '../models/CustomerProfile.js';
import DeviceSession from '../models/DeviceSession.js';
import Exercise from '../models/Exercise.js';
import FeatureFlag from '../models/FeatureFlag.js';
import FoodImage from '../models/FoodImage.js';
import Goal from '../models/Goal.js';
import InBodyRecord from '../models/InBodyRecord.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import Notification from '../models/Notification.js';
import MuscleGroup from '../models/MuscleGroup.js';
import NutritionLog from '../models/NutritionLog.js';
import NutritionPlan from '../models/NutritionPlan.js';
import PackageTemplate from '../models/PackageTemplate.js';
import PaymentOrder from '../models/PaymentOrder.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import ProgressReport from '../models/ProgressReport.js';
import PtPackage from '../models/PtPackage.js';
import Roadmap from '../models/Roadmap.js';
import TransferRequest from '../models/TransferRequest.js';
import User from '../models/User.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import WorkoutSession from '../models/WorkoutSession.js';
import WorkoutSessionDraft from '../models/WorkoutSessionDraft.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';

const LEGACY_CENTER = { name: '3S Gym', slug: '3s-gym' } as const;
const tenantModels: Model<any>[] = [
  AiNutritionGenerationJob, AiUsage, AiWorkoutGenerationJob, AssistantConversation,
  AssistantSuggestion, AuditLog, BodyMeasurement, CalendarEvent, CareAlert, CareLog,
  CareTask, ConsultationNote, CreditLedgerEntry, CreditWallet, CustomerProfile,
  DeviceSession, FoodImage, Goal, InBodyRecord, KnowledgeChunk, KnowledgeDocument, MuscleGroup,
  Notification, NutritionLog, NutritionPlan, PackageTemplate, PaymentOrder,
  ProgressPhoto, ProgressReport, PtPackage, Roadmap, TransferRequest, WorkoutPlan,
  WorkoutSession, WorkoutSessionDraft, WorkoutTemplate,
];

const missingCenterFilter = { $or: [{ centerId: { $exists: false } }, { centerId: null }] };

export async function upCenterTenancy({ dryRun }: { dryRun: boolean }) {
  const existingCenter = await Center.findOne({ slug: LEGACY_CENTER.slug }).lean();
  const usersMissingCenter = await User.countDocuments(missingCenterFilter);
  const legacyOwnedExercises = await Exercise.countDocuments({ ownerPtId: { $ne: null }, ...missingCenterFilter });
  const modelCounts = await Promise.all(tenantModels.map(async (model) => ({
    model: model.modelName,
    missingCenter: await model.countDocuments(missingCenterFilter),
  })));
  const totalDocumentsMissingCenter = modelCounts.reduce((sum, item) => sum + item.missingCenter, 0);
  const center = existingCenter || (!dryRun ? await Center.create(LEGACY_CENTER) : null);

  let usersModified = 0;
  let documentsModified = 0;
  if (!dryRun && center) {
    usersModified = (await User.updateMany(missingCenterFilter, { $set: { centerId: center._id } })).modifiedCount;
    for (const model of tenantModels) {
      documentsModified += (await model.updateMany(missingCenterFilter, { $set: { centerId: center._id } })).modifiedCount;
      await model.collection.createIndex({ centerId: 1 }, { name: 'centerId_1' });
    }
    await Exercise.updateMany({ ownerPtId: { $ne: null }, ...missingCenterFilter }, { $set: { centerId: center._id } });
    await Exercise.collection.createIndex({ centerId: 1 }, { name: 'centerId_1' });

    await CustomerProfile.collection.dropIndex('unique_customer_email').catch((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 27) return;
      throw error;
    });
    await CustomerProfile.collection.createIndex(
      { centerId: 1, email: 1 },
      { name: 'unique_customer_email_per_center', unique: true, partialFilterExpression: { email: { $type: 'string' } } },
    );
    const muscleGroupIndexes = await MuscleGroup.collection.indexes();
    for (const index of muscleGroupIndexes) {
      if (index.unique && Object.keys(index.key).length === 1 && index.key.name === 1) {
        if (index.name) await MuscleGroup.collection.dropIndex(index.name);
      }
    }
    await MuscleGroup.collection.createIndex(
      { centerId: 1, name: 1 },
      { name: 'unique_muscle_group_name_per_center', unique: true },
    );
    const featureFlagIndexes = await FeatureFlag.collection.indexes();
    for (const index of featureFlagIndexes) {
      if (index.unique && Object.keys(index.key).length === 1 && index.key.key === 1 && index.name) {
        await FeatureFlag.collection.dropIndex(index.name);
      }
    }
    await FeatureFlag.collection.createIndex(
      { centerId: 1, key: 1 },
      { name: 'unique_feature_key_per_center', unique: true },
    );
    const activityIndexes = await ActivityCalorie.collection.indexes();
    for (const index of activityIndexes) {
      if (index.unique && Object.keys(index.key).length === 1 && index.key.name === 1 && index.name) {
        await ActivityCalorie.collection.dropIndex(index.name);
      }
    }
    await ActivityCalorie.collection.createIndex(
      { centerId: 1, name: 1 },
      { name: 'unique_activity_name_per_center', unique: true },
    );

    const firstAdmin = await User.findOne({ role: 'ADMIN', centerId: center._id }).sort({ createdAt: 1, _id: 1 }).select({ _id: 1 }).lean();
    if (firstAdmin && !center.ownerAdminId) {
      await Center.updateOne({ _id: center._id, ownerAdminId: null }, { $set: { ownerAdminId: firstAdmin._id } });
    }
    await User.collection.createIndex({ centerId: 1 }, { name: 'centerId_1' });
  }

  return {
    center: { name: LEGACY_CENTER.name, slug: LEGACY_CENTER.slug, created: !existingCenter && !dryRun },
    counts: {
      users: { matched: usersMissingCenter, modified: dryRun ? usersMissingCenter : usersModified },
      tenantDocuments: { matched: totalDocumentsMissingCenter, modified: dryRun ? totalDocumentsMissingCenter : documentsModified },
      legacyOwnedExercises: { matched: legacyOwnedExercises, modified: dryRun ? legacyOwnedExercises : legacyOwnedExercises },
    },
    collections: modelCounts,
    note: 'Existing documents are assigned to the 3S Gym center; rerunning is safe. Tenant migration rollback is intentionally unsupported.',
  };
}

export async function downCenterTenancy() {
  throw new Error('Center tenancy cannot be rolled back safely after tenant accounts or data may have been created.');
}
