import { deleteTrainerAccount } from './trainerAccountDeletionService.js';
import { isValidPassword, PASSWORD_ERROR } from './passwordPolicy.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Types, type Model, type QueryFilter } from 'mongoose';
import User, { type IUser, type UserDocument, type UserRole, type UserStatus } from '../models/User.js';
import CustomerProfile, { type ICustomerProfile } from '../models/CustomerProfile.js';
import InBodyRecord from '../models/InBodyRecord.js';
import Goal from '../models/Goal.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import NutritionPlan from '../models/NutritionPlan.js';
import CreditWallet from '../models/CreditWallet.js';
import DeviceSession from '../models/DeviceSession.js';
import Center from '../models/Center.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { ensureWallet } from './creditWalletService.js';
import { withRequiredTransaction, withTransaction } from './transactionService.js';
import { recordAudit } from './auditService.js';
import type { AuthenticatedUser } from '../types/express.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';

export interface UserPayload {
  username: string;
  password: string;
  role: UserRole;
  fullName?: string;
  email?: string | null;
  avatarUrl?: string;
  dateOfBirth?: string | Date | null;
  gender?: IUser['gender'];
  phone?: string | null;
  address?: string;
  specialization?: string;
  yearsOfExperience?: number;
  certificates?: string[];
  bio?: string;
  status?: UserStatus;
  centerId?: Types.ObjectId | string;
}

export type UpdatePtPayload = Partial<Omit<UserPayload, 'username' | 'role'>>;
export type UpdateUserPayload = Partial<Omit<UserPayload, 'username'>>;
export type UpdateSelfProfilePayload = Partial<Omit<UserPayload, 'username' | 'role' | 'status'>> & {
  currentPassword?: string | null;
};
export interface UserListQuery {
  page?: unknown;
  limit?: unknown;
  role?: unknown;
  status?: unknown;
  keyword?: unknown;
}
interface OwnedContent {
  customerId: Types.ObjectId;
  ptId: Types.ObjectId;
}

function assertPassword(password: string, allowLegacyDigits = false): void {
  if (allowLegacyDigits && /^\d{6}$/.test(password)) return;
  if (!isValidPassword(password)) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: PASSWORD_ERROR });
  }
}

function optionalContact(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}

async function createUser(payload: UserPayload, allowLegacyDigits = false) {
  assertPassword(payload.password, allowLegacyDigits);
  const existing = await runWithSystemCenterAccess(() => User.exists({ username: payload.username.trim() }));
  if (existing) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.DUPLICATE,
      message: 'Tên đăng nhập đã tồn tại.',
    });
  }
  const password = await bcrypt.hash(payload.password, 10);
  return withTransaction(async (session) => {
    const [user] = await User.create([
      {
        username: payload.username.trim(),
        password,
        role: payload.role,
        fullName: payload.fullName || '',
        email: optionalContact(payload.email),
        avatarUrl: payload.avatarUrl || '',
        dateOfBirth: payload.dateOfBirth || null,
        gender: payload.gender || 'OTHER',
        phone: optionalContact(payload.phone),
        address: payload.address || '',
        specialization: payload.specialization || '',
        yearsOfExperience: payload.yearsOfExperience ?? 0,
        certificates: payload.certificates || [],
        bio: payload.bio || '',
        status: payload.status || 'ACTIVE',
        ...(payload.centerId ? { centerId: typeof payload.centerId === 'string' ? new Types.ObjectId(payload.centerId) : payload.centerId } : {}),
      },
    ], { session });
    await ensureWallet(user.id, session);

    // If role is CUSTOMER, ensure a linked CustomerProfile exists
    if (payload.role === 'CUSTOMER') {
      const filterConditions: Array<QueryFilter<ICustomerProfile>> = [{ userId: user._id }];
      if (payload.phone && payload.phone.trim()) {
        filterConditions.push({ phone: payload.phone.trim() });
      }
      if (payload.email && payload.email.trim()) {
        filterConditions.push({ email: payload.email.trim().toLowerCase() });
      }

      const existingProfile = await CustomerProfile.findOne({
        $or: filterConditions,
      } as QueryFilter<ICustomerProfile>).session(session);

      if (existingProfile) {
        if (!existingProfile.userId) {
          existingProfile.userId = user._id;
        }
        if (payload.fullName) existingProfile.fullName = payload.fullName;
        await existingProfile.save({ session });
      } else {
        const defaultPt = await User.findOne({ role: 'PT', status: 'ACTIVE', ...(payload.centerId ? { centerId: payload.centerId } : {}) }).session(session);
        if (defaultPt) {
          await CustomerProfile.create(
            [
              {
                userId: user._id,
                assignedPtId: defaultPt._id,
                fullName: payload.fullName || payload.username,
                phone: payload.phone || '0000000000',
                email: payload.email || null,
                gender: payload.gender || 'OTHER',
                dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
                status: 'ACTIVE',
                initialGoal: 'Cải thiện thể lực và vóc dáng',
                medicalNotes: '',
                internalNotes: '',
              },
            ],
            { session },
          );
        }
      }
    }

    return user;
  });
}

function forbidden(message: string, status = 403) {
  return new AppError({ status, code: ERROR_CODES.AUTHORIZATION, message });
}

async function registerCenterAdmin(input: { centerName: string; username: string; password: string; fullName: string; email?: string; phone?: string }) {
  assertPassword(input.password);
  const username = input.username.trim();
  const email = optionalContact(input.email)?.toLowerCase();
  const phone = optionalContact(input.phone);
  const duplicateConditions: Array<Record<string, string>> = [{ username }];
  if (email) duplicateConditions.push({ email });
  if (phone) duplicateConditions.push({ phone });
  if (await runWithSystemCenterAccess(() => User.exists({ $or: duplicateConditions }))) {
    throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Tên đăng nhập, email hoặc số điện thoại đã được sử dụng.' });
  }

  const centerName = input.centerName.trim();
  const slugBase = centerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'gym';
  const center = await Center.create({ name: centerName, slug: `${slugBase}-${randomUUID().slice(0, 8)}`, workspaceType: 'GYM' });

  try {
    const admin = await runWithCenter(String(center._id), () => createUser({
      username,
      password: input.password,
      role: 'ADMIN',
      fullName: input.fullName.trim(),
      email,
      phone,
      centerId: center._id,
    }));
    center.ownerAdminId = admin._id;
    await center.save();
    return { center, admin };
  } catch (error) {
    await runWithSystemCenterAccess(async () => {
      const createdAdmin = await User.findOne({ username, centerId: center._id }).select({ _id: 1 }).lean();
      if (createdAdmin) {
        await CreditWallet.deleteMany({ userId: createdAdmin._id });
        await User.deleteOne({ _id: createdAdmin._id });
      }
      await Center.deleteOne({ _id: center._id });
    });
    throw error;
  }
}

async function registerPtAccount(input: { username: string; password: string; fullName: string; email?: string; phone?: string }) {
  assertPassword(input.password);
  const username = input.username.trim();
  const email = optionalContact(input.email)?.toLowerCase();
  const phone = optionalContact(input.phone);
  const duplicateConditions: Array<Record<string, string>> = [{ username }];
  if (email) duplicateConditions.push({ email });
  if (phone) duplicateConditions.push({ phone });
  if (await runWithSystemCenterAccess(() => User.exists({ $or: duplicateConditions }))) {
    throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Tên đăng nhập, email hoặc số điện thoại đã được sử dụng.' });
  }

  const fullName = input.fullName.trim();
  const slugBase = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'pt';
  const password = await bcrypt.hash(input.password, 10);
  try {
    return await runWithSystemCenterAccess(() => withRequiredTransaction(async session => {
      const [center] = await Center.create([{
        name: `Không gian cá nhân - ${fullName}`.slice(0, 120),
        slug: `pt-${slugBase}-${randomUUID().slice(0, 8)}`,
        workspaceType: 'PERSONAL',
      }], { session });
      const result = await runWithCenter(String(center._id), async () => {
        const [pt] = await User.create([{
          username, password, role: 'PT', fullName, email, phone,
          centerId: center._id,
        }], { session });
        await ensureWallet(pt.id, session);
        return pt;
      });
      center.ownerPtId = result._id;
      await center.save({ session });
      return { center, pt: result };
    }));
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Tên đăng nhập, email hoặc số điện thoại đã được sử dụng.' });
    }
    throw error;
  }
}

async function createManagedUser(actor: AuthenticatedUser, payload: UserPayload) {
  if (!actor.centerId) throw forbidden('Tài khoản chưa được gán trung tâm.', 409);
  if (payload.role === 'CUSTOMER') throw forbidden('Only PT accounts can be created for a center.');
  if (payload.role === 'SUPER_ADMIN') {
    throw forbidden('Không thể tạo thêm tài khoản quản trị cấp cao.');
  }
  if (payload.role === 'ADMIN') {
    throw forbidden('Mỗi trung tâm có một tài khoản Admin chủ sở hữu. Admin mới được tạo khi đăng ký trung tâm.');
  }
  return createUser({ ...payload, centerId: actor.centerId });
}

async function listUsers(query: UserListQuery, actor: AuthenticatedUser) {
  if (!actor.centerId) throw forbidden('Tài khoản chưa được gán trung tâm.', 409);
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const filter: QueryFilter<IUser> = { centerId: new Types.ObjectId(actor.centerId) };
  if (query.role === 'SUPER_ADMIN' || query.role === 'ADMIN' || query.role === 'PT' || query.role === 'CUSTOMER') {
    filter.role = query.role;
  }
  if (query.status === 'ACTIVE' || query.status === 'LOCKED') filter.status = query.status;
  if (typeof query.keyword === 'string' && query.keyword.trim()) {
    const raw = query.keyword.trim();
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const digitsOnly = raw.replace(/\D/g, '');

    const customerMatches = await CustomerProfile.find({
      $or: [
        { phone: { $regex: escaped, $options: 'i' } },
        ...(digitsOnly.length >= 3 ? [{ phone: { $regex: digitsOnly, $options: 'i' } }] : []),
        { fullName: { $regex: escaped, $options: 'i' } },
      ],
      userId: { $ne: null },
    })
      .select('userId')
      .lean();

    const matchedUserIds = customerMatches
      .map((c) => c.userId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    filter.$or = [
      { username: { $regex: escaped, $options: 'i' } },
      { fullName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      ...(digitsOnly.length >= 3 && digitsOnly !== raw ? [{ phone: { $regex: digitsOnly, $options: 'i' } }] : []),
      ...(matchedUserIds.length > 0 ? [{ _id: { $in: matchedUserIds } }] : []),
    ];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);
  const wallets = await CreditWallet.find({ userId: { $in: userIds } }).lean();
  const walletMap = new Map(wallets.map((w) => [String(w.userId), w]));

  const usersWithWallet = users.map((u) => ({
    ...u,
    avatarUrl: u.avatarUrl || (u as unknown as Record<string, unknown>).avatar || (u as unknown as Record<string, unknown>).photoUrl || '',
    availableCredits: walletMap.get(String(u._id))?.availableCredits ?? 0,
    reservedCredits: walletMap.get(String(u._id))?.reservedCredits ?? 0,
  }));

  return { users: usersWithWallet, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function updatePt(id: string, payload: UpdatePtPayload, centerId: string): Promise<UserDocument> {
  const user = await User.findOne({ _id: id, role: 'PT', centerId });
  if (!user || user.role !== 'PT') throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài khoản PT.' });
  const fields: Array<keyof UpdatePtPayload> = ['avatarUrl', 'dateOfBirth', 'gender', 'fullName', 'address', 'specialization', 'yearsOfExperience', 'certificates', 'bio', 'status'];
  if (Object.prototype.hasOwnProperty.call(payload, 'email')) user.set('email', optionalContact(payload.email));
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) user.set('phone', optionalContact(payload.phone));
  for (const field of fields) {
    const value = payload[field];
    if (value !== undefined) user.set(field, value === '' && ['email', 'phone'].includes(field) ? undefined : value === '' && field === 'dateOfBirth' ? null : value);
  }
  if (payload.password) {
    assertPassword(payload.password);
    user.password = await bcrypt.hash(payload.password, 10);
  }
  await user.save();
  return user;
}

async function deletePt(id: string, centerId: string): Promise<void> {
  const pt = await User.findOne({ _id: id, role: 'PT', centerId });
  if (!pt) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài khoản PT.' });
  if (await CustomerProfile.exists({ assignedPtId: id })) throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Vui lòng chuyển hết khách sang PT khác trước khi xóa PT.' });
  const contentModels: Array<Model<OwnedContent>> = [
    InBodyRecord as unknown as Model<OwnedContent>, Goal as unknown as Model<OwnedContent>,
    WorkoutPlan as unknown as Model<OwnedContent>, NutritionPlan as unknown as Model<OwnedContent>,
  ];
  await withTransaction(async (session) => {
    for (const item of contentModels) {
      await item.deleteMany({ ptId: id }).session(session);
    }
    await User.deleteOne({ _id: id }, { session });
  });
}

async function updateManagedUser(actor: AuthenticatedUser, id: string, payload: UpdateUserPayload): Promise<UserDocument> {
  if (!actor.centerId) throw forbidden('Tài khoản chưa được gán trung tâm.', 409);
  const user = await User.findOne({ _id: id, centerId: actor.centerId });
  if (!user) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài khoản.' });

  if (payload.role !== undefined) {
    const status = user.role === 'SUPER_ADMIN' && actor.id === user.id ? 409 : 403;
    throw forbidden('Không thể thay đổi vai trò tài khoản.', status);
  }
  if (user.role === 'SUPER_ADMIN' && (actor.role !== 'SUPER_ADMIN' || actor.id !== user.id)) {
    throw forbidden('Không thể chỉnh sửa quản trị cấp cao.');
  }
  if (user.role === 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw forbidden('Chỉ quản trị cấp cao mới có thể chỉnh sửa tài khoản quản trị.');
  }
  if (user.role === 'SUPER_ADMIN' && payload.status === 'LOCKED') {
    throw forbidden('Không thể khóa tài khoản quản trị cấp cao.', 409);
  }

  const fields: Array<keyof UpdateUserPayload> = ['avatarUrl', 'dateOfBirth', 'gender', 'fullName', 'address', 'specialization', 'yearsOfExperience', 'certificates', 'bio', 'status'];
  if (Object.prototype.hasOwnProperty.call(payload, 'email')) user.set('email', optionalContact(payload.email));
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) user.set('phone', optionalContact(payload.phone));
  for (const field of fields) {
    const value = payload[field];
    if (value !== undefined) user.set(field, value === '' && ['email', 'phone'].includes(field) ? undefined : value === '' && field === 'dateOfBirth' ? null : value);
  }
  if (payload.password) {
    assertPassword(payload.password);
    user.password = await bcrypt.hash(payload.password, 10);
  }
  await user.save();
  if (user.role === 'ADMIN') {
    await recordAudit({ actor, action: 'ADMIN_UPDATED', resourceType: 'USER', resourceId: user.id });
  }
  return user;
}

async function deleteManagedUser(actor: AuthenticatedUser, id: string): Promise<void> {
  if (!actor.centerId) throw forbidden('Tài khoản chưa được gán trung tâm.', 409);
  const user = await User.findOne({ _id: id, centerId: actor.centerId });
  if (!user) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài khoản.' });

  if (user.role === 'SUPER_ADMIN') {
    const status = actor.id === user.id ? 409 : 403;
    throw forbidden('Không thể xóa tài khoản quản trị cấp cao.', status);
  }
  if (user.role === 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw forbidden('Chỉ quản trị cấp cao mới có thể xóa tài khoản quản trị.');
  }
  if (user.role === 'PT') {
    await deletePt(id, actor.centerId);
    return;
  }

  if (user.role === 'CUSTOMER') {
    await withTransaction(async (session) => {
      await CustomerProfile.updateMany({ userId: user._id }, { $unset: { userId: 1 } }, { session });
      await User.deleteOne({ _id: user._id }, { session });
    });
    return;
  }

  await User.deleteOne({ _id: user._id });
  await recordAudit({ actor, action: 'ADMIN_DELETED', resourceType: 'USER', resourceId: user.id });
}

async function ensureBootstrapSuperAdmin({ username, password, fullName = 'Quản lý cấp cao 3S' }: { username?: string; password?: string; fullName?: string }) {
  return runWithSystemCenterAccess(async () => {
    if (!username || !password) return null;
    const normalizedUsername = username.trim();
    const center = await Center.findOneAndUpdate(
      { slug: '3s-gym' },
      { $setOnInsert: { name: '3S Gym', slug: '3s-gym', status: 'ACTIVE', workspaceType: 'GYM' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    if (!center) throw new Error('Could not initialize the 3S Gym center.');
    const [existingSuperAdmin, configuredUser] = await Promise.all([
      User.findOne({ role: 'SUPER_ADMIN' }),
      User.findOne({ username: normalizedUsername }),
    ]);
    if (existingSuperAdmin) {
      if (existingSuperAdmin.username !== normalizedUsername) {
        throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'SUPER_ADMIN hiện tại không khớp SUPER_ADMIN_USERNAME đã cấu hình.' });
      }
      if (!existingSuperAdmin.centerId) {
        existingSuperAdmin.centerId = center._id;
        await existingSuperAdmin.save();
      }
      await ensureWallet(existingSuperAdmin.id);
      return existingSuperAdmin;
    }
    if (configuredUser) {
      if (configuredUser.role !== 'ADMIN') {
        throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'SUPER_ADMIN_USERNAME chỉ có thể nâng cấp từ tài khoản ADMIN.' });
      }
      configuredUser.role = 'SUPER_ADMIN';
      if (!configuredUser.fullName && fullName) configuredUser.fullName = fullName;
      if (!configuredUser.centerId) configuredUser.centerId = center._id;
      await configuredUser.save();
      await ensureWallet(configuredUser.id);
      return configuredUser;
    }
    return createUser({ username: normalizedUsername, password, fullName, role: 'SUPER_ADMIN', centerId: center._id }, true);
  });
}

async function updateSelfProfile(actor: AuthenticatedUser, payload: UpdateSelfProfilePayload): Promise<UserDocument> {
  const user = await User.findById(actor.id);
  if (!user) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài khoản.' });
  if (user.status === 'LOCKED') throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Tài khoản đã bị khóa.' });

  if (payload.password) {
    if (!payload.currentPassword) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.' });
    }
    const isCurrentValid = process.env.GYM_EMBEDDED === '1' || await bcrypt.compare(payload.currentPassword, user.password);
    if (!isCurrentValid) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Mật khẩu hiện tại không chính xác.' });
    }
    assertPassword(payload.password);
    user.password = await bcrypt.hash(payload.password, 10);
  }

  const fields: Array<keyof UpdateSelfProfilePayload> = [
    'avatarUrl',
    'dateOfBirth',
    'gender',
    'fullName',
    'address',
    'specialization',
    'yearsOfExperience',
    'certificates',
    'bio',
  ];

  if (Object.prototype.hasOwnProperty.call(payload, 'email')) user.set('email', optionalContact(payload.email));
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) user.set('phone', optionalContact(payload.phone));

  for (const field of fields) {
    const value = payload[field];
    if (value !== undefined) {
      user.set(field, value === '' && ['email', 'phone'].includes(field) ? undefined : value === '' && field === 'dateOfBirth' ? null : value);
    }
  }

  await user.save();
  return user;
}

async function deleteSelfAccount(actor: AuthenticatedUser): Promise<void> {
  const user = await User.findById(actor.id);
  if (!user) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài khoản.' });
  }

  if (user.role === 'SUPER_ADMIN') {
    throw forbidden('Không thể xóa tài khoản quản trị cấp cao.', 403);
  }

  if (user.role === 'ADMIN') {
    throw forbidden('Tài khoản quản trị viên không thể tự xóa.', 403);
  }

  if (user.role === 'PT') {
    await deleteTrainerAccount(actor);
    return;
  }

  const hasAssignedCustomers = await CustomerProfile.exists({ assignedPtId: user._id });
  if (hasAssignedCustomers) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.DUPLICATE,
      message: 'Tài khoản vẫn còn khách hàng phụ trách. Vui lòng chuyển hết khách hàng sang PT khác trước khi xóa tài khoản.',
    });
  }

  if (user.role === 'CUSTOMER') {
    await withTransaction(async (session) => {
      await CustomerProfile.updateMany({ userId: user._id }, { $unset: { userId: 1 } }, { session });
      await DeviceSession.deleteMany({ userId: user._id }).session(session);
      await CreditWallet.deleteMany({ userId: user._id }).session(session);
      await User.deleteOne({ _id: user._id }, { session });
    });
    return;
  }

  await withTransaction(async (session) => {
    await DeviceSession.deleteMany({ userId: user._id }).session(session);
    await CreditWallet.deleteMany({ userId: user._id }).session(session);
    await User.deleteOne({ _id: user._id }, { session });
  });
}

export {
  createUser,
  registerCenterAdmin,
  registerPtAccount,
  createManagedUser,
  listUsers,
  updatePt,
  updateManagedUser,
  updateSelfProfile,
  deletePt,
  deleteManagedUser,
  deleteSelfAccount,
  ensureBootstrapSuperAdmin,
};

