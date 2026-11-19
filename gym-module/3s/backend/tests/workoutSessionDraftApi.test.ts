import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import app from '../app.js';
import User from '../models/User.js';
import CustomerProfile from '../models/CustomerProfile.js';
import FeatureFlag from '../models/FeatureFlag.js';
import WorkoutSession from '../models/WorkoutSession.js';
import WorkoutSessionDraft from '../models/WorkoutSessionDraft.js';
import Center from '../models/Center.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';
let mongo: MongoMemoryReplSet;
let token: string;
let customerId: string;
let ptId: mongoose.Types.ObjectId;
let centerId: mongoose.Types.ObjectId;
const body = { revision: 0, idempotencyKey: 'draft-key', form: { results: [{ sets: [{ reps: '', weight: '0' }] }], notes: 'unfinished', progressPhotos: ['https://example.com/photo.jpg'], customerSignature: 'signature' }, plan: { version: 1, sessions: [] } };
const endpoint = () => `/api/workout-session-drafts/${customerId}`;
const patch = (data: object) => request(app).patch(endpoint()).set('Authorization', `Bearer ${token}`).send(data);
const get = (auth = token) => request(app).get(endpoint()).set('Authorization', `Bearer ${auth}`);
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await WorkoutSessionDraft.init();
});
beforeEach(async () => {
  await runWithSystemCenterAccess(() => Promise.all([User.deleteMany({}), CustomerProfile.deleteMany({}), FeatureFlag.deleteMany({}), WorkoutSessionDraft.deleteMany({}), WorkoutSession.deleteMany({}), Center.deleteMany({})]));
  const center = await runWithSystemCenterAccess(() => Center.create({ name: 'Draft Test Gym', slug: `draft-test-${Date.now()}-${Math.random()}` }));
  centerId = center._id;
  const pt = await runWithCenter(String(centerId), () => User.create({ username: 'draft-pt', password: 'hashed', role: 'PT', centerId }));
  ptId = pt._id;
  token = jwt.sign({ id: pt.id, role: 'PT' }, process.env.JWT_SECRET || 'secret_key');
  const customer = await runWithCenter(String(centerId), async () => {
    const [created] = await CustomerProfile.create([{ assignedPtId: pt._id, fullName: 'Draft Customer', phone: '0901234567' }]);
    return created;
  });
  customerId = customer.id;
  await runWithCenter(String(centerId), () => FeatureFlag.create({ key: 'PROGRESS', enabled: true, roles: ['ADMIN', 'PT'], centerId }));
});
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
it('stores incomplete inputs and attachments, reopens and updates without creating a workout', async () => {
  const saved = await patch(body);
  expect(saved.status).toBe(200);
  expect(saved.body.data.revision).toBe(1);
  expect((await get()).body.data.form).toEqual(body.form);
  const updated = await patch({ ...body, revision: 1, form: { ...body.form, notes: 'continued' } });
  expect(updated.status).toBe(200);
  expect(updated.body.data.revision).toBe(2);
  expect((await get()).body.data.form.notes).toBe('continued');
  expect(await runWithCenter(String(centerId), () => WorkoutSession.countDocuments())).toBe(0);
});
it('enforces authentication, customer assignment and private ownership', async () => {
  expect((await request(app).get(endpoint())).status).toBe(401);
  await patch(body);
  for (const role of ['PT', 'CUSTOMER', 'ADMIN'] as const) {
    const user = await runWithCenter(String(centerId), () => User.create({ username: `other-${role}`, password: 'hashed', role, centerId }));
    const auth = jwt.sign({ id: user.id, role }, process.env.JWT_SECRET || 'secret_key');
    const result = await get(auth);
    expect(result.status).toBe(role === 'PT' ? 404 : role === 'CUSTOMER' ? 403 : 200);
    if (role === 'ADMIN') expect(result.body.data).toBeNull();
  }
});
it('rejects concurrent creation and stale edits or deletion', async () => {
  const created = await Promise.all([patch(body), patch(body)]);
  expect(created.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await patch({ ...body, revision: 1 })).status).toBe(200);
  expect((await patch({ ...body, revision: 1 })).status).toBe(409);
  expect((await request(app).delete(`${endpoint()}?revision=1`).set('Authorization', `Bearer ${token}`)).status).toBe(409);
  expect((await request(app).delete(`${endpoint()}?revision=2`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
  expect((await get()).body.data).toBeNull();
});
it('keeps the pending retry payload and retires a draft after a successful final save', async () => {
  const pendingPayload = { customerId, idempotencyKey: body.idempotencyKey, exerciseResults: [] };
  expect((await patch({ ...body, pendingPayload: { ...pendingPayload, customerId: 'wrong' } })).status).toBe(400);
  expect((await patch({ ...body, pendingPayload })).status).toBe(200);
  expect((await get()).body.data.pendingPayload).toEqual(pendingPayload);
  await runWithSystemCenterAccess(() => WorkoutSession.collection.insertOne({ centerId, ptId, customerId: new mongoose.Types.ObjectId(customerId), idempotencyKey: body.idempotencyKey }));
  expect((await get()).body.data).toBeNull();
  expect(await runWithCenter(String(centerId), () => WorkoutSessionDraft.countDocuments())).toBe(0);
  expect((await patch(body)).status).toBe(409);
});
