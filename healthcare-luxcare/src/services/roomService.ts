import { browserTransport, type ServiceTransport } from "./serviceTransport";

export type RoomType = "clinic" | "office" | "storage" | "treatment" | "meeting" | "other";

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  clinic: "Phòng khám",
  office: "Văn phòng / Làm việc",
  storage: "Kho vật tư / Dược",
  treatment: "Phòng thủ thuật / Điều trị",
  meeting: "Phòng họp / Hội chẩn",
  other: "Khác",
};

export interface RoomRecord {
  _id: string;
  companyCode: string;
  branchId: string;
  code: string;
  name: string;
  type: RoomType;
  floor?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  equipmentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomInput {
  branchId: string;
  code: string;
  name: string;
  type?: RoomType;
  floor?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export function createRoomService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = getAccessToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || `Lỗi hệ thống (${res.status})`);
    }
    return body.data;
  }

  return {
    list: (params?: { branchId?: string; activeOnly?: boolean; search?: string; type?: string }) => {
      const q = new URLSearchParams();
      if (params?.branchId) q.set("branchId", params.branchId);
      if (params?.activeOnly) q.set("activeOnly", "true");
      if (params?.search) q.set("search", params.search);
      if (params?.type) q.set("type", params.type);
      const qs = q.toString();
      return request<RoomRecord[]>(`/api/v1/rooms${qs ? `?${qs}` : ""}`);
    },

    getById: (id: string) => request<RoomRecord>(`/api/v1/rooms/${encodeURIComponent(id)}`),

    create: (input: RoomInput) =>
      request<RoomRecord>("/api/v1/rooms", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    update: (id: string, input: Partial<RoomInput>) =>
      request<RoomRecord>(`/api/v1/rooms/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/v1/rooms/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),

    merge: (branchId: string, sourceLocationTexts: string[], targetRoomId: string) =>
      request<{ modifiedCount: number; targetRoom: RoomRecord }>("/api/v1/rooms/merge", {
        method: "POST",
        body: JSON.stringify({ branchId, sourceLocationTexts, targetRoomId }),
      }),

    getUnmapped: (branchId?: string) => {
      const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
      return request<Array<{ name: string; count: number }>>(`/api/v1/rooms/unmapped${q}`);
    },
  };
}

export const roomService = createRoomService(browserTransport);

