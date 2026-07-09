import { getAccessToken } from "./authService";

export type NotifType = "kho" | "task" | "training" | "he-thong";

export interface WebNotification {
  _id: string;
  title: string;
  body: string;
  type: NotifType;
  companyCode: string;
  recipientUid: string;
  read: boolean;
  action?: {
    tab: string;
    subTab?: string;
  };
  createdAt: string;
}

export interface GetNotificationsResponse {
  status: string;
  data: WebNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

async function parseApiResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const rawBody = await res.text();
  const isJson = contentType.includes("application/json");

  if (!rawBody) {
    if (!res.ok) {
      throw new Error(fallbackMessage);
    }
    return {} as T;
  }

  if (!isJson) {
    const shortBody = rawBody.slice(0, 120).trim();
    throw new Error(
      `${fallbackMessage}. API trả về dữ liệu không phải JSON (${res.status} ${res.statusText}). Preview: ${shortBody}`
    );
  }

  let data: any;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`${fallbackMessage}. Không parse được JSON từ server.`);
  }

  if (!res.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data as T;
}

export const notificationService = {
  /**
   * Lấy danh sách thông báo phân trang của người dùng đăng nhập
   */
  async getNotifications(params: {
    page?: number;
    limit?: number;
    read?: boolean;
    type?: NotifType;
  } = {}): Promise<GetNotificationsResponse> {
    const queryParts: string[] = [];
    if (params.page !== undefined) queryParts.push(`page=${params.page}`);
    if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
    if (params.read !== undefined) queryParts.push(`read=${params.read}`);
    if (params.type !== undefined) queryParts.push(`type=${params.type}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

    const res = await fetch(`/api/v1/notifications${queryString}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    return await parseApiResponse<GetNotificationsResponse>(
      res,
      "Không thể tải danh sách thông báo"
    );
  },

  /**
   * Đánh dấu một thông báo đã đọc
   */
  async markAsRead(id: string): Promise<WebNotification> {
    const res = await fetch(`/api/v1/notifications/${id}/read`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    const result = await parseApiResponse<{ data: WebNotification }>(
      res,
      "Không thể đánh dấu đọc thông báo"
    );
    return result.data;
  },

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  async markAllAsRead(): Promise<boolean> {
    const res = await fetch("/api/v1/notifications/read-all", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    const result = await parseApiResponse<{ status: string }>(
      res,
      "Không thể đánh dấu đọc tất cả thông báo"
    );
    return result.status === "success";
  },

  /**
   * Xóa thông báo
   */
  async deleteNotification(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/notifications/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    const result = await parseApiResponse<{ status: string }>(
      res,
      "Không thể xóa thông báo"
    );
    return result.status === "success";
  },
};
