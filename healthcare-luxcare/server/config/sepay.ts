import { timingSafeEqual } from "node:crypto";

export function getWalletPaymentProvider() {
  const provider = process.env.WALLET_PAYMENT_PROVIDER?.trim().toLowerCase() || "payos";
  if (provider !== "payos" && provider !== "sepay") {
    throw Object.assign(new Error("Cấu hình phương thức nạp tiền không hợp lệ."), { statusCode: 503 });
  }
  return provider;
}

export function getSePayConfig() {
  const config = {
    webhookKey: process.env.SEPAY_WEBHOOK_API_KEY?.trim() || "",
    bank: process.env.SEPAY_BANK_CODE?.trim() || "",
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER?.trim() || "",
    accountName: process.env.SEPAY_ACCOUNT_NAME?.trim() || "",
    qrAccountNumber: process.env.SEPAY_QR_ACCOUNT_NUMBER?.trim() || process.env.SEPAY_ACCOUNT_NUMBER?.trim() || "",
    subAccount: process.env.SEPAY_SUB_ACCOUNT?.trim() || "",
    transferNote: process.env.SEPAY_TRANSFER_NOTE?.trim() || "",
  };
  if (!config.webhookKey || !config.bank || !config.accountNumber) {
    throw Object.assign(new Error("Nạp tiền chuyển khoản chưa được cấu hình đầy đủ."), { statusCode: 503 });
  }
  return config;
}

export function verifySePayAuthorization(header: string | undefined, key: string): boolean {
  const match = header?.match(/^Apikey\s+(\S+)$/i);
  if (!key || !match) return false;
  const received = Buffer.from(match[1]);
  const expected = Buffer.from(key);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
