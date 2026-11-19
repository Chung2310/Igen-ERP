import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it as baseIt, vi } from 'vitest';
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('../services/aiProvider.js', () => ({ generateNutritionDraft: generate, generateWorkoutDraft: vi.fn(), generateRoadmapDraft: vi.fn(), generateNutritionAnalysis: vi.fn() }));
import app from '../app.js';
import User from '../models/User.js';
import Center from '../models/Center.js';
import { runWithCenter } from '../tenancy/centerContext.js';
const CENTER_ID = '222222222222222222222222';
const it = (name: string, work: () => Promise<void>) => baseIt(name, () => runWithCenter(CENTER_ID, work));
import Customer from '../models/CustomerProfile.js';
import FeatureFlag from '../models/FeatureFlag.js';
import Job from '../models/AiNutritionGenerationJob.js';
import Plan from '../models/NutritionPlan.js';
import { createNutritionDraft } from '../services/contentDraftService.js';
let mongo: MongoMemoryReplSet;
let token: string;
let customerId: string;
let userId: string;
beforeAll(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri()); await Job.init(); });
beforeEach(async () => runWithCenter(CENTER_ID, async () => {
  await Center.updateOne({ _id: CENTER_ID }, { $setOnInsert: { name: 'Nutrition gym', slug: 'nutrition-gym' } }, { upsert: true });
  await Promise.all([User.deleteMany({}), Customer.deleteMany({}), FeatureFlag.deleteMany({}), Job.deleteMany({}), Plan.deleteMany({})]);
  const user = await User.create({ username: 'nutrition-test', password: 'hashed', role: 'PT' });
  userId = user.id; token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret_key');
  customerId = (await Customer.create({ assignedPtId: user.id, fullName: 'Test', phone: '0900000000' })).id;
  await FeatureFlag.create({ key: 'NUTRITION_AI', enabled: true, roles: ['PT'] });
  generate.mockReset();
}));
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
function output(days: number) { return JSON.stringify({ title: 'Test plan', targetCalories: 1800, macros: { protein: 130, carbs: 190, fat: 60 }, dailyPlans: Array.from({ length: days }, () => ({ meals: [{ name: 'Lunch', items: [{ name: 'Rice' }] }] })) }); }
it('responds before slow AI finishes, protects ownership, and deduplicates retries', async () => {
  let release!: (value: string) => void;
  generate.mockImplementation(() => new Promise<string>(resolve => { release = resolve; }));
  const body = { customerId, request: 'Thực đơn 7 ngày', durationDays: 7, idempotencyKey: 'nutrition-test-key' };
  const disclosure = await request(app).post('/api/content-drafts/nutrition/jobs').set('Authorization', `Bearer ${token}`).send(body);
  expect(disclosure.status).toBe(428);
  const consent = disclosure.body.consentVersion;
  const first = await request(app).post('/api/content-drafts/nutrition/jobs').set('Authorization', `Bearer ${token}`).set('X-AI-Consent', consent).send(body);
  expect(first.status).toBe(202);
  await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  const id = first.body.data.id;
  const second = await request(app).post('/api/content-drafts/nutrition/jobs').set('Authorization', `Bearer ${token}`).set('X-AI-Consent', consent).send(body);
  expect(second.body.data.id).toBe(id);
  const changed = await request(app).post('/api/content-drafts/nutrition/jobs').set('Authorization', `Bearer ${token}`).set('X-AI-Consent', consent).send({ ...body, request: 'different request' });
  expect(changed.status).toBe(409);
  const other = await User.create({ username: 'other-pt', password: 'hashed', role: 'PT' });
  const otherToken = jwt.sign({ id: other.id }, process.env.JWT_SECRET || 'secret_key');
  expect((await request(app).get(`/api/content-drafts/nutrition/jobs/${id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(404);
  release(output(7));
  await vi.waitFor(async () => {
    const job = await Job.findById(id);
    expect(job?.status, JSON.stringify(job?.error)).toBe('SUCCEEDED');
  }, { timeout: 5000 });
  const done = await request(app).get(`/api/content-drafts/nutrition/jobs/${id}`).set('Authorization', `Bearer ${token}`);
  expect(done.body.data.result.dailyPlans).toHaveLength(7);
  expect(await Plan.countDocuments()).toBe(1);
  expect(generate).toHaveBeenCalledTimes(1);
});
it('generates exact 14 days across bounded batches and persists a single draft', async () => {
  generate.mockResolvedValue(output(7));
  const plan = await createNutritionDraft({ id: userId, role: 'PT', centerId: CENTER_ID }, customerId, 'Thực đơn 14 ngày', 'test-14', undefined, 14);
  expect(plan.dailyPlans).toHaveLength(14);
  expect(plan.durationDays).toBe(14);  const dailyPlans = plan.dailyPlans.map((day: any, index: number) => ({
    ...day, dayNumber: index + 1, dayOfWeek: 'Thứ Hai', date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  }));
  const saved = await request(app).patch(`/api/nutrition-plans/${plan.id}`).set('Authorization', `Bearer ${token}`).send({
    customerId, title: 'Thực đơn AI đã kiểm tra', targetCalories: 1800, macros: { protein: 130, carbs: 190, fat: 60 },
    durationDays: 14, startDate: '2026-09-01', endDate: '2026-09-14', menu: [], dailyPlans,
  });
  expect(saved.status).toBe(200);
  expect(saved.body.data.dailyPlans).toHaveLength(14);
  const published = await request(app).patch(`/api/nutrition-plans/${plan.id}/publish`).set('Authorization', `Bearer ${token}`);
  expect(published.status).toBe(200);
  expect(published.body.data.status).toBe('PUBLISHED');
  expect((await Plan.findById(plan.id))?.dailyPlans).toHaveLength(14);
  expect(plan.status).toBe('DRAFT');
  expect(generate).toHaveBeenCalledTimes(2);
  expect(generate.mock.calls[1][1]).toContain('dayNumber từ 8 đến 14');
  expect(await Plan.countDocuments()).toBe(1);
});
it('handles a partial last week and refuses incomplete AI output', async () => {
  generate.mockResolvedValueOnce(output(7)).mockResolvedValueOnce(output(3));
  const plan = await createNutritionDraft({ id: userId, role: 'PT', centerId: CENTER_ID }, customerId, 'Thực đơn 10 ngày', 'test-10', undefined, 10);
  expect(plan.dailyPlans).toHaveLength(10);
  generate.mockResolvedValue(output(2));
  await expect(createNutritionDraft({ id: userId, role: 'PT', centerId: CENTER_ID }, customerId, 'Thực đơn 7 ngày', 'bad')).rejects.toThrow('thiếu ngày');
  expect(await Plan.countDocuments()).toBe(1);
});
it('accepts dailyPlans on create and rejects malformed schedules without opening system fields', async () => {
  const base = { customerId, title: 'Thực đơn', targetCalories: 1800, macros: { protein: 130, carbs: 190, fat: 60 } };
  const created = await request(app).post('/api/nutrition-plans').set('Authorization', `Bearer ${token}`).send({ ...base, dailyPlans: [{ dayNumber: 1, meals: [{ title: 'Sáng', items: [{ name: 'Trứng', calories: 150 }] }] }] });
  expect(created.status).toBe(201);
  expect(created.body.data.dailyPlans[0].meals[0].items[0].name).toBe('Trứng');
  for (const invalid of [{ dailyPlans: 'invalid' }, { dailyPlans: [{ dayNumber: 32, meals: [] }] }, { dailyPlans: [{ meals: 'invalid' }] }, { dailyPlans: [], status: 'PUBLISHED' }]) {
    const result = await request(app).patch(`/api/nutrition-plans/${created.body.data._id}`).set('Authorization', `Bearer ${token}`).send(invalid);
    expect(result.status).toBe(400);
  }
});
