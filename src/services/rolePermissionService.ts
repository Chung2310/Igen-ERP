import { getAccessToken } from "./authService";

export interface RolePermission {
  _id?: string;
  companyCode: string;
  role: string;
  permissions: string[];
  level: number;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  _id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
}

export const rolePermissionService = {
  /**
   * Lấy danh sách cấu hình phân quyền vai trò của doanh nghiệp
   */
  async getRolePermissions(companyCode?: string): Promise<RolePermission[]> {
    const queryParams = companyCode ? `?companyCode=${encodeURIComponent(companyCode)}` : "";
    const res = await fetch(`/api/v1/role-permissions${queryParams}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy danh sách cấu hình vai trò.");
    }

    const result = await res.json();
    return result.data || [];
  },

  /**
   * Tạo mới hoặc cập nhật cấu hình phân quyền vai trò
   */
  async saveRolePermission(roleData: {
    role: string;
    level: number;
    permissions: string[];
    displayName?: string;
    companyCode?: string;
  }): Promise<RolePermission> {
    const res = await fetch("/api/v1/role-permissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(roleData),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể cập nhật cấu hình vai trò.");
    }

    const result = await res.json();
    return result.data;
  },

  /**
   * Xóa cấu hình phân quyền vai trò
   */
  async deleteRolePermission(role: string, companyCode?: string): Promise<void> {
    const queryParams = companyCode ? `?companyCode=${encodeURIComponent(companyCode)}` : "";
    const res = await fetch(`/api/v1/role-permissions/${encodeURIComponent(role)}${queryParams}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể xóa cấu hình vai trò.");
    }
  },

  /**
   * Lấy toàn bộ danh sách mã quyền hệ thống phục vụ việc tick chọn
   */
  async getPermissions(): Promise<Permission[]> {
    const res = await fetch("/api/v1/permissions?limit=100", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy danh sách quyền hệ thống.");
    }

    const result = await res.json();
    return result.data || [];
  }
};
