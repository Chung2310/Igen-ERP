import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import FeatureFlag, { FEATURE_KEYS } from '../models/FeatureFlag.js';
import User, { type UserRole } from '../models/User.js';
import Center from '../models/Center.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';

let mongo: MongoMemoryReplSet;
let centerId: mongoose.Types.ObjectId;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});
beforeEach(async () => {
  await runWithSystemCenterAccess(() => mongoose.connection.db!.dropDatabase());
  const center = await runWithSystemCenterAccess(() => Center.create({ name: 'Feature Test Gym', slug: `feature-test-${Date.now()}-${Math.random()}` }));
  centerId = center._id;
});
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
async function tokenFor(role: UserRole) {
  const user = await runWithCenter(String(centerId), () => User.create({ username: `features-${role}`, password: 'hashed', role, centerId }));
  return jwt.sign({ id: user.id, role }, process.env.JWT_SECRET || 'secret_key');
}

describe('Feature configuration administration', () => {
  it('requires authentication and rejects PT and customer access', async () => {
    expect((await request(app).get('/api/features')).status).toBe(401);
    for (const role of ['PT', 'CUSTOMER'] as const) {
      const token = await tokenFor(role);
      expect((await request(app).get('/api/features').set('Authorization', `Bearer ${token}`)).status).toBe(403);
      expect((await request(app).patch('/api/features/CARE').set('Authorization', `Bearer ${token}`).send({ enabled: true, roles: ['PT'], pilotUserIds: [] })).status).toBe(403);
    }
  });
  it.each(['ADMIN', 'SUPER_ADMIN'] as const)('returns stored roles and pilots for %s even when its effective flag is false', async (role) => {
    const token = await tokenFor(role);
    const pilotUser = await runWithCenter(String(centerId), () => User.create({ username: `pilot-${role}`, password: 'hashed', role: 'PT', centerId }));
    const pilot = pilotUser.id;
    await runWithCenter(String(centerId), () => FeatureFlag.create({ key: 'CARE', enabled: true, roles: ['CUSTOMER'], pilotUserIds: [pilot], centerId }));
    const response = await request(app).get('/api/features').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(FEATURE_KEYS.length);
    expect(response.body.data.find((f: { key: string }) => f.key === 'CARE')).toEqual({ key: 'CARE', enabled: true, roles: ['CUSTOMER'], pilotUserIds: [pilot] });
    expect(response.body.data.find((f: { key: string }) => f.key === 'ROADMAP')).toEqual({ key: 'ROADMAP', enabled: false, roles: [], pilotUserIds: [] });
    const effective = await request(app).get('/api/features/me').set('Authorization', `Bearer ${token}`);
    expect(effective.body.data.CARE).toBe(false);
    const update = await request(app).patch('/api/features/CARE').set('Authorization', `Bearer ${token}`).send({ enabled: false, roles: ['CUSTOMER'], pilotUserIds: [pilot] });
    expect(update.status).toBe(200);
    const saved = await FeatureFlag.findOne({ key: 'CARE' }).lean();
    expect(saved?.roles).toEqual(['CUSTOMER']);
    expect(saved?.pilotUserIds.map(String)).toEqual([pilot]);
  });
});
