import Center from '../models/Center.js';

export async function upCenterWorkspaceTypes({ dryRun }: { dryRun: boolean }) {
  const missingWorkspaceType = { $or: [{ workspaceType: { $exists: false } }, { workspaceType: null }] };
  const legacyCenterCount = await Center.countDocuments(missingWorkspaceType);
  const personalCenterCount = await Center.countDocuments({ workspaceType: 'PERSONAL' });
  if (!dryRun) {
    await Center.updateMany(missingWorkspaceType, { $set: { workspaceType: 'GYM' } });
    await Center.collection.createIndex({ workspaceType: 1 }, { name: 'workspaceType_1' });
    await Center.collection.createIndex(
      { ownerPtId: 1 },
      {
        name: 'unique_personal_center_owner_pt',
        unique: true,
        partialFilterExpression: { workspaceType: 'PERSONAL', ownerPtId: { $type: 'objectId' } },
      },
    );
  }
  return {
    counts: { centersBackfilledAsGym: { matched: legacyCenterCount, modified: legacyCenterCount } },
    personalCenterCount,
  };
}

export async function downCenterWorkspaceTypes() {
  // Workspace type is required for tenant-aware registration and deletion; keep it on rollback.
}
