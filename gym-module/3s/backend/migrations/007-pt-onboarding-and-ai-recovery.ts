import Center from '../models/Center.js';
import AiUsage from '../models/AiUsage.js';
import GymInvitation from '../models/GymInvitation.js';
import CenterRequestLease from '../models/CenterRequestLease.js';
import { ensurePersonalWorkspaceFeatures } from '../services/personalWorkspaceService.js';

export async function upPtOnboarding({ dryRun }: { dryRun: boolean }) {
  const centers = await Center.find({ workspaceType: 'PERSONAL', status: 'ACTIVE' }).select('_id').lean();
  if (!dryRun) {
    await GymInvitation.createIndexes();
    await CenterRequestLease.createIndexes();
    await AiUsage.collection.createIndex({ status: 1, leaseExpiresAt: 1 }, { name: 'status_1_leaseExpiresAt_1' });
    for (const center of centers) await ensurePersonalWorkspaceFeatures(center._id);
  }
  return { counts: { personalWorkspaces: { matched: centers.length, modified: centers.length } } };
}
export async function downPtOnboarding() {
  throw new Error('Keep invitation history and feature defaults; deploy a forward migration for changes.');
}
