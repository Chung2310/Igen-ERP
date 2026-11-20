import { Types } from 'mongoose';
import CustomerProfile from '../models/CustomerProfile.js';
import NutritionLog, { type INutritionLog } from '../models/NutritionLog.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';

async function assertCustomerAccess(user: AuthenticatedUser, customerId: string) {
  const customer = await CustomerProfile.findById(customerId);
  if (!customer) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy khách hàng.' });
  if (user.role === 'PT' && String(customer.assignedPtId) !== user.id) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền quản lý khách hàng này.' });
}

async function create(user: AuthenticatedUser, payload: Omit<INutritionLog, 'ptId' | 'customerId'> & { customerId: string }) {
  await assertCustomerAccess(user, payload.customerId);
  return NutritionLog.create({ ...payload, ptId: user.id });
}

async function list(user: AuthenticatedUser, query: Record<string, unknown>) {
  const customerId = String(query.customerId);
  await assertCustomerAccess(user, customerId);
  const page = Number(query.page || 1); const limit = Number(query.limit || 20);
  const filter: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) };
  const dateFilter: { $gte?: Date; $lt?: Date } = {};
  if (typeof query.from === 'string') dateFilter.$gte = new Date(`${query.from}T00:00:00.000Z`);
  if (typeof query.to === 'string') { const end = new Date(`${query.to}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1); dateFilter.$lt = end; }
  if (Object.keys(dateFilter).length) filter.loggedAt = dateFilter;
  if (query.type === 'FOOD' || query.type === 'ACTIVITY') filter.type = query.type;
  const [items, total, summaryRows] = await Promise.all([
    NutritionLog.find(filter).sort({ loggedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    NutritionLog.countDocuments(filter),
    NutritionLog.aggregate([
      { $match: filter },
      { $group: { _id: null, consumedCalories: { $sum: { $cond: [{ $eq: ['$type', 'FOOD'] }, '$calories', 0] } }, burnedCalories: { $sum: { $cond: [{ $eq: ['$type', 'ACTIVITY'] }, '$calories', 0] } }, protein: { $sum: '$macros.protein' }, carbs: { $sum: '$macros.carbs' }, fat: { $sum: '$macros.fat' } } },
    ]),
  ]);
  const totals = summaryRows[0] || { consumedCalories: 0, burnedCalories: 0, protein: 0, carbs: 0, fat: 0 };
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, summary: { ...totals, netCalories: totals.consumedCalories - totals.burnedCalories, _id: undefined } };
}

async function getOwned(user: AuthenticatedUser, id: string) {
  const item = await NutritionLog.findById(id);
  if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy nhật ký dinh dưỡng.' });
  await assertCustomerAccess(user, String(item.customerId));
  return item;
}

async function update(user: AuthenticatedUser, id: string, payload: Partial<INutritionLog>) {
  const item = await getOwned(user, id);
  for (const field of ['loggedAt', 'type', 'name', 'calories', 'macros', 'durationMinutes', 'notes'] as const) if (payload[field] !== undefined) item.set(field, payload[field]);
  return item.save();
}

async function remove(user: AuthenticatedUser, id: string) {
  const item = await getOwned(user, id);
  await item.deleteOne();
}

export { create, list, update, remove };
