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

export async function superAdminRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("x-device-id", getSuperAdminDeviceId());
  const token = localStorage.getItem("accessToken");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error: any = new Error(data.message || "Yêu cầu thất bại"); error.correlationId = data.correlationId; throw error; }
  return data;
}
