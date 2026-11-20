import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { runWithSystemCenterAccess } from '../tenancy/centerContext.js';

export const usesErpCredit = () => process.env.GYM_EMBEDDED === '1';

export async function erpCreditOperation(gymUserId: string, operation: 'reserve' | 'settle' | 'release', key: string, amount: number) {
  const secret = process.env.GYM_BRIDGE_SECRET?.trim();
  if (!secret || secret.length < 32) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Cầu nối Credit ERP chưa được cấu hình.' });
  const user = await runWithSystemCenterAccess(() => User.findById(gymUserId).select('erpUserId erpCompanyCode').lean());
  if (!user?.erpUserId || !user.erpCompanyCode) throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Tài khoản Gym chưa được liên kết với ERP.' });
  const token = jwt.sign({ erpUserId: user.erpUserId, companyCode: user.erpCompanyCode }, secret, { expiresIn: '1m', issuer: 'chuoi-gym', audience: 'igen-erp-gym-credit' });
  const base = process.env.GYM_ERP_API_URL || 'http://127.0.0.1:3000';
  let response: Response;
  try {
    response = await fetch(new URL(`/api/v1/gym-credit/internal/${operation}`, base), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, amount }), signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Không kết nối được ví Credit ERP.' });
  }
  const body = await response.json() as { status?: string; charged?: number; billingShortfall?: number; message?: string };
  if (!response.ok) throw new AppError({ status: response.status, code: response.status === 402 ? ERROR_CODES.INSUFFICIENT_CREDITS : ERROR_CODES.UNAVAILABLE, message: body.message || 'Không cập nhật được ví Credit ERP.' });
  if (body.status === 'MISSING' || operation === 'reserve' && body.status !== 'RESERVED') throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Trạng thái giao dịch Credit ERP không hợp lệ.' });
  return body;
}
