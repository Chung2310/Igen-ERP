import { logger } from "./logger";
import { PayOS } from "@payos/node";

const clientId = process.env.PAYOS_CLIENT_ID || "";
const apiKey = process.env.PAYOS_API_KEY || "";
const checksumKey = process.env.PAYOS_CHECKSUM_KEY || "";

export const isPayOSConfigured = !!(clientId && apiKey && checksumKey);

let payOSClient: any = null;

if (isPayOSConfigured) {
  try {
    payOSClient = new PayOS({ clientId, apiKey, checksumKey });
    logger.info("[PayOS Config] Khởi tạo PayOS Client thành công.");
  } catch (error) {
    logger.error("[PayOS Config] Lỗi khi khởi tạo PayOS Client:", error);
  }
} else {
  logger.warn("[PayOS Config] Thiếu PAYOS_CLIENT_ID, PAYOS_API_KEY hoặc PAYOS_CHECKSUM_KEY trong file .env.");
  logger.warn("[PayOS Config] Hệ thống ví sẽ hoạt động ở chế độ MOCK MODE.");
}

export const payOS = payOSClient;
