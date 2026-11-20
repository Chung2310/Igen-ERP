import { Types, type QueryFilter } from 'mongoose';
import CareAlert, { type ICareAlert } from '../models/CareAlert.js';
import CareLog from '../models/CareLog.js';
import CareTask from '../models/CareTask.js';
import CustomerProfile from '../models/CustomerProfile.js';
import PtPackage from '../models/PtPackage.js';
import WorkoutSession from '../models/WorkoutSession.js';
import InBodyRecord from '../models/InBodyRecord.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { createNotificationOnce } from './notificationService.js';
import { recordAudit } from './auditService.js';

async function upsertOpen(customerId: Types.ObjectId, ptId: Types.ObjectId, ruleKey: string, title: string, reason: string, dueAt: Date) {
  const alert = await CareAlert.findOneAndUpdate({ customerId, ruleKey, status: 'OPEN' }, { $setOnInsert: { customerId, ptId, ruleKey, title, reason, dueAt, status: 'OPEN' } }, { upsert: true, returnDocument: 'after' });
  await createNotificationOnce({ userId: ptId, type: 'CARE_ALERT_CREATED', title, message: reason, resourceType: 'careAlerts', resourceId: alert.id });
}
async function recalculate(user: AuthenticatedUser, asOf: Date) {
  const customers = await CustomerProfile.find(user.role === 'PT' ? { assignedPtId: user.id, status: 'ACTIVE' } : { status: 'ACTIVE' });
  for (const customer of customers) {
    const [lastWorkout, lastInBody, pkg] = await Promise.all([
      WorkoutSession.findOne({ customerId: customer._id, attendance: { $in: ['PRESENT', 'LATE'] } }).sort({ performedAt: -1 }).lean(),
      InBodyRecord.findOne({ customerId: customer._id }).sort({ measurementDate: -1 }).lean(),
      PtPackage.findOne({ customerId: customer._id, status: 'ACTIVE' }).sort({ endDate: 1 }).lean(),
    ]);
    const fiveDaysAgo = new Date(asOf.getTime() - 5 * 86_400_000); const thirtyDaysAgo = new Date(asOf.getTime() - 30 * 86_400_000); const sevenDaysAhead = new Date(asOf.getTime() + 7 * 86_400_000);
    if (!lastWorkout || lastWorkout.performedAt < fiveDaysAgo) await upsertOpen(customer._id, customer.assignedPtId, 'NO_WORKOUT_5_DAYS', 'Khách 5 ngày chưa tập', 'Không có check-in trong 5 ngày gần nhất.', asOf);
    if (pkg && pkg.remainingSessions <= 5) await upsertOpen(customer._id, customer.assignedPtId, 'LOW_PACKAGE_SESSIONS', 'Gói PT sắp hết', `Khách chỉ còn ${pkg.remainingSessions} buổi.`, asOf);
    if (!lastInBody || lastInBody.measurementDate < thirtyDaysAgo) await upsertOpen(customer._id, customer.assignedPtId, 'NO_INBODY_30_DAYS', 'Khách 30 ngày chưa đo InBody', 'Cần lên lịch đo InBody.', asOf);
    if (pkg && pkg.endDate >= asOf && pkg.endDate <= sevenDaysAhead) await upsertOpen(customer._id, customer.assignedPtId, 'PACKAGE_EXPIRES_7_DAYS', 'Gói PT sắp hết hạn', `Gói PT hết hạn vào ${pkg.endDate.toISOString().slice(0, 10)}.`, pkg.endDate);
  }
  return { processedCustomers: customers.length };
}
async function list(user: AuthenticatedUser, query: Record<string, unknown>) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 20); const filter: QueryFilter<ICareAlert> = {};
  if (user.role === 'PT') filter.ptId = new Types.ObjectId(user.id);
  if (typeof query.customerId === 'string') filter.customerId = new Types.ObjectId(query.customerId);
  if (query.status === 'OPEN' || query.status === 'RESOLVED') filter.status = query.status;
  const [items, total] = await Promise.all([CareAlert.find(filter).sort({ dueAt: 1 }).skip((page - 1) * limit).limit(limit).lean(), CareAlert.countDocuments(filter)]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function resolve(user: AuthenticatedUser, id: string, result: string) {
  const alert = await CareAlert.findOne({ _id: id, status: 'OPEN', ...(user.role === 'PT' ? { ptId: user.id } : {}) });
  if (!alert) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy cảnh báo đang mở.' });
  alert.status = 'RESOLVED'; alert.result = result; alert.resolvedAt = new Date(); alert.resolvedById = new Types.ObjectId(user.id); await alert.save();
  await CareLog.create({ customerId: alert.customerId, ptId: alert.ptId, kind: 'ALERT_RESOLVED', referenceId: alert._id, note: result });
  await recordAudit({ actor: user, action: 'CARE_ALERT_RESOLVED', resourceType: 'careAlert', resourceId: alert.id, customerId: alert.customerId });
  await createNotificationOnce({ userId: alert.ptId, type: 'CARE_ALERT_RESOLVED', title: 'Cảnh báo đã được xử lý', message: alert.title, resourceType: 'careAlerts', resourceId: alert.id });
  return alert;
}
async function createTask(user: AuthenticatedUser, payload: { customerId: string; title: string; dueAt: string }) {
  const customer = await CustomerProfile.findById(payload.customerId);
  if (!customer) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy khách hàng.' });
  if (user.role === 'PT' && String(customer.assignedPtId) !== user.id) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền quản lý khách hàng này.' });
  const task = await CareTask.create({ ...payload, assignedPtId: customer.assignedPtId, status: 'OPEN' });
  await recordAudit({ actor: user, action: 'CARE_TASK_CREATED', resourceType: 'careTask', resourceId: task.id, customerId: task.customerId });
  await createNotificationOnce({ userId: customer.assignedPtId, type: 'CARE_TASK_CREATED', title: 'Nhiệm vụ chăm sóc mới', message: task.title, resourceType: 'careTasks', resourceId: task.id });
  return task;
}
async function completeTask(user: AuthenticatedUser, id: string, result: string) {
  const task = await CareTask.findOne({ _id: id, status: 'OPEN', ...(user.role === 'PT' ? { assignedPtId: user.id } : {}) });
  if (!task) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy nhiệm vụ đang mở.' });
  task.status = 'DONE'; task.result = result; await task.save();
  await recordAudit({ actor: user, action: 'CARE_TASK_COMPLETED', resourceType: 'careTask', resourceId: task.id, customerId: task.customerId });
  await CareLog.create({ customerId: task.customerId, ptId: task.assignedPtId, kind: 'TASK_COMPLETED', referenceId: task._id, note: result });
  return task;
}
async function listTasks(user: AuthenticatedUser, query: Record<string, unknown>) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 20);
  const filter: Record<string, unknown> = user.role === 'PT' ? { assignedPtId: new Types.ObjectId(user.id) } : {};
  if (typeof query.customerId === 'string') filter.customerId = new Types.ObjectId(query.customerId);
  if (query.status === 'OPEN' || query.status === 'DONE') filter.status = query.status;
  const [items, total] = await Promise.all([CareTask.find(filter).sort({ dueAt: 1 }).skip((page - 1) * limit).limit(limit).lean(), CareTask.countDocuments(filter)]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getTask(user: AuthenticatedUser, id: string) {
  const task = await CareTask.findOne({ _id: id, ...(user.role === 'PT' ? { assignedPtId: user.id } : {}) });
  if (!task) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy nhiệm vụ chăm sóc.' });
  return task;
}
async function updateTask(user: AuthenticatedUser, id: string, payload: { title?: string; dueAt?: string }) {
  const task = await CareTask.findOne({ _id: id, status: 'OPEN', ...(user.role === 'PT' ? { assignedPtId: user.id } : {}) });
  if (!task) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy nhiệm vụ đang mở.' });
  if (payload.title !== undefined) task.title = payload.title;
  if (payload.dueAt !== undefined) task.dueAt = new Date(payload.dueAt);
  await task.save();
  await recordAudit({ actor: user, action: 'CARE_TASK_UPDATED', resourceType: 'careTask', resourceId: task.id, customerId: task.customerId });
  return task;
}
async function deleteTask(user: AuthenticatedUser, id: string) {
  const task = await CareTask.findOneAndDelete({ _id: id, status: 'OPEN', ...(user.role === 'PT' ? { assignedPtId: user.id } : {}) });
  if (!task) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy nhiệm vụ đang mở.' });
  await recordAudit({ actor: user, action: 'CARE_TASK_DELETED', resourceType: 'careTask', resourceId: task.id, customerId: task.customerId });
  return task;
}
async function listLogs(user: AuthenticatedUser, query: Record<string, unknown>) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 20);
  const filter: Record<string, unknown> = user.role === 'PT' ? { ptId: new Types.ObjectId(user.id) } : {};
  if (typeof query.customerId === 'string') filter.customerId = new Types.ObjectId(query.customerId);
  if (typeof query.kind === 'string') filter.kind = query.kind;
  const [items, total] = await Promise.all([CareLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), CareLog.countDocuments(filter)]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getToday(user: AuthenticatedUser, date: Date) {
  const start = new Date(date); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const owner = user.role === 'PT' ? { assignedPtId: new Types.ObjectId(user.id) } : {};
  const alertOwner = user.role === 'PT' ? { ptId: new Types.ObjectId(user.id) } : {};
  const [overdueTasks, dueTodayTasks, openAlerts] = await Promise.all([
    CareTask.find({ ...owner, status: 'OPEN', dueAt: { $lt: start } }).sort({ dueAt: 1 }).lean(),
    CareTask.find({ ...owner, status: 'OPEN', dueAt: { $gte: start, $lt: end } }).sort({ dueAt: 1 }).lean(),
    CareAlert.find({ ...alertOwner, status: 'OPEN' }).sort({ dueAt: 1 }).lean(),
  ]);
  return { date: start, overdueTasks, dueTodayTasks, openAlerts };
}
export { recalculate, list, resolve, createTask, completeTask, listTasks, getTask, updateTask, deleteTask, listLogs, getToday };
