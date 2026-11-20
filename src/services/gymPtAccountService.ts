import { getAccessToken } from "./authService";

type PtAccountFields = {
  fullName: string;
  email: string;
  phone: string;
  password?: string;
};

async function request(path: string, method: "POST" | "PATCH" | "DELETE", body?: object): Promise<void> {
  const response = await fetch(`/api/v1/gym/api/users${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Không thể quản lý tài khoản PT.");
  }
}

export const gymPtAccountService = {
  create(fields: PtAccountFields & { password: string }) {
    return request("", "POST", {
      username: fields.email.trim().toLowerCase(),
      role: "PT",
      fullName: fields.fullName.trim(),
      email: fields.email.trim().toLowerCase(),
      phone: fields.phone.trim(),
      password: fields.password,
    });
  },
  update(gymAccountId: string, fields: PtAccountFields) {
    return request(`/${gymAccountId}`, "PATCH", {
      fullName: fields.fullName.trim(),
      email: fields.email.trim().toLowerCase(),
      phone: fields.phone.trim(),
      ...(fields.password ? { password: fields.password } : {}),
    });
  },
  remove(gymAccountId: string) {
    return request(`/${gymAccountId}`, "DELETE");
  },
};
