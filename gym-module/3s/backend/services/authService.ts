import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import DeviceSession, { type ClientType } from '../models/DeviceSession.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { getEnv } from '../config/env.js';
import { registerCenterAdmin as createCenterAdmin } from './userService.js';
import { registerPtAccount as createPtAccount } from './userService.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';

interface LoginPayload {
  username: string;
  password: string;
  clientType?: ClientType;
  deviceInfo?: {
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    osVersion?: string;
    appVersion?: string;
  };
  pushToken?: string;
}

async function login({ username, password, clientType = 'WEB', deviceInfo, pushToken }: LoginPayload) {
  const user = await runWithSystemCenterAccess(() => User.findOne({ username: username.trim() }));
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
  }
  if (user.status === 'LOCKED') {
    throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Tài khoản đã bị khóa.' });
  }

  // 1. Phân quyền chặt chẽ: Ứng dụng Mobile chỉ dành riêng cho HLV (PT/ADMIN), tuyệt đối không cho CUSTOMER
  if (clientType === 'MOBILE' && user.role === 'CUSTOMER') {
    throw new AppError({
      status: 403,
      code: ERROR_CODES.AUTHORIZATION,
      message: 'Ứng dụng di động chỉ dành riêng cho Huấn luyện viên (PT). Hội viên vui lòng liên hệ quầy chăm sóc khách hàng.',
    });
  }
  if (!user.centerId) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Dữ liệu trung tâm chưa được khởi tạo. Vui lòng chạy migration 004-center-tenancy.' });

  return runWithCenter(String(user.centerId), async () => {
  const env = getEnv();

  // 2. Phân biệt theo môi trường Mobile vs Web
  if (clientType === 'MOBILE') {
    // Mobile HLV: Token truy cập 7 ngày + Refresh Token 60 ngày để không bị gián đoạn khi đứng lớp
    const token = jwt.sign(
      { id: user.id, role: user.role, clientType: 'MOBILE', authVersion: user.authVersion || 0 },
      env.JWT_SECRET,
      { expiresIn: '7d', algorithm: env.JWT_ALGORITHM, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE },
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 ngày

    // Lưu hoặc cập nhật phiên thiết bị của HLV
    if (deviceInfo?.deviceId) {
      await DeviceSession.findOneAndUpdate(
        { userId: user._id, clientType: 'MOBILE', deviceId: deviceInfo.deviceId },
        {
          deviceName: deviceInfo.deviceName || '',
          platform: deviceInfo.platform || '',
          osVersion: deviceInfo.osVersion || '',
          appVersion: deviceInfo.appVersion || '',
          pushToken: pushToken || '',
          refreshToken,
          lastActiveAt: new Date(),
          status: 'ACTIVE',
          expiresAt,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      await DeviceSession.create({
        userId: user._id,
        clientType: 'MOBILE',
        deviceId: '',
        deviceName: deviceInfo?.deviceName || '',
        platform: deviceInfo?.platform || '',
        osVersion: deviceInfo?.osVersion || '',
        appVersion: deviceInfo?.appVersion || '',
        pushToken: pushToken || '',
        refreshToken,
        lastActiveAt: new Date(),
        status: 'ACTIVE',
        expiresAt,
      });
    }

    return {
      token,
      refreshToken,
      clientType: 'MOBILE',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl || '',
        specialization: user.specialization || '',
        phone: user.phone || '',
      },
    };
  }

  // Web Admin/PT: Token 1 ngày chuẩn mực bảo mật
  const token = jwt.sign(
    { id: user.id, role: user.role, clientType: 'WEB', authVersion: user.authVersion || 0 },
    env.JWT_SECRET,
    { expiresIn: '1d', algorithm: env.JWT_ALGORITHM, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE },
  );

  return {
    token,
    clientType: 'WEB',
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl || (user as unknown as Record<string, unknown>).avatar || (user as unknown as Record<string, unknown>).photoUrl || '',
      email: user.email || '',
      phone: user.phone || '',
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
    },
  };
  });
}

function registerCenterAdmin(input: Parameters<typeof createCenterAdmin>[0]) {
  return createCenterAdmin(input);
}

function registerPtAccount(input: Parameters<typeof createPtAccount>[0]) {
  return createPtAccount(input);
}

async function refreshSession({ refreshToken }: { refreshToken: string }) {
  if (!refreshToken?.trim()) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Thiếu Refresh Token.' });
  }

  const lookup = await runWithSystemCenterAccess(async () => {
    const session = await DeviceSession.findOne({ refreshToken: refreshToken.trim(), status: 'ACTIVE' });
    if (!session) return null;
    const user = await User.findById(session.userId);
    return { sessionId: String(session._id), centerId: String(session.get('centerId') || user?.centerId || ''), userId: String(session.userId) };
  });
  if (!lookup?.centerId) {
    throw new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  return runWithCenter(lookup.centerId, async () => {
    const session = await DeviceSession.findOne({ _id: lookup.sessionId, refreshToken: refreshToken.trim(), status: 'ACTIVE' });
    if (!session) throw new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      session.status = 'EXPIRED';
      await session.save();
      throw new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    }

    const user = await User.findOne({ _id: lookup.userId, centerId: lookup.centerId });
    if (!user || user.status === 'LOCKED') {
      session.status = 'REVOKED';
      await session.save();
      throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' });
    }

    const env = getEnv();
    const token = jwt.sign(
      { id: user.id, role: user.role, clientType: session.clientType, authVersion: user.authVersion || 0 },
      env.JWT_SECRET,
      { expiresIn: '7d', algorithm: env.JWT_ALGORITHM, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE },
    );
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    session.refreshToken = newRefreshToken;
    session.lastActiveAt = new Date();
    session.expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await session.save();

    return {
      token,
      refreshToken: newRefreshToken,
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, status: user.status },
    };
  });
}

async function logoutSession({ refreshToken, pushToken }: { refreshToken?: string; pushToken?: string }) {
  const criteria = [
    ...(refreshToken?.trim() ? [{ refreshToken: refreshToken.trim() }] : []),
    ...(pushToken?.trim() ? [{ pushToken: pushToken.trim() }] : []),
  ];
  if (!criteria.length) return { success: true };

  const sessions = await runWithSystemCenterAccess(() => DeviceSession.find({ $or: criteria }).select({ _id: 1, centerId: 1, refreshToken: 1, pushToken: 1 }).lean());
  for (const item of sessions) {
    const centerId = String((item as typeof item & { centerId?: unknown }).centerId || '');
    if (!centerId) continue;
    const update: Record<string, unknown> = {};
    if (refreshToken?.trim() && item.refreshToken === refreshToken.trim()) update.status = 'REVOKED';
    if (pushToken?.trim() && item.pushToken === pushToken.trim()) update.pushToken = '';
    if (!Object.keys(update).length) continue;
    await runWithCenter(centerId, () => DeviceSession.updateOne(
      { _id: item._id },
      { $set: update },
    ));
  }
  return { success: true };
}
export { login, registerCenterAdmin, registerPtAccount, refreshSession, logoutSession };

