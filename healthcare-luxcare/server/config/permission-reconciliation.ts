import { logger } from "./logger";
import { PermissionModel } from "../model/permission.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { UserModel } from "../model/user.model";
import { PERMISSION_CATALOG, PERMISSION_CODES, normalizePermissions } from "../../shared/permissions";

type PermissionRecord = { _id: unknown; permissions?: string[] };

export function buildPermissionArrayUpdates(records: readonly PermissionRecord[]) {
  return records.flatMap((record) => {
    const current = Array.isArray(record.permissions) ? record.permissions : [];
    const normalized = normalizePermissions(current, { allowWildcard: true });
    if (current.length === normalized.permissions.length && current.every((code, index) => code === normalized.permissions[index])) return [];
    return [{ id: String(record._id), permissions: normalized.permissions, removed: normalized.unknown }];
  });
}

async function normalizeStoredArrays(model: any) {
  const records = await model.find({ permissions: { $exists: true } }).select("_id permissions").lean();
  const updates = buildPermissionArrayUpdates(records);
  if (updates.length) {
    await model.bulkWrite(updates.map((update) => ({
      updateOne: { filter: { _id: update.id }, update: { $set: { permissions: update.permissions } } },
    })));
  }
  return { updated: updates.length, removed: updates.reduce((count, update) => count + update.removed.length, 0) };
}

export async function reconcilePermissions() {
  if (PERMISSION_CATALOG.length) {
    await PermissionModel.bulkWrite(PERMISSION_CATALOG.map((entry) => ({
      updateOne: {
        filter: { code: entry.code },
        update: { $set: { code: entry.code, name: entry.label, module: entry.code.split(":")[0], description: entry.description } },
        upsert: true,
      },
    })));
  }
  const deleted = await PermissionModel.deleteMany({ code: { $nin: PERMISSION_CODES } });
  const roles = await normalizeStoredArrays(RolePermissionModel);
  const users = await normalizeStoredArrays(UserModel);
  const summary = { catalog: PERMISSION_CATALOG.length, deleted: deleted.deletedCount ?? 0, roles, users };
  logger.info("[Backend Database] Đã chuẩn hóa danh mục quyền:", summary);
  return summary;
}
