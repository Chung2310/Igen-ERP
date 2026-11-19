import type { QueryFilter, Model, Types } from 'mongoose';
import CustomerProfile from '../models/CustomerProfile.js';
import InBodyRecord from '../models/InBodyRecord.js';
import Goal from '../models/Goal.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import NutritionPlan from '../models/NutritionPlan.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import type { ContentResource } from '../routes/contentRouteFactory.js';
import { recordAudit } from './auditService.js';
import ProgressReport from '../models/ProgressReport.js';

interface ContentBase {
  customerId: Types.ObjectId;
  ptId: Types.ObjectId;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: Date | null;
  version: number;
}

interface ContentPayload extends Record<string, unknown> { customerId: string }
interface ContentQuery { page?: unknown; limit?: unknown; customerId?: unknown; status?: unknown; sortBy?: unknown; sortOrder?: unknown }
type ContentModel = Model<ContentBase>;

const models: Record<ContentResource, ContentModel> = {
  inbody: InBodyRecord as unknown as ContentModel,
  goals: Goal as unknown as ContentModel,
  workoutPlans: WorkoutPlan as unknown as ContentModel,
  nutritionPlans: NutritionPlan as unknown as ContentModel,
};

function appError(message: string, status = 400) {
  const code = status === 404 ? ERROR_CODES.NOT_FOUND : status === 403 ? ERROR_CODES.AUTHORIZATION : ERROR_CODES.VALIDATION;
  return new AppError({ message, status, code });
}

async function assertCustomerAccess(user: AuthenticatedUser, customerId: string | Types.ObjectId) {
  const filter: QueryFilter<{ assignedPtId: Types.ObjectId }> & { _id: string | Types.ObjectId } = { _id: customerId };
  if (user.role === 'PT') filter.assignedPtId = new (await import('mongoose')).Types.ObjectId(user.id);
  const customer = await CustomerProfile.findOne(filter);
  if (!customer) throw appError('Không tìm thấy khách hàng.', 404);
  return customer;
}

async function createContent(resource: ContentResource, user: AuthenticatedUser, payload: ContentPayload) {
  const Model = models[resource];
  await assertCustomerAccess(user, payload.customerId);
  return Model.create({ ...payload, ptId: user.id, status: 'DRAFT', publishedAt: null });
}

async function updateContent(resource: ContentResource, user: AuthenticatedUser, id: string, payload: Record<string, unknown>) {
  const Model = models[resource];
  const item = await Model.findById(id);
  if (!item) throw appError('Không tìm thấy nội dung.', 404);
  await assertCustomerAccess(user, item.customerId);
  const protectedFields = new Set(['_id', 'ptId', 'status', 'publishedAt', 'version', 'createdAt', 'updatedAt']);
  for (const [field, value] of Object.entries(payload)) if (!protectedFields.has(field)) item.set(field, value);
  if (item.status === 'PUBLISHED') {
    item.status = 'DRAFT';
    item.publishedAt = null;
    item.version += 1;
  }
  return item.save();
}

async function deleteContent(resource: ContentResource, user: AuthenticatedUser, id: string) {
  const item = await models[resource].findById(id);
  if (!item) throw appError('Không tìm thấy nội dung.', 404);
  await assertCustomerAccess(user, item.customerId);
  await item.deleteOne();
}

async function listContent(resource: ContentResource, user: AuthenticatedUser, query: ContentQuery) {
  const Model = models[resource];
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const filter: QueryFilter<ContentBase> = {};
  if (typeof query.customerId === 'string') filter.customerId = new (await import('mongoose')).Types.ObjectId(query.customerId);
  if (query.status === 'DRAFT' || query.status === 'PUBLISHED') filter.status = query.status;
  if (user.role === 'PT') {
    const ids = await CustomerProfile.find({ assignedPtId: user.id }).distinct('_id');
    filter.customerId = typeof query.customerId === 'string' && ids.some((id) => String(id) === query.customerId)
      ? new (await import('mongoose')).Types.ObjectId(query.customerId)
      : { $in: ids };
  }
  const sortOption: Record<string, -1 | 1> = query.sortBy
    ? { [String(query.sortBy)]: query.sortOrder === 'asc' ? 1 : -1 }
    : resource === 'nutritionPlans'
    ? { startDate: -1, createdAt: -1 }
    : resource === 'inbody'
    ? { measurementDate: -1, createdAt: -1 }
    : { createdAt: -1 };
  const [items, total] = await Promise.all([
    Model.find(filter).populate('customerId', 'fullName phone').sort(sortOption).skip((page - 1) * limit).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function setPublication(resource: ContentResource, user: AuthenticatedUser, id: string, publish: boolean) {
  const item = await models[resource].findById(id);
  if (!item) throw appError('Không tìm thấy nội dung.', 404);
  await assertCustomerAccess(user, item.customerId);
  item.status = publish ? 'PUBLISHED' : 'DRAFT';
  item.publishedAt = publish ? new Date() : null;
  const saved = await item.save();
  await recordAudit({
    actor: user,
    action: publish ? 'CONTENT_PUBLISHED' : 'CONTENT_UNPUBLISHED',
    resourceType: resource,
    resourceId: id,
    customerId: item.customerId,
  });
  return saved;
}

async function getContent(resource: ContentResource, user: AuthenticatedUser, id: string) {
  const item = await models[resource].findById(id).lean();
  if (!item) throw appError('Không tìm thấy nội dung.', 404);
  await assertCustomerAccess(user, item.customerId);
  return item;
}

async function getMyContent(user: AuthenticatedUser) {
  const customer = await CustomerProfile.findOne({ userId: user.id });
  if (!customer) throw appError('Không tìm thấy hồ sơ khách hàng.', 404);
  const filter = { customerId: customer.id, status: 'PUBLISHED' as const };
  const [inbody, goals, workoutPlans, nutritionPlans, progressReports] = await Promise.all([
    InBodyRecord.find(filter).sort({ measurementDate: -1 }).lean(),
    Goal.find(filter).sort({ createdAt: -1 }).lean(),
    WorkoutPlan.find(filter).sort({ createdAt: -1 }).lean(),
    NutritionPlan.find(filter).sort({ createdAt: -1 }).lean(),
    ProgressReport.find(filter).sort({ periodEnd: -1 }).lean(),
  ]);
  return { profile: customer, inbody, goals, workoutPlans, nutritionPlans, progressReports };
}

export { createContent, updateContent, deleteContent, listContent, getContent, setPublication, getMyContent };
