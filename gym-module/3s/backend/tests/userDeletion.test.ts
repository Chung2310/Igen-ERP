import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it as baseIt } from 'vitest';
import CustomerProfile from '../models/CustomerProfile.js';
import Goal from '../models/Goal.js';
import InBodyRecord from '../models/InBodyRecord.js';
import NutritionPlan from '../models/NutritionPlan.js';
import User from '../models/User.js';
import Center from '../models/Center.js';
import { runWithCenter } from '../tenancy/centerContext.js';
const CENTER_ID = '111111111111111111111111';
const it = (name: string, work: () => Promise<void>) => baseIt(name, () => runWithCenter(CENTER_ID, work));
import WorkoutPlan from '../models/WorkoutPlan.js';
import { deleteManagedUser } from '../services/userService.js';

describe('managed PT deletion', () => {
  let mongo: MongoMemoryReplSet;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    await Center.create({ _id: CENTER_ID, name: 'Existing gym', slug: 'existing-gym', workspaceType: 'GYM' });
  });

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('deletes a PT and historical owned content in one transaction', async () => {
    const [admin, pt] = await User.create([
      { username: 'delete-pt-admin', password: 'hashed-password', role: 'ADMIN' },
      { username: 'delete-pt-target', password: 'hashed-password', role: 'PT' },
    ]);
    const orphanCustomerId = new mongoose.Types.ObjectId();
    await Promise.all([
      InBodyRecord.create({ customerId: orphanCustomerId, ptId: pt._id, measurementDate: new Date(), weight: 70 }),
      Goal.create({ customerId: orphanCustomerId, ptId: pt._id, type: 'FITNESS', title: 'Goal', deadline: new Date() }),
      WorkoutPlan.create({ customerId: orphanCustomerId, ptId: pt._id, title: 'Plan' }),
      NutritionPlan.create({
        customerId: orphanCustomerId,
        ptId: pt._id,
        title: 'Nutrition',
        targetCalories: 2000,
        macros: { protein: 120, carbs: 250, fat: 60 },
      }),
    ]);

    await deleteManagedUser({ id: admin.id, username: admin.username, role: admin.role, centerId: CENTER_ID }, pt.id);

    expect(await User.exists({ _id: pt._id })).toBeNull();
    expect(await Promise.all([
      InBodyRecord.countDocuments({ ptId: pt._id }),
      Goal.countDocuments({ ptId: pt._id }),
      WorkoutPlan.countDocuments({ ptId: pt._id }),
      NutritionPlan.countDocuments({ ptId: pt._id }),
    ])).toEqual([0, 0, 0, 0]);
  });

  it('returns a conflict instead of deleting a PT who still has customers', async () => {
    const [admin, pt] = await User.create([
      { username: 'delete-busy-pt-admin', password: 'hashed-password', role: 'ADMIN' },
      { username: 'delete-busy-pt-target', password: 'hashed-password', role: 'PT' },
    ]);
    await CustomerProfile.create({ assignedPtId: pt._id, fullName: 'Khach dang quan ly', phone: '0909000099' });

    await expect(deleteManagedUser(
      { id: admin.id, username: admin.username, role: admin.role, centerId: CENTER_ID },
      pt.id,
    )).rejects.toMatchObject({ status: 409 });
    expect(await User.exists({ _id: pt._id })).not.toBeNull();
  });
});
