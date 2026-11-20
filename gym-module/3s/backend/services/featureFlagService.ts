import FeatureFlag, { FEATURE_KEYS, type FeatureKey } from '../models/FeatureFlag.js';
import type { UserRole } from '../models/User.js';
import type { AuthenticatedUser } from '../types/express.js';
import { Types } from 'mongoose';
import User from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { hasRequiredRole } from './roles.js';

interface UpdateFeaturePayload {
  enabled: boolean;
  roles: UserRole[];
  pilotUserIds?: string[];
}

async function updateFeature(actor: AuthenticatedUser, key: FeatureKey, payload: UpdateFeaturePayload) {
  if (!actor.centerId) throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Tài khoản chưa được gán trung tâm.' });
  const pilotUserIds = (payload.pilotUserIds ?? []).map((id) => new Types.ObjectId(id));
  if (pilotUserIds.length) {
    const matches = await User.find({ _id: { $in: pilotUserIds }, centerId: actor.centerId }).distinct('_id');
    if (matches.length !== pilotUserIds.length) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Danh sách tài khoản pilot phải thuộc trung tâm hiện tại.' });
  }
  return FeatureFlag.findOneAndUpdate(
    { key, centerId: new Types.ObjectId(actor.centerId) },
    { $set: { enabled: payload.enabled, roles: payload.roles, pilotUserIds }, $setOnInsert: { key, centerId: new Types.ObjectId(actor.centerId) } },
    { returnDocument: 'after', upsert: true, runValidators: true },
  ).lean();
}

async function isEnabled(key: FeatureKey, user: AuthenticatedUser): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key, centerId: user.centerId }).lean()
    || await FeatureFlag.findOne({ key, $or: [{ centerId: null }, { centerId: { $exists: false } }] }).lean();
  if (!flag?.enabled) return false;
  if (hasRequiredRole(user.role, flag.roles)) return true;
  return flag.pilotUserIds.some((id) => String(id) === user.id);
}

async function getFeaturesForUser(user: AuthenticatedUser): Promise<Record<FeatureKey, boolean>> {
  const entries = await Promise.all(FEATURE_KEYS.map(async (key) => [key, await isEnabled(key, user)] as const));
  return Object.fromEntries(entries) as Record<FeatureKey, boolean>;
}


// Admin clients need stored permissions, not the effective flags of the current actor.
async function listFeatures(user: AuthenticatedUser) {
  if (!user.centerId) throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Tài khoản chưa được gán trung tâm.' });
  const stored = await FeatureFlag.find({ $or: [{ centerId: user.centerId }, { centerId: null }, { centerId: { $exists: false } }] }).lean();
  const candidatePilotIds = stored.flatMap((flag) => flag.pilotUserIds.map(String));
  const visiblePilotIds = new Set(candidatePilotIds.length
    ? (await User.find({ _id: { $in: candidatePilotIds }, centerId: user.centerId }).distinct('_id')).map(String)
    : []);
  return FEATURE_KEYS.map((key) => {
    const flag = stored.find((item) => item.key === key && String(item.centerId || '') === user.centerId)
      || stored.find((item) => item.key === key && !item.centerId);
    return {
      key,
      enabled: flag?.enabled ?? false,
      roles: flag?.roles ?? [],
      pilotUserIds: (flag?.pilotUserIds ?? []).map(String).filter((id) => visiblePilotIds.has(id)),
    };
  });
}
export { getFeaturesForUser, isEnabled, updateFeature, listFeatures };
