import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getEnv, type AppEnv } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { BankTransferDetails } from '../models/PaymentOrder.js';
import type { GatewayCallbackResult } from './paymentGatewayTypes.js';

const LEGACY_ORDER_CODE = /^CR[A-F0-9]{20}$/;
// A short payment prefix must contain a letter: bank references can be 10-13 digits.
const SHORT_ORDER_CODE = /^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,5}[0-9]{8}$/;
const ORDER_CODE = /^(?:CR[A-F0-9]{20}|(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,5}[0-9]{8})$/;
// Accept both the new short code and persisted legacy payment codes.
const PAYMENT_CODE = /^(?:(?:[A-Z0-9]{2,5})?CR[A-F0-9]{20}|(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,5}[0-9]{8})$/;
const normalized = (value: string) => value.trim().toUpperCase();

// Resolve both current codes and the prefixed codes stored on legacy orders.
export function sepayOrderCodeFromPaymentCode(paymentCode: string): string | undefined {
  if (!PAYMENT_CODE.test(paymentCode)) return undefined;
  return SHORT_ORDER_CODE.test(paymentCode) ? paymentCode : paymentCode.slice(-22);
}

// VietQR uses MB; MBB is commonly entered as the bank's stock ticker.
function qrBankCode(value: string): string {
  const code = value.trim();
  return code.toUpperCase() === 'MBB' ? 'MB' : code;
}

function config(env: AppEnv) {
  const bankCode = qrBankCode(env.SEPAY_BANK_CODE || '');
  const bankName = env.SEPAY_BANK_NAME?.trim();
  const accountNumber = env.SEPAY_ACCOUNT_NUMBER?.trim();
  const accountHolder = env.SEPAY_ACCOUNT_HOLDER?.trim();
  const qrAccount = env.SEPAY_QR_ACCOUNT_NUMBER?.trim() || accountNumber;
  const secret = env.SEPAY_WEBHOOK_API_KEY?.trim();
  const prefix = env.SEPAY_TRANSFER_PREFIX?.trim() || '';
  const note = normalized(env.SEPAY_TRANSFER_NOTE || '');
  if (!bankCode || !bankName || !accountNumber || !accountHolder || !qrAccount || !secret
    || !/^[a-zA-Z0-9]{1,19}$/.test(accountNumber) || !/^[a-zA-Z0-9]{1,19}$/.test(qrAccount)
    || !/^[a-zA-Z0-9 ]{0,40}$/.test(prefix)
    || (note !== '' && (!/^[A-Z0-9]{2,5}$/.test(note) || !/[A-Z]/.test(note)))) return null;
  return { bankCode, bankName, accountNumber, accountHolder, qrAccount, secret, prefix, note };
}

export function isSepayConfigured(env: AppEnv = getEnv()): boolean {
  return config(env) !== null;
}

export function createSepayOrderCode(env: AppEnv = getEnv()): string {
  const note = normalized(env.SEPAY_TRANSFER_NOTE || '');
  return note
    ? note + String(randomInt(0, 100_000_000)).padStart(8, '0')
    : 'CR' + randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase();
}

export function createSepayPayment(
  input: { orderCode: string; amountVnd: number },
  env: AppEnv = getEnv(),
): BankTransferDetails {
  const settings = config(env);
  if (!settings) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'SePay chưa được cấu hình đầy đủ.' });
  if (!ORDER_CODE.test(input.orderCode) || !Number.isSafeInteger(input.amountVnd) || input.amountVnd < 10_000 || input.amountVnd > 50_000_000) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Thông tin chuyển khoản SePay không hợp lệ.' });
  }
  return {
    bankCode: settings.bankCode,
    bankName: settings.bankName,
    accountNumber: settings.qrAccount,
    accountHolder: settings.accountHolder,
    content: [settings.prefix, LEGACY_ORDER_CODE.test(input.orderCode)
      ? settings.note + input.orderCode
      : [input.orderCode.slice(0, -8), input.orderCode].join(' ')].filter(Boolean).join(' '),
    webhookAccountNumber: settings.accountNumber,
    subAccount: env.SEPAY_SUB_ACCOUNT?.trim() || '',
  };
}

export function sepayQrUrl(transfer: BankTransferDetails, amountVnd: number): string {
  const url = new URL('https://vietqr.app/img');
  url.search = new URLSearchParams({
    acc: transfer.accountNumber, bank: qrBankCode(transfer.bankCode), amount: String(amountVnd),
    des: transfer.content, template: 'compact', showinfo: 'true', fullacc: 'true',
    holder: transfer.accountHolder,
  }).toString();
  return url.toString();
}

// Authenticate before parsing any payload; the key never leaves the backend.
export function verifySepayCallback(
  input: Record<string, unknown>,
  authorization: string | undefined,
  env: AppEnv = getEnv(),
): GatewayCallbackResult | null {
  const secret = env.SEPAY_WEBHOOK_API_KEY?.trim();
  if (!secret) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Webhook SePay chưa được cấu hình.' });
  const provided = /^Apikey (\S+)$/i.exec(authorization || '')?.[1] || '';
  const expectedBytes = Buffer.from(secret);
  const actualBytes = Buffer.from(provided);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Xác thực webhook SePay không hợp lệ.' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Dữ liệu webhook SePay không hợp lệ.' });
  }
  if (input.transferType === 'out') return null;
  if (input.transferType !== 'in') throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Loại giao dịch SePay không hợp lệ.' });
  const code = typeof input.code === 'string' ? normalized(input.code) : '';
  const content = typeof input.content === 'string' ? normalized(input.content) : '';
  const matches = Array.from(content.matchAll(/(?:^|[^A-Z0-9])((?:[A-Z0-9]{2,5})?CR[A-F0-9]{20}|(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,5}[0-9]{8})(?=$|[^A-Z0-9])/g), match => match[1]);
  const codes = new Set(matches);
  if (PAYMENT_CODE.test(code)) codes.add(code);
  if (!codes.size) return null; // An unrelated bank transfer is acknowledged, never credited.
  if (codes.size !== 1 || (code && !PAYMENT_CODE.test(code))) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Mã thanh toán SePay không rõ ràng.' });
  }
  const amount = input.transferAmount;
  const id = input.id;
  const transactionId = typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    ? String(id) : typeof id === 'string' && /^[1-9]\d*$/.test(id) ? id : '';
  if (!transactionId || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0
    || typeof input.accountNumber !== 'string' || !input.accountNumber.trim()
    || typeof input.gateway !== 'string' || !input.gateway.trim()
    || (input.subAccount != null && typeof input.subAccount !== 'string')) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Giao dịch SePay thiếu hoặc sai thông tin.' });
  }
  return {
    valid: true, success: true, orderCode: sepayOrderCodeFromPaymentCode([...codes][0]), paymentCode: [...codes][0], amountVnd: amount,
    transactionId, resultCode: 'SEPAY_IN',
    recipient: {
      bankName: input.gateway.trim(), accountNumber: input.accountNumber.trim(),
      subAccount: typeof input.subAccount === 'string' ? input.subAccount.trim() : '',
    },
  };
}
