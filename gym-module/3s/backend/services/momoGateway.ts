import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv, type AppEnv } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { fetchWithTimeout } from './providerRequest.js';
import type { GatewayCallbackResult, GatewayCreateInput, GatewayPaymentResult } from './paymentGatewayTypes.js';

type MomoConfig = Required<Pick<AppEnv, 'MOMO_PARTNER_CODE' | 'MOMO_ACCESS_KEY' | 'MOMO_SECRET_KEY' | 'MOMO_API_URL' | 'MOMO_REDIRECT_URL' | 'MOMO_IPN_URL'>>;

function configuration(env: AppEnv): MomoConfig | null {
  const keys = ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY', 'MOMO_API_URL', 'MOMO_REDIRECT_URL', 'MOMO_IPN_URL'] as const;
  if (keys.some((key) => !env[key])) return null;
  return env as AppEnv & MomoConfig;
}

export function isMomoConfigured(env: AppEnv = getEnv()) { return configuration(env) !== null; }

function hmac(raw: string, secret: string) { return createHmac('sha256', secret).update(raw).digest('hex'); }
function equalHex(actual: string, expected: string) {
  if (!/^[a-f\d]+$/i.test(actual) || !/^[a-f\d]+$/i.test(expected)) return false;
  const left = Buffer.from(actual, 'hex'); const right = Buffer.from(expected, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createMomoPayment(input: GatewayCreateInput, env: AppEnv = getEnv()): Promise<GatewayPaymentResult> {
  const config = configuration(env);
  if (!config) return { configured: false };
  const requestId = input.requestId || input.orderCode;
  const amount = String(input.amountVnd);
  const extraData = '';
  const requestType = 'captureWallet';
  const raw = `accessKey=${config.MOMO_ACCESS_KEY}&amount=${amount}&extraData=${extraData}&ipnUrl=${config.MOMO_IPN_URL}&orderId=${input.orderCode}&orderInfo=${input.description}&partnerCode=${config.MOMO_PARTNER_CODE}&redirectUrl=${config.MOMO_REDIRECT_URL}&requestId=${requestId}&requestType=${requestType}`;
  const body = {
    partnerCode: config.MOMO_PARTNER_CODE, partnerName: '3S Gym', storeId: '3SGYM', requestId,
    amount, orderId: input.orderCode, orderInfo: input.description, redirectUrl: config.MOMO_REDIRECT_URL,
    ipnUrl: config.MOMO_IPN_URL, lang: 'vi', requestType, autoCapture: true, extraData,
    signature: hmac(raw, config.MOMO_SECRET_KEY),
  };
  const response = await fetchWithTimeout(config.MOMO_API_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }, env.PROVIDER_TIMEOUT_MS);
  const result = await response.json() as { resultCode?: number; payUrl?: string };
  if (result.resultCode !== 0 || !result.payUrl) throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'MoMo không trả về liên kết thanh toán hợp lệ.' });
  return { configured: true, redirectUrl: result.payUrl };
}

export function verifyMomoCallback(input: Record<string, unknown>, env: AppEnv = getEnv()): GatewayCallbackResult {
  const config = configuration(env);
  if (!config) return { valid: false };
  const field = (key: string) => String(input[key] ?? '');
  const raw = `accessKey=${config.MOMO_ACCESS_KEY}&amount=${field('amount')}&extraData=${field('extraData')}&message=${field('message')}&orderId=${field('orderId')}&orderInfo=${field('orderInfo')}&orderType=${field('orderType')}&partnerCode=${field('partnerCode')}&payType=${field('payType')}&requestId=${field('requestId')}&responseTime=${field('responseTime')}&resultCode=${field('resultCode')}&transId=${field('transId')}`;
  const valid = equalHex(field('signature'), hmac(raw, config.MOMO_SECRET_KEY));
  const amountVnd = Number(field('amount'));
  return {
    valid, orderCode: field('orderId'), amountVnd: Number.isSafeInteger(amountVnd) && amountVnd >= 0 ? amountVnd : undefined,
    transactionId: field('transId'), resultCode: field('resultCode'), success: field('resultCode') === '0',
  };
}
