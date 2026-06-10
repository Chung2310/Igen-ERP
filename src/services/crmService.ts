import { getAccessToken } from "./authService";
import { LeadCard } from "../types";

export interface LeadProductSelection {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ExtendedLeadCard extends LeadCard {
  lastInteractionTime?: string;
  createdAt?: any;
  updatedAt?: any;
  selectedProducts?: LeadProductSelection[];
}

function logCrmTiming(
  operation: "subscribe" | "create" | "update" | "delete" | "bulkUpdate",
  startedAt: number,
  details?: Record<string, unknown>
) {
  const durationMs = Date.now() - startedAt;
  console.info(`[CRM:${operation}]`, {
    durationMs,
    ...details,
  });
}

export const crmService = {
  async getLeads(): Promise<ExtendedLeadCard[]> {
    const res = await fetch("/api/v1/crud/crm-tickets", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      throw new Error("Không thể tải danh sách cơ hội bán hàng.");
    }
    const json = await res.json();
    return (json.data || []).map((item: any) => ({
      ...item,
      id: item._id, // Bản đồ MongoDB _id sang id
    }));
  },

  subscribeLeads(callback: (leads: ExtendedLeadCard[]) => void, onError?: (error: unknown) => void) {
    const fetchLeads = async () => {
      try {
        const data = await this.getLeads();
        callback(data);
      } catch (err) {
        if (onError) {
          onError(err);
        } else {
          console.error("Lỗi khi tải danh sách leads:", err);
        }
      }
    };

    fetchLeads();
    const interval = setInterval(fetchLeads, 5000);
    return () => clearInterval(interval);
  },

  async createLead(lead: Omit<ExtendedLeadCard, "id">): Promise<string> {
    const startedAt = Date.now();
    const res = await fetch("/api/v1/crud/crm-tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        ...lead,
        createdAt: Date.now(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Tạo cơ hội bán hàng thất bại.");
    }

    const json = await res.json();
    logCrmTiming("create", startedAt, { id: json.data._id });
    return json.data._id;
  },

  async updateLead(id: string, lead: Partial<ExtendedLeadCard>): Promise<void> {
    const startedAt = Date.now();
    const res = await fetch(`/api/v1/crud/crm-tickets/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        ...lead,
        updatedAt: Date.now(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Cập nhật cơ hội bán hàng thất bại.");
    }

    logCrmTiming("update", startedAt, { id, fields: Object.keys(lead) });
  },

  async deleteLead(id: string): Promise<void> {
    const startedAt = Date.now();
    const res = await fetch(`/api/v1/crud/crm-tickets/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Xóa cơ hội bán hàng thất bại.");
    }

    logCrmTiming("delete", startedAt, { id });
  },

  async bulkUpdateLeads(updates: Array<{ id: string; lead: Partial<ExtendedLeadCard> }>): Promise<void> {
    const startedAt = Date.now();
    if (updates.length === 0) return;

    await Promise.all(
      updates.map(({ id, lead }) => this.updateLead(id, lead))
    );

    logCrmTiming("bulkUpdate", startedAt, {
      count: updates.length,
      ids: updates.map(({ id }) => id),
    });
  },
};
