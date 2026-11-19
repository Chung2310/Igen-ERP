import { PayOS, type CreatePaymentLinkRequest, type Webhook } from '@payos/node';
import { getEnv, type AppEnv } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { GatewayCallbackResult, GatewayCreateInput, GatewayPaymentResult } from './paymentGatewayTypes.js';

type PayosConfig = Required<Pick<AppEnv, 'PAYOS_CLIENT_ID' | 'PAYOS_API_KEY' | 'PAYOS_CHECKSUM_KEY'>>;

function configuration(env: AppEnv): PayosConfig | null {
  const keys = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'] as const;
  if (keys.some((key) => !env[key]?.trim())) return null;
  return env as AppEnv & PayosConfig;
}

export function isPayosConfigured(env: AppEnv = getEnv()): boolean {
  return configuration(env) !== null;
}

let cachedClient: PayOS | undefined;
let cachedChecksumKey: string | undefined;

function getPayosClient(env: AppEnv): PayOS | null {
  const config = configuration(env);
  if (!config) return null;
  if (!cachedClient || cachedChecksumKey !== config.PAYOS_CHECKSUM_KEY) {
    cachedClient = new PayOS({
      clientId: config.PAYOS_CLIENT_ID,
      apiKey: config.PAYOS_API_KEY,
      checksumKey: config.PAYOS_CHECKSUM_KEY,
    });
    cachedChecksumKey = config.PAYOS_CHECKSUM_KEY;
  }
  return cachedClient;
}

function sanitizeDescription(desc: string, orderCode: string): string {
  // PayOS description max 25 characters, alphanumeric/spaces only
  const clean = desc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
  if (clean.length > 0 && clean.length <= 25) return clean;
  return `Nap credit ${orderCode.slice(-10)}`.slice(0, 25);
}

export async function createPayosPayment(
  input: GatewayCreateInput,
  env: AppEnv = getEnv(),
): Promise<GatewayPaymentResult> {
  const client = getPayosClient(env);
  if (!client) return { configured: false };

  const numericOrderCode = Number(input.orderCode);
  if (!Number.isSafeInteger(numericOrderCode) || numericOrderCode <= 0) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      message: 'Mã đơn hàng không đúng định dạng số hợp lệ.',
    });
  }

  const returnUrl = env.PAYOS_RETURN_URL || 'http://localhost:3008/portal/wallet/payment-result';
  const cancelUrl = env.PAYOS_CANCEL_URL || 'http://localhost:3008/portal/wallet';
  const description = sanitizeDescription(input.description, input.orderCode);

  const payload: CreatePaymentLinkRequest = {
    orderCode: numericOrderCode,
    amount: input.amountVnd,
    description,
    returnUrl,
    cancelUrl,
    expiredAt: Math.floor((Date.now() + 15 * 60_000) / 1000),
  };

  try {
    const link = await client.paymentRequests.create(payload);
    return {
      configured: true,
      redirectUrl: link.checkoutUrl,
      qrCode: link.qrCode,
      paymentLinkId: link.paymentLinkId,
    };
  } catch (error) {
    throw new AppError({
      status: 502,
      code: ERROR_CODES.EXTERNAL,
      message: `Không thể tạo liên kết thanh toán: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
    });
  }
}

export async function verifyPayosCallback(
  input: Record<string, unknown>,
  env: AppEnv = getEnv(),
): Promise<GatewayCallbackResult> {
  const client = getPayosClient(env);
  if (!client) return { valid: false };

  try {
    const webhookData = await client.webhooks.verify(input as unknown as Webhook);
    const amountVnd = Number(webhookData.amount);
    const orderCode = String(webhookData.orderCode);
    const transactionId = webhookData.reference || webhookData.paymentLinkId || String(webhookData.orderCode);
    const success = webhookData.code === '00';

    return {
      valid: true,
      orderCode,
      amountVnd: Number.isSafeInteger(amountVnd) && amountVnd >= 0 ? amountVnd : undefined,
      transactionId,
      resultCode: webhookData.code,
      success,
    };
  } catch {
    return { valid: false };
  }
}

export async function getPayosPaymentInfo(
  orderCodeOrId: number | string,
  env: AppEnv = getEnv(),
) {
  const client = getPayosClient(env);
  if (!client) return null;

  try {
    const numeric = typeof orderCodeOrId === 'string' ? Number(orderCodeOrId) : orderCodeOrId;
    if (Number.isSafeInteger(numeric)) {
      return await client.paymentRequests.get(numeric);
    }
    return await client.paymentRequests.get(String(orderCodeOrId));
  } catch {
    return null;
  }
}
