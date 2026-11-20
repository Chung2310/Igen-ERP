import { Types, type ClientSession } from 'mongoose';
import FeatureFlag, { FEATURE_KEYS } from '../models/FeatureFlag.js';
import type { UserRole } from '../models/User.js';

export async function ensurePersonalWorkspaceFeatures(centerId: Types.ObjectId, session?: ClientSession, roles: UserRole[] = ['PT']) {
  // Explicit center settings win over defaults and are never overwritten.
  for (const key of FEATURE_KEYS) {
    await FeatureFlag.updateOne({ centerId, key }, {
      $setOnInsert: { centerId, key, enabled: true, roles, pilotUserIds: [] },
    }, { upsert: true, session });
  }
}
