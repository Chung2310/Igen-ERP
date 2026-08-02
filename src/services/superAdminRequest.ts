import { toast } from "../pages/Toast";

const DEVICE_ID_KEY = "igen_super_admin_device_id_v1";
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getSuperAdminDeviceId(storage: Pick<Storage, "getItem" | "setItem"> = localStorage, createUuid: () => string = () => crypto.randomUUID()): string {
  const current = storage.getItem(DEVICE_ID_KEY);
  if (current && CANONICAL_UUID.test(current)) return current;
  const created = createUuid().toLowerCase();
  if (!CANONICAL_UUID.test(created)) throw new Error("Không thể tạo mã thiết bị hợp lệ");
  storage.setItem(DEVICE_ID_KEY, created);
  return created;
}

type SuperAdminRequestInit = RequestInit & {
  successMessage?: string;
  suppressSuccessToast?: boolean;
  suppressErrorToast?: boolean;
};

function defaultSuccessMessage(method: string, path: string): string {
  if (path.endsWith("/auth/login")) return "Đăng nhập SuperAdmin thành công.";
  if (path.endsWith("/auth/logout")) return "Đăng xuất SuperAdmin thành công.";
  if (method === "DELETE" && path.includes("/auth/sessions/")) return "Đã thu hồi phiên đăng nhập thành công.";
  if (path.endsWith("/modules")) return "Đã cập nhật cấu hình module thành công.";
  if (path.endsWith("/lifecycle")) return "Đã cập nhật trạng thái doanh nghiệp thành công.";
  if (path.endsWith("/deletion")) return method === "DELETE" ? "Đã hủy lịch xóa doanh nghiệp." : "Đã lên lịch xóa doanh nghiệp thành công.";
  if (path.endsWith("/lock")) return "Đã khóa tài khoản thành công.";
  if (path.endsWith("/unlock")) return "Đã mở khóa tài khoản thành công.";
  if (path.endsWith("/sessions/revoke")) return "Đã thu hồi các phiên đăng nhập thành công.";
  if (path.endsWith("/2fa/reset")) return "Đã đặt lại xác thực hai bước thành công.";
  if (path.endsWith("/role")) return "Đã cập nhật vai trò và quyền thành công.";
  if (path.includes("/impersonation")) return method === "DELETE" ? "Đã kết thúc phiên đăng nhập thay." : "Đã bắt đầu phiên đăng nhập thay thành công.";
  if (method === "POST" && /\/super-admin\/tenants\/?$/.test(path)) return "Đã tạo doanh nghiệp thành công.";
  if (method === "POST" && /\/super-admin\/admins\/?$/.test(path)) return "Đã tạo tài khoản SuperAdmin thành công.";
  if (method === "POST") return "Thao tác tạo mới đã hoàn tất thành công.";
  if (method === "PUT" || method === "PATCH") return "Thay đổi đã được lưu thành công.";
  if (method === "DELETE") return "Thao tác xóa hoặc thu hồi đã hoàn tất thành công.";
  return "Thao tác đã hoàn tất thành công.";
}

export async function superAdminRequest(path: string, init: SuperAdminRequestInit = {}) {
  const { successMessage, suppressSuccessToast = false, suppressErrorToast = false, ...requestInit } = init;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("x-device-id", getSuperAdminDeviceId());
  const token = localStorage.getItem("accessToken");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...requestInit, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !suppressErrorToast) {
    const message = data.message || "Không thể hoàn tất thao tác. Vui lòng thử lại.";
    const correlationId = data.correlationId || data.requestId || data.error?.requestId;
    toast.error(correlationId ? `${message} (Mã đối soát: ${correlationId})` : message);
  }
  if (!response.ok) { const error: any = new Error(data.message || "Yêu cầu thất bại"); error.correlationId = data.correlationId; throw error; }
  const method = String(requestInit.method || "GET").toUpperCase();
  if (method !== "GET" && !suppressSuccessToast) {
    toast.success(successMessage || (typeof data.message === "string" ? data.message : defaultSuccessMessage(method, path)));
  }
  return data;
}
