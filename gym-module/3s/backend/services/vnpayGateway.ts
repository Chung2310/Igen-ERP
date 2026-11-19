import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv, type AppEnv } from '../config/env.js';
import type { GatewayCallbackResult, GatewayCreateInput, GatewayPaymentResult } from './paymentGatewayTypes.js';

type VnpayConfig = Required<Pick<AppEnv, 'VNPAY_TMN_CODE' | 'VNPAY_HASH_SECRET' | 'VNPAY_PAYMENT_URL' | 'VNPAY_RETURN_URL' | 'VNPAY_IPN_URL'>>;

function configuration(env: AppEnv): VnpayConfig | null {
  const keys = ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_PAYMENT_URL', 'VNPAY_RETURN_URL', 'VNPAY_IPN_URL'] as const;
  if (keys.some((key) => !env[key])) return null;
  return env as AppEnv & VnpayConfig;
}

export function isVnpayConfigured(env: AppEnv = getEnv()) { return configuration(env) !== null; }

function formatVnpayDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}${value('month')}${value('day')}${value('hour')}${value('minute')}${value('second')}`;
}

function sortedSearchParams(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const key of Object.keys(values).sort()) params.append(key, values[key] || '');
  return params;
}

function sign(values: Record<string, string>, secret: string) {
  return createHmac('sha512', secret).update(sortedSearchParams(values).toString()).digest('hex');
}

function equalHex(actual: string, expected: string) {
  if (!/^[a-f\d]+$/i.test(actual) || !/^[a-f\d]+$/i.test(expected)) return false;
  const left = Buffer.from(actual, 'hex'); const right = Buffer.from(expected, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createVnpayPayment(input: GatewayCreateInput, env: AppEnv = getEnv()): GatewayPaymentResult {
  const config = configuration(env);
  if (!config) return { configured: false };
  const createdAt = input.createdAt || new Date();
  const expiresAt = new Date(createdAt.getTime() + 15 * 60_000);
  const values: Record<string, string> = {
    vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: config.VNPAY_TMN_CODE,
    vnp_Amount: String(input.amountVnd * 100), vnp_CurrCode: 'VND', vnp_TxnRef: input.orderCode,
    vnp_OrderInfo: input.description, vnp_OrderType: 'other', vnp_Locale: 'vn',
    vnp_ReturnUrl: config.VNPAY_RETURN_URL, vnp_IpAddr: input.ipAddress || '127.0.0.1',
    vnp_CreateDate: formatVnpayDate(createdAt), vnp_ExpireDate: formatVnpayDate(expiresAt),
  };
  const params = sortedSearchParams(values);
  params.append('vnp_SecureHash', sign(values, config.VNPAY_HASH_SECRET));
  return { configured: true, redirectUrl: `${config.VNPAY_PAYMENT_URL}?${params.toString()}` };
}

export function verifyVnpayCallback(input: Record<string, unknown>, env: AppEnv = getEnv()): GatewayCallbackResult {
  const config = configuration(env);
  if (!config) return { valid: false };
  const signature = String(input.vnp_SecureHash || '');
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType' && value !== undefined) values[key] = String(value);
  }
  const valid = equalHex(signature, sign(values, config.VNPAY_HASH_SECRET));
  const scaledAmount = Number(values.vnp_Amount);
  const amountVnd = Number.isSafeInteger(scaledAmount) && scaledAmount >= 0 && scaledAmount % 100 === 0 ? scaledAmount / 100 : undefined;
  return {
    valid, orderCode: values.vnp_TxnRef, amountVnd,
    transactionId: values.vnp_TransactionNo, resultCode: values.vnp_ResponseCode,
    success: values.vnp_ResponseCode === '00' && values.vnp_TransactionStatus === '00',
  };
}
