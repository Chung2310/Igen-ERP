import { logger } from '../config/logger.js';
import DeviceSession from '../models/DeviceSession.js';
import { Types, type QueryFilter } from 'mongoose';
import type { IDeviceSession } from '../models/DeviceSession.js';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, unknown>;
  priority?: 'default' | 'normal' | 'high';
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH_SIZE = 100;
const TIMEOUT_MS = 10_000;

/**
 * Gửi một batch push notifications qua Expo Push API.
 * Trả về số lượng gửi thành công.
 */
async function sendBatch(messages: ExpoPushMessage[]): Promise<number> {
  if (messages.length === 0) return 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn({ status: response.status, statusText: response.statusText }, 'Expo Push API trả về lỗi HTTP');
      return 0;
    }

    const result = (await response.json()) as { data?: ExpoPushReceipt[] };
    const tickets = result.data ?? [];
    const succeeded = tickets.filter((t) => t.status === 'ok').length;
    const failed = tickets.filter((t) => t.status === 'error');

    if (failed.length > 0) {
      logger.warn({ failedCount: failed.length, errors: failed.slice(0, 3) }, 'Một số push notification gửi thất bại');
    }

    return succeeded;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      logger.warn({ timeoutMs: TIMEOUT_MS }, 'Expo Push API timeout');
    } else {
      logger.error({ err: error }, 'Lỗi khi gửi Expo Push Notification');
    }
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Gửi push notification đến tất cả thiết bị ACTIVE của một user.
 * Trả về số thiết bị đã gửi thành công.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<number> {
  if (!userId || !Types.ObjectId.isValid(userId)) return 0;

  const filter: QueryFilter<IDeviceSession> = {
    userId: new Types.ObjectId(userId),
    clientType: 'MOBILE',
    status: 'ACTIVE',
    pushToken: { $ne: '' },
  };
  const sessions = await DeviceSession.find(filter).lean();

  const validTokens = sessions
    .map((s) => s.pushToken)
    .filter((token): token is string => Boolean(token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))));

  if (validTokens.length === 0) return 0;

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    sound: 'default' as const,
    priority: 'high' as const,
    data: payload.data,
  }));

  let totalSent = 0;
  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const batch = messages.slice(i, i + MAX_BATCH_SIZE);
    totalSent += await sendBatch(batch);
  }

  return totalSent;
}

/**
 * Gửi push notification đến nhiều users cùng lúc.
 * Trả về tổng số thiết bị đã gửi thành công.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<number> {
  const validIds = userIds.filter((id) => id && Types.ObjectId.isValid(id));
  if (validIds.length === 0) return 0;

  const filter: QueryFilter<IDeviceSession> = {
    userId: { $in: validIds.map((id) => new Types.ObjectId(id)) },
    clientType: 'MOBILE',
    status: 'ACTIVE',
    pushToken: { $ne: '' },
  };
  const sessions = await DeviceSession.find(filter).lean();

  const validTokens = sessions
    .map((s) => s.pushToken)
    .filter((token): token is string => Boolean(token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))));

  if (validTokens.length === 0) return 0;

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    sound: 'default' as const,
    priority: 'high' as const,
    data: payload.data,
  }));

  let totalSent = 0;
  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const batch = messages.slice(i, i + MAX_BATCH_SIZE);
    totalSent += await sendBatch(batch);
  }

  return totalSent;
}
