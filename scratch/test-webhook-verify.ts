import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

import { opusclipService } from "../server/service/opusclip.service";

const testKey = process.env.OPUSCLIP_API_KEY || "sk-opus-api-key-placeholder";

const payload = JSON.stringify({
  projectId: "proj_abc123",
  stage: "COMPLETE",
  error: ""
});
const salt = "a1b2c3d4e5f6";
const timestamp = Math.floor(Date.now() / 1000).toString();

// Tính toán chữ ký hợp lệ: HMAC-SHA256(testKey, payload + salt)
const expectedSignature = crypto
  .createHmac("sha256", testKey)
  .update(payload + salt)
  .digest("hex");

const headers = {
  "x-opus-salt": salt,
  "x-opus-signature": expectedSignature,
  "x-opus-timestamp": timestamp
};

console.log("=== CHẠY KIỂM THỬ XÁC THỰC CHỮ KÝ WEBHOOK OPUSCLIP ===");

// 1. Kiểm thử trường hợp chữ ký chuẩn xác, salt mới, timestamp mới
const resultValid = opusclipService.verifyWebhookSignature(payload, headers);
console.log("1. Chữ ký hợp lệ, thời gian chuẩn:", resultValid ? "ĐẠT (true)" : "THẤT BẠI (false)");

// 2. Kiểm thử trường hợp Body bị thay đổi (giả mạo gói tin)
const resultModified = opusclipService.verifyWebhookSignature(payload + " ", headers);
console.log("2. Body bị giả mạo (kỳ vọng false):", !resultModified ? "ĐẠT (false)" : "THẤT BẠI (true)");

// 3. Kiểm thử trường hợp gói tin cũ (Timestamp quá hạn 10 phút)
const staleTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
const staleSignature = crypto
  .createHmac("sha256", testKey)
  .update(payload + salt)
  .digest("hex");
const headersStale = {
  ...headers,
  "x-opus-signature": staleSignature,
  "x-opus-timestamp": staleTimestamp
};
const resultStale = opusclipService.verifyWebhookSignature(payload, headersStale);
console.log("3. Gói tin cũ quá 10 phút (kỳ vọng false):", !resultStale ? "ĐẠT (false)" : "THẤT BẠI (true)");

// 4. Kiểm thử Replay attack (gửi lại gói tin trùng salt)
const resultReplay = opusclipService.verifyWebhookSignature(payload, headers);
console.log("4. Tấn công Replay gửi lại salt cũ (kỳ vọng false):", !resultReplay ? "ĐẠT (false)" : "THẤT BẠI (true)");

if (resultValid && !resultModified && !resultStale && !resultReplay) {
  console.log("\nTẤT CẢ KIỂM THỬ XÁC THỰC WEBHOOK ĐÃ ĐẠT! ✅");
  process.exit(0);
} else {
  console.error("\nCÓ KIỂM THỬ THẤT BẠI! ❌");
  process.exit(1);
}
