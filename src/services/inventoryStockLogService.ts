import { getAccessToken } from "./authService";
import { StockLog, StockLogItem } from "../types";

const COLLECTION_NAME = "inventoryStockLogs";

export type StockLogCreateInput = {
  type: "nhập" | "xuất";
  title: string;
  operatorName: string;
  notes: string;
  status: "Đang chờ" | "Đang xử lý" | "Hoàn thành";
  items: StockLogItem[];
  sku: string;
  productName: string;
  quantity: number;
  createdAt?: string;
};

export type StockLogUpdateInput = StockLogCreateInput & { id: string };

function toIsoDateString(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export const inventoryStockLogService = {
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
    const interval = setInterval(fetchLogs, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  },

  async createLog(input: StockLogCreateInput): Promise<string> {
    try {
      const res = await fetch("/api/v1/crud/stock-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          type: input.type,
          title: input.title,
          items: input.items,
          sku: input.sku,
          productName: input.productName,
          quantity: input.quantity,
          operatorName: input.operatorName,
          notes: input.notes,
          status: input.status,
          createdAt: toIsoDateString(input.createdAt),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Tạo lịch sử kho thất bại.");
      }

      const json = await res.json();
      return json.data._id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updateLog(id: string, input: StockLogCreateInput): Promise<void> {
    try {
      const res = await fetch(`/api/v1/crud/stock-logs/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          type: input.type,
          title: input.title,
          items: input.items,
          sku: input.sku,
          productName: input.productName,
          quantity: input.quantity,
          operatorName: input.operatorName,
          notes: input.notes,
          status: input.status,
          updatedAt: new Date().toLocaleString("vi-VN"),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Cập nhật lịch sử kho thất bại.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async saveImportedLog(id: string, input: StockLogCreateInput): Promise<void> {
    try {
      const checkRes = await fetch(`/api/v1/crud/stock-logs/${id}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      const bodyData = {
        type: input.type,
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

      let res;
      if (checkRes.ok) {
        res = await fetch(`/api/v1/crud/stock-logs/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(bodyData),
        });
      } else {
        res = await fetch("/api/v1/crud/stock-logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
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

  async deleteLog(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/v1/crud/stock-logs/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Xóa lịch sử kho thất bại.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
