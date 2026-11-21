import mongoose from 'mongoose';
import { gymCollection } from '../config/collectionNamespace.js';

export const SUPER_ADMIN_INDEX = 'unique_super_admin_role';

export async function upSuperAdminRole({ dryRun = false } = {}) {
  const collection = mongoose.connection.collection(gymCollection('users'));
  const exists = await collection.indexExists(SUPER_ADMIN_INDEX);
  if (!dryRun && !exists) {
    await collection.createIndex(
      { role: 1 },
      {
        name: SUPER_ADMIN_INDEX,
        unique: true,
        partialFilterExpression: { role: 'SUPER_ADMIN' },
      },
    );
  }
  return { counts: { indexes: { matched: exists ? 0 : 1, modified: exists || dryRun ? 0 : 1 } } };
}

export async function downSuperAdminRole() {
  const collection = mongoose.connection.collection(gymCollection('users'));
  if (await collection.indexExists(SUPER_ADMIN_INDEX)) await collection.dropIndex(SUPER_ADMIN_INDEX);
}
