import { Types, type QueryFilter } from 'mongoose';
import CustomerProfile, { type ICustomerProfile } from '../models/CustomerProfile.js';
import PtPackage, { type IPtPackage } from '../models/PtPackage.js';
import User from '../models/User.js';
import InBodyRecord from '../models/InBodyRecord.js';
import Goal from '../models/Goal.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import NutritionPlan from '../models/NutritionPlan.js';
import TransferRequest from '../models/TransferRequest.js';
import ConsultationNote from '../models/ConsultationNote.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import * as userService from './userService.js';
import type { UserPayload } from './userService.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { isAdminRole } from './roles.js';
import { withTransaction } from './transactionService.js';

export interface CustomerPayload {
  assignedPtId?: string; fullName?: string; phone?: string; email?: string; dateOfBirth?: string;
  gender?: ICustomerProfile['gender']; height?: number | ''; initialWeight?: number | '';
  medicalNotes?: string; initialGoal?: string; internalNotes?: string; status?: ICustomerProfile['status'];
}
interface CustomerQuery { page?: unknown; limit?: unknown; ptId?: unknown; status?: unknown; keyword?: unknown; search?: unknown; sort?: unknown; order?: unknown }
interface PackagePayload { name?: string; totalSessions?: number; startDate?: string | Date; endDate?: string | Date; status?: 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED' }
interface PackageQuery { page?: unknown; limit?: unknown; status?: unknown }

const CUSTOMER_MUTABLE_FIELDS: Array<keyof CustomerPayload> = [
  'fullName', 'phone', 'email', 'dateOfBirth', 'gender', 'height', 'initialWeight',
  'medicalNotes', 'initialGoal', 'internalNotes', 'status',
];

function customerChanges(payload: CustomerPayload): Record<string, unknown> {
  return Object.fromEntries(CUSTOMER_MUTABLE_FIELDS
    .filter((key) => Object.prototype.hasOwnProperty.call(payload, key))
    .map((key) => {
      const value = payload[key];
      if (['email', 'dateOfBirth', 'height', 'initialWeight'].includes(key) && value === '') return [key, null];
      if (key === 'email' && typeof value === 'string' && value.trim()) return [key, value.trim().toLowerCase()];
      return [key, typeof value === 'string' ? value.trim() : value];
    }));
}

function notFound() { return new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy khách hàng.' }); }

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function assertEmailNotTaken(email: string, excludeCustomerId?: string, excludeUserId?: Types.ObjectId | null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const emailRegex = new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i');

  const customerFilter: QueryFilter<ICustomerProfile> = { email: emailRegex };
  if (excludeCustomerId) {
    customerFilter._id = { $ne: new Types.ObjectId(excludeCustomerId) };
  }
  const existingCustomer = await CustomerProfile.findOne(customerFilter);
  if (existingCustomer) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.DUPLICATE,
      message: 'Email này đã được sử dụng bởi một khách hàng khác trong hệ thống.',
    });
  }

  const userFilter: any = { email: emailRegex };
  if (excludeUserId) {
    userFilter._id = { $ne: excludeUserId };
  }
  const existingUser = await User.findOne(userFilter);
  if (existingUser) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.DUPLICATE,
      message: 'Email này đã được đăng ký cho một tài khoản trong hệ thống.',
    });
  }
}

function scopedFilter(user: AuthenticatedUser, extra: QueryFilter<ICustomerProfile> = {}): QueryFilter<ICustomerProfile> {
  return isAdminRole(user.role) ? extra : { ...extra, assignedPtId: new Types.ObjectId(user.id) };
}

async function listCustomers(user: AuthenticatedUser, query: CustomerQuery) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const filter = scopedFilter(user);
  if (isAdminRole(user.role) && typeof query.ptId === 'string' && query.ptId.trim()) {
    filter.assignedPtId = new Types.ObjectId(query.ptId.trim());
  }
  if (query.status === 'ACTIVE' || query.status === 'INACTIVE' || query.status === 'LEAD') {
    filter.status = query.status;
  }
  const rawKeyword = typeof query.keyword === 'string' ? query.keyword.trim() : typeof query.search === 'string' ? query.search.trim() : '';
  if (rawKeyword) {
    const escaped = rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }
  const sortField = query.sort === 'fullName' || query.sort === 'status' ? query.sort : 'createdAt';
  const sortDirection = query.order === 'asc' ? 1 : -1;
  const [customers, total] = await Promise.all([
    CustomerProfile.find(filter)
      .populate('userId', 'username email status role createdAt')
      .populate('assignedPtId', 'fullName username email phone')
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CustomerProfile.countDocuments(filter),
  ]);
  return { customers, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getCustomer(user: AuthenticatedUser, id: string) {
  const customer = await CustomerProfile.findOne(scopedFilter(user, { _id: id }))
    .populate('userId', 'username email status role createdAt')
    .populate('assignedPtId', 'fullName username email phone')
    .lean();
  if (!customer) throw notFound();
  return customer;
}

async function createCustomer(user: AuthenticatedUser, payload: CustomerPayload) {
  const assignedPtId = payload.assignedPtId || user.id;
  if (!assignedPtId) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Vui lòng chọn PT phụ trách.' });

  const phone = payload.phone?.trim();
  if (phone) {
    const existingPhone = await CustomerProfile.exists({ phone });
    if (existingPhone) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.DUPLICATE,
        message: 'Số điện thoại đã được sử dụng bởi khách hàng khác.',
      });
    }
  }

  if (payload.email && typeof payload.email === 'string' && payload.email.trim()) {
    await assertEmailNotTaken(payload.email);
  }

  return CustomerProfile.create({ ...customerChanges(payload), assignedPtId: new Types.ObjectId(assignedPtId) });
}

async function updateCustomer(user: AuthenticatedUser, id: string, payload: CustomerPayload) {
  const existing = await CustomerProfile.findOne(scopedFilter(user, { _id: id }));
  if (!existing) throw notFound();

  const phone = payload.phone?.trim();
  if (phone) {
    const existingPhone = await CustomerProfile.exists({
      _id: { $ne: id },
      phone,
    });
    if (existingPhone) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.DUPLICATE,
        message: 'Số điện thoại đã được sử dụng bởi khách hàng khác.',
      });
    }
  }

  if (payload.email && typeof payload.email === 'string' && payload.email.trim()) {
    await assertEmailNotTaken(payload.email, id, existing.userId);
  }

  const customer = await CustomerProfile.findOneAndUpdate(
    scopedFilter(user, { _id: id }),
    customerChanges(payload),
    { returnDocument: 'after', runValidators: true }
  ).populate('userId', 'username email status role createdAt').lean();

  if (!customer) throw notFound();

  if (existing.userId) {
    const userUpdates: { email?: string | null; fullName?: string } = {};
    if (payload.email !== undefined) {
      userUpdates.email = payload.email && typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim().toLowerCase() : undefined;
    }
    if (payload.fullName && payload.fullName.trim()) {
      userUpdates.fullName = payload.fullName.trim();
    }
    if (Object.keys(userUpdates).length > 0) {
      await User.updateOne({ _id: existing.userId }, userUpdates);
    }
  }

  return customer;
}

async function createPackage(user: AuthenticatedUser, customerId: string, payload: PackagePayload) {
  await getCustomer(user, customerId);
  return PtPackage.create({ ...payload, customerId: new Types.ObjectId(customerId), usedSessions: 0, remainingSessions: payload.totalSessions });
}

async function updatePackage(user: AuthenticatedUser, customerId: string, packageId: string, payload: PackagePayload) {
  await getCustomer(user, customerId);
  const item = await PtPackage.findOne({ _id: packageId, customerId });
  if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy gói PT.' });
  const fields: Array<keyof PackagePayload> = ['name', 'totalSessions', 'startDate', 'endDate', 'status'];
  for (const field of fields) if (payload[field] !== undefined) item.set(field, payload[field]);
  if (item.usedSessions > item.totalSessions) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Tổng số buổi không được nhỏ hơn số buổi đã sử dụng.' });
  item.remainingSessions = item.totalSessions - item.usedSessions;
  return item.save();
}

async function deletePackage(user: AuthenticatedUser, customerId: string, packageId: string) {
  await getCustomer(user, customerId);
  const item = await PtPackage.findOneAndDelete({ _id: packageId, customerId });
  if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy gói PT.' });
}

async function deleteCustomer(user: AuthenticatedUser, customerId: string) {
  const customer = await CustomerProfile.findOne(scopedFilter(user, { _id: customerId }));
  if (!customer) throw notFound();
  await withTransaction(async (session) => {
    const options = { session };
    await PtPackage.deleteMany({ customerId }, options);
    await InBodyRecord.deleteMany({ customerId }, options);
    await Goal.deleteMany({ customerId }, options);
    await WorkoutPlan.deleteMany({ customerId }, options);
    await NutritionPlan.deleteMany({ customerId }, options);
    await TransferRequest.deleteMany({ customerId }, options);
    await CustomerProfile.deleteOne({ _id: customerId }, options);
    if (customer.userId) await User.deleteOne({ _id: customer.userId, role: 'CUSTOMER' }, options);
  });
}

async function listPackages(user: AuthenticatedUser, customerId: string, query: PackageQuery) {
  await getCustomer(user, customerId);
  const page = Number(query.page || 1); const limit = Number(query.limit || 20);
  const filter: { customerId: Types.ObjectId; status?: IPtPackage['status'] } = { customerId: new Types.ObjectId(customerId) };
  if (query.status === 'ACTIVE' || query.status === 'EXPIRED' || query.status === 'COMPLETED' || query.status === 'CANCELLED') filter.status = query.status;
  const [packages, total] = await Promise.all([
    PtPackage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), PtPackage.countDocuments(filter),
  ]);
  return { packages, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function createCustomerAccount(user: AuthenticatedUser, customerId: string, payload: UserPayload) {
  const customer = await CustomerProfile.findOne(scopedFilter(user, { _id: customerId }));
  if (!customer) throw notFound();
  if (customer.userId) throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Khách hàng đã có tài khoản đăng nhập.' });
  const account = await userService.createUser({ ...payload, fullName: customer.fullName, role: 'CUSTOMER' });
  try { customer.userId = account._id; await customer.save(); }
  catch (error) { await User.deleteOne({ _id: account._id }); throw error; }
  return { customer, user: { id: account.id, username: account.username, fullName: account.fullName, email: account.email, role: account.role, status: account.status } };
}

async function createConsultation(user: AuthenticatedUser, customerId: string, payload: Record<string, unknown>) {
  await getCustomer(user, customerId);
  return ConsultationNote.create({
    ...payload,
    customerId: new Types.ObjectId(customerId),
    ptId: new Types.ObjectId(user.id),
    consultationDate: payload.consultationDate ? new Date(String(payload.consultationDate)) : new Date(),
  });
}

async function listConsultations(user: AuthenticatedUser, customerId: string, query: { page?: unknown; limit?: unknown }) {
  await getCustomer(user, customerId);
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 50);
  const filter = { customerId: new Types.ObjectId(customerId) };
  const [consultations, total] = await Promise.all([
    ConsultationNote.find(filter).sort({ consultationDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ConsultationNote.countDocuments(filter),
  ]);
  return { consultations, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function updateConsultation(user: AuthenticatedUser, customerId: string, consultationId: string, payload: Record<string, unknown>) {
  await getCustomer(user, customerId);
  const item = await ConsultationNote.findOne({ _id: consultationId, customerId });
  if (!item) throw notFound();
  for (const field of ['topic', 'currentCondition', 'advice', 'actionPlan', 'notes'] as const) {
    if (payload[field] !== undefined) item.set(field, payload[field]);
  }
  if (payload.consultationDate) item.consultationDate = new Date(String(payload.consultationDate));
  return item.save();
}

async function deleteConsultation(user: AuthenticatedUser, customerId: string, consultationId: string) {
  await getCustomer(user, customerId);
  const result = await ConsultationNote.deleteOne({ _id: consultationId, customerId });
  if (!result.deletedCount) throw notFound();
}

async function createPhoto(user: AuthenticatedUser, customerId: string, payload: any) {
  await getCustomer(user, customerId);
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.photos)
    ? payload.photos
    : [payload];

  if (!items.length) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Danh sách ảnh tải lên không được để trống.' });
  }

  const docs = items.map((item: any) => ({
    customerId: new Types.ObjectId(customerId),
    ptId: new Types.ObjectId(user.id),
    photoUrl: String(item.photoUrl),
    stage: item.stage || 'PROGRESS',
    angle: item.angle || 'FRONT',
    weight: item.weight !== undefined && item.weight !== null && item.weight !== '' ? Number(item.weight) : null,
    bodyFat: item.bodyFat !== undefined && item.bodyFat !== null && item.bodyFat !== '' ? Number(item.bodyFat) : null,
    notes: item.notes ? String(item.notes).trim() : '',
    takenDate: item.takenDate ? new Date(String(item.takenDate)) : new Date(),
  }));

  const created = await ProgressPhoto.insertMany(docs);
  return Array.isArray(payload) || Array.isArray(payload?.photos) ? created : created[0];
}

async function listPhotos(user: AuthenticatedUser, customerId: string, query: { page?: unknown; limit?: unknown; stage?: unknown }) {
  await getCustomer(user, customerId);
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 50);
  const filter: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) };
  if (query.stage && ['BEFORE', 'AFTER', 'PROGRESS'].includes(String(query.stage))) {
    filter.stage = query.stage;
  }
  const [photos, total] = await Promise.all([
    ProgressPhoto.find(filter).sort({ takenDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ProgressPhoto.countDocuments(filter),
  ]);
  return { photos, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function updatePhoto(user: AuthenticatedUser, customerId: string, photoId: string, payload: Record<string, unknown>) {
  await getCustomer(user, customerId);
  const item = await ProgressPhoto.findOne({ _id: photoId, customerId });
  if (!item) throw notFound();
  for (const field of ['photoUrl', 'stage', 'angle', 'weight', 'bodyFat', 'notes'] as const) {
    if (payload[field] !== undefined) item.set(field, payload[field]);
  }
  if (payload.takenDate) item.takenDate = new Date(String(payload.takenDate));
  return item.save();
}

async function deletePhoto(user: AuthenticatedUser, customerId: string, photoId: string) {
  await getCustomer(user, customerId);
  const result = await ProgressPhoto.deleteOne({ _id: photoId, customerId });
  if (!result.deletedCount) throw notFound();
}

export {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createPackage,
  updatePackage,
  deletePackage,
  listPackages,
  createCustomerAccount,
  createConsultation,
  listConsultations,
  updateConsultation,
  deleteConsultation,
  createPhoto,
  listPhotos,
  updatePhoto,
  deletePhoto,
};
