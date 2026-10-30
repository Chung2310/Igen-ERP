import { getAccessToken } from "./authService";
import { apiFetch } from "../modules/shared/lib/apiFetch";
import { StockLog, StockLogItem, StockLogPurpose } from "../types";

export type StockLogCreateInput = {
  idempotencyKey?: string;
  type: "nhập" | "xuất";
  purpose?: StockLogPurpose;
  customerId?: string;
  customerName?: string;
  title: string;
  operatorName: string;
  notes: string;
  status: "Đang chờ" | "Đang xử lý" | "Hoàn thành";
  items: StockLogItem[];
  sku: string;
  productName: string;
  quantity: number;
  createdAt?: string;
  warehouseId?: string;
};

export type StockLogUpdateInput = StockLogCreateInput & { id: string };

function toIsoDateString(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

const activeListeners = new Set<() => void>();

export const inventoryStockLogService = {
  async reverseOutbound(id: string, reason: string, branchId: string): Promise<{ _id: string }> {
    const result = await apiFetch<{ data: { _id: string } }>(`/inventory/stock-logs/${id}/reverse`, { method: "POST", headers: { "x-branch-id": branchId }, body: JSON.stringify({ reason }) });
    inventoryStockLogService.notifySubscribers();
    return result.data;
  },
  subscribe(branchId: string, callback: (logs: StockLog[]) => void, onError?: (error: unknown) => void) {
    const controller = new AbortController();
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/v1/crud/stock-logs?sort=-createdAt", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
            "x-branch-id": branchId,
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Không thể tải lịch sử kho hàng.");
        }
        const json = await res.json();
        const logs = (json.data || []).map((item: any) => ({
          ...item,
          id: item._id,
          title: typeof item.title === "string" ? item.title : "",
          notes: typeof item.notes === "string" ? item.notes : "",
          operatorName: typeof item.operatorName === "string" ? item.operatorName : "",
          createdAt:
            typeof item.createdAt === "string"
              ? item.createdAt
              : new Date(item.createdAt || Date.now()).toISOString(),
        }));
        if (controller.signal.aborted) return;
        callback(logs);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (onError) {
          onError(err);
        } else {
          console.error("Lỗi khi tải lịch sử kho:", err);
        }
      }
    };

    fetchLogs();
    activeListeners.add(fetchLogs);
    const interval = setInterval(fetchLogs, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
      activeListeners.delete(fetchLogs);
    };
  },

  notifySubscribers() {
    activeListeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("Lỗi khi notify stock log subscribers:", err);
      }
    });
  },

  async createLog(input: StockLogCreateInput, branchId?: string): Promise<string> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      if (branchId) {
        headers["x-branch-id"] = branchId;
      }
      const res = await fetch("/api/v1/crud/stock-logs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          idempotencyKey: input.idempotencyKey,
          type: input.type,
          purpose: input.type === "xuất" ? input.purpose : undefined,
          customerId: input.customerId,
          customerName: input.customerName,
          title: input.title,
          items: input.items,
          sku: input.sku,
          productName: input.productName,
          quantity: input.quantity,
          operatorName: input.operatorName,
          notes: input.notes,
          status: input.status,
          createdAt: toIsoDateString(input.createdAt),
          warehouseId: input.warehouseId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Tạo lịch sử kho thất bại.");
      }

      const json = await res.json();
      inventoryStockLogService.notifySubscribers();
      return json.data._id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updateLog(id: string, input: StockLogCreateInput, branchId?: string): Promise<void> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      if (branchId) {
        headers["x-branch-id"] = branchId;
      }
      const res = await fetch(`/api/v1/crud/stock-logs/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          type: input.type,
          purpose: input.type === "xuất" ? input.purpose : undefined,
          customerId: input.customerId,
          customerName: input.customerName,
          title: input.title,
          items: input.items,
          sku: input.sku,
          productName: input.productName,
          quantity: input.quantity,
          operatorName: input.operatorName,
          notes: input.notes,
          status: input.status,
          updatedAt: new Date().toLocaleString("vi-VN"),
          warehouseId: input.warehouseId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Cập nhật lịch sử kho thất bại.");
      }

      inventoryStockLogService.notifySubscribers();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async saveImportedLog(id: string, input: StockLogCreateInput, branchId?: string): Promise<void> {
    try {
      const checkHeaders: Record<string, string> = {
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      if (branchId) {
        checkHeaders["x-branch-id"] = branchId;
      }
      const checkRes = await fetch(`/api/v1/crud/stock-logs/${id}`, {
        headers: checkHeaders,
      });

      const bodyData = {
        type: input.type,
        purpose: input.type === "xuất" ? input.purpose : undefined,
        title: input.title,
        items: input.items,
        sku: input.sku,
        productName: input.productName,
        quantity: input.quantity,
        operatorName: input.operatorName,
        notes: input.notes,
        status: input.status,
        createdAt: toIsoDateString(input.createdAt),
      };

      const mutationHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      if (branchId) {
        mutationHeaders["x-branch-id"] = branchId;
      }

      let res;
      if (checkRes.ok) {
        res = await fetch(`/api/v1/crud/stock-logs/${id}`, {
          method: "PATCH",
          headers: mutationHeaders,
          body: JSON.stringify(bodyData),
        });
      } else {
        res = await fetch("/api/v1/crud/stock-logs", {
          method: "POST",
          headers: mutationHeaders,
          body: JSON.stringify({
            ...bodyData,
            _id: id,
          }),
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Lưu lịch sử kho import thất bại.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async deleteLog(id: string, branchId?: string): Promise<void> {
    try {
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      if (branchId) {
        headers["x-branch-id"] = branchId;
      }
      const res = await fetch(`/api/v1/crud/stock-logs/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Xóa lịch sử kho thất bại.");
      }

      inventoryStockLogService.notifySubscribers();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
