import { getAccessToken } from "./authService";

export interface SocialIntegration {
  _id?: string;
  companyCode?: string;
  platform: "Facebook" | "TikTok" | "Zalo";
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isConnected: boolean;
  connectedAt?: string;
  createdBy: string;
  blotatoAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiredAt?: string;
  isMock?: boolean;
}

export const socialIntegrationService = {
  /**
   * Lấy danh sách liên kết mạng xã hội của doanh nghiệp (tự lọc theo companyCode trên server)
   */
  async getIntegrations(platform?: string): Promise<SocialIntegration[]> {
    const query = platform ? `?platform=${encodeURIComponent(platform)}` : "";
    const res = await fetch(`/api/v1/crud/social-integrations${query}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy danh sách liên kết mạng xã hội.");
    }

    const result = await res.json();
    return result.data || [];
  },

  /**
   * Tạo liên kết mạng xã hội mới cho doanh nghiệp
   */
  async createIntegration(data: Partial<SocialIntegration>): Promise<SocialIntegration> {
    const res = await fetch("/api/v1/crud/social-integrations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể thêm tài khoản liên kết.");
    }

    const result = await res.json();
    return result.data;
  },

  /**
   * Cập nhật thông tin liên kết mạng xã hội
   */
  async updateIntegration(id: string, data: Partial<SocialIntegration>): Promise<SocialIntegration> {
    const res = await fetch(`/api/v1/crud/social-integrations/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể cập nhật tài khoản liên kết.");
    }

    const result = await res.json();
    return result.data;
  },

  /**
   * Xóa liên kết mạng xã hội
   */
  async deleteIntegration(id: string): Promise<void> {
    const res = await fetch(`/api/v1/crud/social-integrations/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể xóa tài khoản liên kết.");
    }
  }
};
