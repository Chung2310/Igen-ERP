import mongoose from "mongoose";
import { RolePermissionModel } from "./role-permission.model";
import { UserModel } from "./user.model";

export const PERMISSION_REGISTRY_RESET_VERSION = "permission-registry-v2-clean-break";

type UpdateCollection = { updateMany(filter: object, update: object): Promise<{ modifiedCount?: number }> };
type MarkerCollection = {
  insertOne(document: object): Promise<unknown>;
  deleteOne(filter: object): Promise<unknown>;
};

export async function resetPermissionsForRegistryVersion(collections: {
  markers: MarkerCollection;
  roles: UpdateCollection;
  users: UpdateCollection;
} = {
  markers: mongoose.connection.collection("system_migrations") as unknown as MarkerCollection,
  roles: RolePermissionModel.collection as unknown as UpdateCollection,
  users: UserModel.collection as unknown as UpdateCollection,
}) {
  try {
    await collections.markers.insertOne({ _id: PERMISSION_REGISTRY_RESET_VERSION, appliedAt: new Date() });
  } catch (error: any) {
    if (error?.code === 11000) return { applied: false, rolesReset: 0, usersReset: 0 };
    throw error;
  }

  try {
    const roles = await collections.roles.updateMany({}, { $set: { permissions: [] } });
    const users = await collections.users.updateMany(
      { role: { $ne: "superadmin" } },
      { $set: { permissions: [] } },
    );
    return {
      applied: true,
      rolesReset: roles.modifiedCount ?? 0,
      usersReset: users.modifiedCount ?? 0,
    };
  } catch (error) {
    await collections.markers.deleteOne({ _id: PERMISSION_REGISTRY_RESET_VERSION });
    throw error;
  }
}
