import { isValidPassword, PASSWORD_ERROR } from '../services/passwordPolicy.js';
export type NodeEnvironment = 'development' | 'test' | 'production';

export const APP_POLICY = Object.freeze({
  JWT_ISSUER: '3s-gym',
  JWT_AUDIENCE: '3s-gym-api',
  JWT_ALGORITHM: 'HS256' as const,
  TRUST_PROXY: false as const,
  JSON_BODY_LIMIT: '1mb',
  PROVIDER_TIMEOUT_MS: 300_000,
  AUTH_RATE_LIMIT_PER_15M: 20,
  AI_RATE_LIMIT_PER_MINUTE: 10,
  AI_COMPANY_PAID_DAILY_CALLS_PER_USER: 10,
  AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER: 100,
  AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER: 1_000,
  AI_GLOBAL_MONTHLY_BUDGET_VND: 10_000_000,
  AI_GLOBAL_MAX_RESERVATION_VND: 10_000,
  OCR_MAX_FILE_BYTES: 8_388_608,
  SHUTDOWN_TIMEOUT_MS: 10_000,
  AI_MODEL: 'deepseek/deepseek-v4-flash',
  OCR_MODEL: 'qwen/qwen3-vl-32b-instruct',
  VECTOR_SEARCH_INDEX: 'knowledge-vector',
  LOG_MAX_DEPTH: 4,
  LOG_MAX_COLLECTION_ITEMS: 25,
  LOG_MAX_STRING_LENGTH: 2_000,
  ERROR_DEBUG: false as const,
});

export interface AppEnv {
  NODE_ENV: NodeEnvironment;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_ALGORITHM: 'HS256';
  PORT: number;
  CORS_ORIGINS: string[];
  TRUST_PROXY: boolean | number | string;
  JSON_BODY_LIMIT: string;
  PROVIDER_TIMEOUT_MS: number;
  AUTH_RATE_LIMIT_PER_15M: number;
  AI_RATE_LIMIT_PER_MINUTE: number;
  AI_COMPANY_PAID_DAILY_CALLS_PER_USER?: number;
  AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER?: number;
  AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER?: number;
  AI_GLOBAL_MONTHLY_BUDGET_VND: number;
  AI_GLOBAL_MAX_RESERVATION_VND: number;
  OCR_MAX_FILE_BYTES: number;
  AI_MODEL: string;
  OCR_MODEL: string;
  APP_URL?: string;
  SUPER_ADMIN_USERNAME: string;
  SUPER_ADMIN_PASSWORD: string;
  SUPER_ADMIN_FULL_NAME?: string;
  VNPAY_TMN_CODE?: string;
  VNPAY_HASH_SECRET?: string;
  VNPAY_PAYMENT_URL?: string;
  VNPAY_RETURN_URL?: string;
  VNPAY_IPN_URL?: string;
  MOMO_PARTNER_CODE?: string;
  MOMO_ACCESS_KEY?: string;
  MOMO_SECRET_KEY?: string;
  MOMO_API_URL?: string;
  MOMO_REDIRECT_URL?: string;
  MOMO_IPN_URL?: string;
  SEPAY_BANK_CODE?: string;
  SEPAY_BANK_NAME?: string;
  SEPAY_ACCOUNT_NUMBER?: string;
  SEPAY_ACCOUNT_HOLDER?: string;
  SEPAY_QR_ACCOUNT_NUMBER?: string;
  SEPAY_SUB_ACCOUNT?: string;
  SEPAY_TRANSFER_PREFIX?: string;
  SEPAY_TRANSFER_NOTE?: string;
  SEPAY_WEBHOOK_API_KEY?: string;
  PAYOS_CLIENT_ID?: string;
  PAYOS_API_KEY?: string;
  PAYOS_CHECKSUM_KEY?: string;
  PAYOS_RETURN_URL?: string;
  PAYOS_CANCEL_URL?: string;
}

let currentEnvironment: AppEnv | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnvironment: NodeEnvironment = source.NODE_ENV === 'production'
    ? 'production'
    : source.NODE_ENV === 'test' ? 'test' : 'development';
  const requiredKeys = process.env.GYM_EMBEDDED === '1'
    ? ['MONGODB_URI', 'JWT_SECRET']
    : nodeEnvironment === 'production'
      ? ['MONGODB_URI', 'JWT_SECRET', 'SUPER_ADMIN_USERNAME', 'SUPER_ADMIN_PASSWORD']
      : nodeEnvironment === 'test' ? [] : ['SUPER_ADMIN_USERNAME', 'SUPER_ADMIN_PASSWORD'];
  const missing = requiredKeys.filter((key) => !source[key]?.trim());
  if (missing.length) throw new Error(`Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
  // Existing deployments may retain a legacy six-digit bootstrap credential; new users are checked by createUser.
  if (source.SUPER_ADMIN_PASSWORD && !isValidPassword(source.SUPER_ADMIN_PASSWORD) && !/^\d{6}$/.test(source.SUPER_ADMIN_PASSWORD)) {
    throw new Error("SUPER_ADMIN_PASSWORD: " + PASSWORD_ERROR);
  }

  const jwtSecret = source.JWT_SECRET?.trim()
    || (nodeEnvironment === 'test' ? 'secret_key' : '');
  if (nodeEnvironment === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET phải có ít nhất 32 ký tự.');
  }

  const port = Number(source.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT không hợp lệ.');

  const optional = (key: string) => source[key]?.trim() || undefined;
  const positiveLimit = (key: string, fallback: number) => {
    const raw = source[key]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000) {
      throw new Error(`${key} phải là số nguyên trong khoảng 1 đến 1000000.`);
    }
    return value;
  };
  const positiveBudget = (key: string, fallback: number) => {
    const raw = source[key]?.trim();
    if (!raw) {
      if (nodeEnvironment === 'production') throw new Error(`${key} phải được cấu hình trong production.`);
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000_000) {
      throw new Error(`${key} phải là số nguyên trong khoảng 1 đến 1000000000000.`);
    }
    return value;
  };
  const globalAiMonthlyBudgetVnd = positiveBudget('AI_GLOBAL_MONTHLY_BUDGET_VND', APP_POLICY.AI_GLOBAL_MONTHLY_BUDGET_VND);
  const globalAiMaxReservationVnd = positiveBudget('AI_GLOBAL_MAX_RESERVATION_VND', APP_POLICY.AI_GLOBAL_MAX_RESERVATION_VND);
  if (globalAiMaxReservationVnd > globalAiMonthlyBudgetVnd) {
    throw new Error('AI_GLOBAL_MAX_RESERVATION_VND cannot exceed AI_GLOBAL_MONTHLY_BUDGET_VND.');
  }
  currentEnvironment = {
    NODE_ENV: nodeEnvironment,
    MONGODB_URI: source.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27017/3s-gym-test',
    JWT_SECRET: jwtSecret,
    JWT_ISSUER: APP_POLICY.JWT_ISSUER,
    JWT_AUDIENCE: APP_POLICY.JWT_AUDIENCE,
    JWT_ALGORITHM: APP_POLICY.JWT_ALGORITHM,
    PORT: port,
    CORS_ORIGINS: (source.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
    TRUST_PROXY: APP_POLICY.TRUST_PROXY,
    JSON_BODY_LIMIT: APP_POLICY.JSON_BODY_LIMIT,
    PROVIDER_TIMEOUT_MS: Number(source.PROVIDER_TIMEOUT_MS) || APP_POLICY.PROVIDER_TIMEOUT_MS,
    AUTH_RATE_LIMIT_PER_15M: Number(source.AUTH_RATE_LIMIT_PER_15M) || (nodeEnvironment === 'development' ? 1_000 : APP_POLICY.AUTH_RATE_LIMIT_PER_15M),
    AI_RATE_LIMIT_PER_MINUTE: APP_POLICY.AI_RATE_LIMIT_PER_MINUTE,
    AI_COMPANY_PAID_DAILY_CALLS_PER_USER: positiveLimit('AI_COMPANY_PAID_DAILY_CALLS_PER_USER', APP_POLICY.AI_COMPANY_PAID_DAILY_CALLS_PER_USER),
    AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER: positiveLimit('AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER', APP_POLICY.AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER),
    AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER: positiveLimit('AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER', APP_POLICY.AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER),
    AI_GLOBAL_MONTHLY_BUDGET_VND: globalAiMonthlyBudgetVnd,
    AI_GLOBAL_MAX_RESERVATION_VND: globalAiMaxReservationVnd,
    OCR_MAX_FILE_BYTES: APP_POLICY.OCR_MAX_FILE_BYTES,
    AI_MODEL: source.AI_MODEL?.trim() || source.OPENROUTER_MODEL?.trim() || APP_POLICY.AI_MODEL,
    OCR_MODEL: source.OCR_MODEL?.trim() || source.OPENROUTER_OCR_MODEL?.trim() || APP_POLICY.OCR_MODEL,
    APP_URL: optional('APP_URL'),
    SUPER_ADMIN_USERNAME: optional('SUPER_ADMIN_USERNAME') || '',
    SUPER_ADMIN_PASSWORD: optional('SUPER_ADMIN_PASSWORD') || '',
    SUPER_ADMIN_FULL_NAME: optional('SUPER_ADMIN_FULL_NAME'),
    VNPAY_TMN_CODE: optional('VNPAY_TMN_CODE'),
    VNPAY_HASH_SECRET: optional('VNPAY_HASH_SECRET'),
    VNPAY_PAYMENT_URL: optional('VNPAY_PAYMENT_URL'),
    VNPAY_RETURN_URL: optional('VNPAY_RETURN_URL'),
    VNPAY_IPN_URL: optional('VNPAY_IPN_URL'),
    MOMO_PARTNER_CODE: optional('MOMO_PARTNER_CODE'),
    MOMO_ACCESS_KEY: optional('MOMO_ACCESS_KEY'),
    MOMO_SECRET_KEY: optional('MOMO_SECRET_KEY'),
    MOMO_API_URL: optional('MOMO_API_URL'),
    MOMO_REDIRECT_URL: optional('MOMO_REDIRECT_URL'),
    MOMO_IPN_URL: optional('MOMO_IPN_URL'),
    SEPAY_BANK_CODE: optional('SEPAY_BANK_CODE'),
    SEPAY_BANK_NAME: optional('SEPAY_BANK_NAME'),
    SEPAY_ACCOUNT_NUMBER: optional('SEPAY_ACCOUNT_NUMBER'),
    SEPAY_ACCOUNT_HOLDER: optional('SEPAY_ACCOUNT_HOLDER'),
    SEPAY_QR_ACCOUNT_NUMBER: optional('SEPAY_QR_ACCOUNT_NUMBER'),
    SEPAY_SUB_ACCOUNT: optional('SEPAY_SUB_ACCOUNT'),
    SEPAY_TRANSFER_PREFIX: optional('SEPAY_TRANSFER_PREFIX'),
    SEPAY_TRANSFER_NOTE: optional('SEPAY_TRANSFER_NOTE'),
    SEPAY_WEBHOOK_API_KEY: optional('SEPAY_WEBHOOK_API_KEY'),
    PAYOS_CLIENT_ID: optional('PAYOS_CLIENT_ID'),
    PAYOS_API_KEY: optional('PAYOS_API_KEY'),
    PAYOS_CHECKSUM_KEY: optional('PAYOS_CHECKSUM_KEY'),
    PAYOS_RETURN_URL: optional('PAYOS_RETURN_URL'),
    PAYOS_CANCEL_URL: optional('PAYOS_CANCEL_URL'),
  };
  return currentEnvironment;
}

export function getEnv(): AppEnv {
  if (!currentEnvironment) return loadEnv(process.env);
  return currentEnvironment;
}
