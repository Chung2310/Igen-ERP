// Nạp biến môi trường sớm nhất có thể. Module này phải là import ĐẦU TIÊN của server.ts
// để đảm bảo mọi module khác đọc process.env đều nhận được giá trị từ .env.
import "dotenv/config";

// Các giá trị placeholder từng ship trong .env.example — coi như chưa cấu hình.
const PLACEHOLDER_PATTERN = /your_jwt/i;

function requireSecret(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value || PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(
      `[env] Biến môi trường ${name} chưa được cấu hình hoặc đang dùng giá trị placeholder. ` +
        `Sinh secret mới bằng lệnh: openssl rand -hex 64`
    );
  }
  return value;
}

export function getJwtAccessSecret(): string {
  return requireSecret("JWT_ACCESS_SECRET");
}

export function getJwtRefreshSecret(): string {
  return requireSecret("JWT_REFRESH_SECRET");
}

export function getSuperAdminEncryptionKey(): Buffer {
  const value = (process.env.SUPERADMIN_ENCRYPTION_KEY || "").trim();
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error("[env] SUPERADMIN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.");
  return Buffer.from(value, "hex");
}

export function getDeploymentEnv(): "staging" | "production" {
  const value = (process.env.DEPLOYMENT_ENV || "").trim().toLowerCase();
  if (value !== "staging" && value !== "production") throw new Error("[env] DEPLOYMENT_ENV must be staging or production.");
  return value;
}

/**
 * Gọi khi khởi động server: kiểm tra toàn bộ secret bắt buộc,
 * thiếu cái nào thì từ chối khởi động thay vì chạy với giá trị mặc định không an toàn.
 */
export function assertSecurityEnv(): void {
  getJwtAccessSecret();
  getJwtRefreshSecret();
  getSuperAdminEncryptionKey();
  getDeploymentEnv();
}
