import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { NextFunction, Request, Response, RequestHandler } from 'express';
import type { AuthenticatedUser } from '../types/express.js';
import { getEnv } from '../config/env.js';
import User from '../models/User.js';
import Center from '../models/Center.js';
import { acquireCenterRequestLease } from '../services/centerRequestLeaseService.js';
import { logger } from '../config/logger.js';
import { hasRequiredRole } from '../services/roles.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';
import { runWithClientType } from '../tenancy/clientTypeContext.js';

async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return next(new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Bạn chưa đăng nhập.' }));
  }

  if (process.env.GYM_EMBEDDED === '1') {
    try {
      const secret = process.env.GYM_BRIDGE_SECRET?.trim();
      if (!secret || secret.length < 32) throw new Error('GYM_BRIDGE_SECRET is required.');
      const claim = jwt.verify(token, secret, { issuer: 'igen-erp', audience: 'chuoi-gym', algorithms: ['HS256'] }) as jwt.JwtPayload;
      const erpUserId = typeof claim.erpUserId === 'string' ? claim.erpUserId : '';
      const companyCode = typeof claim.companyCode === 'string' ? claim.companyCode : '';
      const email = typeof claim.email === 'string' ? claim.email.trim().toLowerCase() : '';
      const role = claim.role === 'ADMIN' ? 'ADMIN' : claim.role === 'PT' ? 'PT' : null;
      if (!erpUserId || !companyCode || !role) throw new Error('Invalid ERP Gym identity.');

      const centerSlug = `erp-${createHash('sha256').update(companyCode).digest('hex').slice(0, 32)}`;
      const center = await Center.findOneAndUpdate(
        { slug: centerSlug },
        { $setOnInsert: { name: companyCode, slug: centerSlug, status: 'ACTIVE', workspaceType: 'GYM' } },
        { new: true, upsert: true },
      );
      if (!center || center.status !== 'ACTIVE') throw new Error('Gym center is unavailable.');
      const username = `erp-${createHash('sha256').update(`${companyCode}:${erpUserId}`).digest('hex').slice(0, 40)}`;
      const user = await runWithSystemCenterAccess(async () => {
        const linked = email ? await User.findOne({ email, centerId: center._id }) : null;
        if (linked) return User.findByIdAndUpdate(linked._id, { $set: { fullName: typeof claim.fullName === 'string' ? claim.fullName : linked.fullName, role, status: 'ACTIVE' } }, { new: true });
        return User.findOneAndUpdate(
          { username },
          {
            $set: { fullName: typeof claim.fullName === 'string' ? claim.fullName : username, role, status: 'ACTIVE', centerId: center._id },
            $setOnInsert: { username, password: randomBytes(32).toString('hex'), ...(email ? { email } : {}) },
          },
          { new: true, upsert: true },
        );
      });
      if (!user) throw new Error('Gym user could not be provisioned.');
      req.user = { id: String(user._id), role, clientType: 'WEB', centerId: String(center._id), username: user.username, fullName: user.fullName };
      return runWithClientType('WEB', () => runWithCenter(String(center._id), () => next()));
    } catch (error) {
      return next(new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Phiên Chuỗi GYM không hợp lệ.' }));
    }
  }

  try {
    const env = getEnv();
    const payload = jwt.verify(token, env.JWT_SECRET, env.NODE_ENV === 'test' ? undefined : {
      algorithms: [env.JWT_ALGORITHM], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE,
    }) as AuthenticatedUser & { authVersion?: number };
    const clientType = payload.clientType === 'MOBILE' ? 'MOBILE' : 'WEB';
    const user = await runWithSystemCenterAccess(() => User.findById(payload.id).select('username fullName role status centerId authVersion').lean());
    if (!user) throw new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Tài khoản không còn tồn tại.' });
    if (user.status === 'LOCKED') throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Tài khoản đã bị khóa.' });
    if (!user.centerId) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Dữ liệu trung tâm chưa được khởi tạo. Vui lòng chạy migration 004-center-tenancy.' });
    if ((payload.authVersion || 0) !== (user.authVersion || 0)) throw new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Tài khoản đã đổi không gian làm việc. Vui lòng đăng nhập lại.' });
    const center = await Center.findOne({ _id: user.centerId, status: 'ACTIVE' }).select('workspaceType').lean();
    if (!center) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Không gian làm việc không còn hoạt động.' });
    req.user = { id: String(user._id), role: user.role, clientType, centerId: String(user.centerId), username: user.username, fullName: user.fullName };
    if (center.workspaceType === 'PERSONAL') {
      const lease = await acquireCenterRequestLease(String(user.centerId), String(user._id));
      if (lease) {
        req.user.requestLeaseId = lease.id;
        const release = () => { void lease.release().catch(error => logger.error({ err: error }, 'Unable to release center request lease')); };
        _res.once('finish', release);
        _res.once('close', () => { if (_res.writableFinished) release(); else lease.abandon(); });
        if (_res.writableFinished) release();
        else if (_res.destroyed) lease.abandon();
      }
    }
    return runWithClientType(clientType, () => runWithCenter(String(user.centerId), () => next()));
  } catch (error) {
    return next(error);
  }
}

function authorize(...roles: AuthenticatedUser['role'][]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !hasRequiredRole(req.user.role, roles)) {
      return next(new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền thực hiện thao tác này.' }));
    }
    return next();
  };
}

export { authenticate, authorize };
