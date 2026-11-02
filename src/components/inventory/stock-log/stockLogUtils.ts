import React from "react";
import { ProductItem, StockLog, StockLogPurpose } from "../../../types";

export type TransactionStatus = "Đang chờ" | "Đang xử lý" | "Hoàn thành";

export type DraftLine = {
  productId: string;
  variantId?: string;
  sku?: string;
  productName?: string;
  quantity: string;
  unitIdentifiers?: string[];
  serialNumbers?: string[];
};

export type DraftPayload = {
  id?: string;
  type: "nhập" | "xuất";
  purpose?: StockLogPurpose;
  customerId?: string;
  customerName?: string;
  title: string;
  operatorName: string;
  notes: string;
  status: TransactionStatus;
  items: Array<{
    productId: string;
    variantId?: string;
    sku?: string;
    productName?: string;
    quantity: number;
    unitIdentifiers?: string[];
    serialNumbers?: string[];
  }>;
  warehouseId?: string;
};

export interface StockLogStatsData {
  total: number;
  inboundCount: number;
  inboundQty: number;
  outboundCount: number;
  outboundQty: number;
  posSalesCount: number;
  posSalesQty: number;
  pendingCount: number;
}

/**
 * Khoá định danh một dòng phiếu theo sản phẩm + SKU thay vì theo vị trí trong mảng.
 */
export const lineUnitKey = (line: { productId: string; sku?: string }) =>
  `${line.productId}::${line.sku || ""}`;

export function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

export function formatLogDate(dateString?: string) {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${time} · ${date}`;
  } catch {
    return dateString;
  }
}

export function getInitials(name?: string) {
  if (!name) return "NV";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getLogStatus(log: StockLog): TransactionStatus {
  const status = String(log.status);
  if (status === "Đang chờ" || status === "Đang xử lý" || status === "Hoàn thành") {
    return status;
  }
  return status === "Thành công" ? "Hoàn thành" : "Đang xử lý";
}

export function getStatusTone(status: TransactionStatus) {
  if (status === "Hoàn thành") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Đang xử lý") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function getStatusKey(status: TransactionStatus) {
  const normalized = String(status).toLowerCase();
  if (normalized.startsWith("h")) return "completed";
  if (normalized.includes("x")) return "processing";
  return "pending";
}

export function getTypeKey(type: StockLog["type"]) {
  return String(type).toLowerCase().startsWith("x") ? "outbound" : "inbound";
}

export function getLogItems(log: StockLog): Array<{
  productId?: string;
  variantId?: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  unitCost?: number;
  category?: string;
  unitIdentifiers?: string[];
  serialNumbers?: string[];
}> {
  const typedLog = log as StockLog & {
    items?: Array<{
      productId?: string;
      variantId?: string;
      sku: string;
      productName: string;
      quantity: number;
      unitPrice?: number;
      lineTotal?: number;
      unitCost?: number;
      category?: string;
      unitIdentifiers?: string[];
      serialNumbers?: string[];
    }>;
  };

  if (typedLog.items?.length) {
    return typedLog.items;
  }

  const legacyLog = log as any;
  return [
    {
      sku: log.sku,
      productName: log.productName,
      quantity: log.quantity,
      unitPrice: legacyLog.unitPrice,
      lineTotal: legacyLog.lineTotal,
      unitCost: legacyLog.unitCost,
      category: legacyLog.category,
      unitIdentifiers: legacyLog.unitIdentifiers,
      serialNumbers: legacyLog.serialNumbers,
    },
  ];
}

export function getLogTitle(log: StockLog) {
  const typedLog = log as StockLog & { title?: string };
  if (typedLog.title) return typedLog.title;
  return `${log.type === "nhập" ? "Nhập kho" : "Xuất kho"}: ${log.productName}`;
}

/**
 * Kiểm tra xem phiếu này có phải là giao dịch bán hàng từ POS / bán lẻ không
 */
export function isPosSalesLog(log: StockLog): boolean {
  if (log.type !== "xuất") return false;
  if (log.purpose === "bán") return true;
  const logAny = log as any;
  if (
    logAny.channel === "pos" ||
    logAny.source === "pos" ||
    Boolean(logAny.posOrderId) ||
    Boolean(logAny.orderId)
  ) {
    return true;
  }
  const text = `${log.title || ""} ${log.notes || ""} ${log.id || ""}`.toLowerCase();
  return (
    text.includes("pos") ||
    text.includes("bán lẻ") ||
    text.includes("bán hàng") ||
    text.includes("hóa đơn") ||
    text.includes("đơn hàng")
  );
}

export type DatePreset = "all" | "today" | "yesterday" | "7days" | "30days" | "this_month" | "custom";

export function isLogWithinDateRange(
  dateString?: string,
  preset: DatePreset = "all",
  startDate?: string,
  endDate?: string
): boolean {
  if (preset === "all" && !startDate && !endDate) return true;
  if (!dateString) return false;

  const logDate = new Date(dateString);
  if (isNaN(logDate.getTime())) return true;

  const now = new Date();

  if (preset === "today") {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return logDate >= startOfToday && logDate <= endOfToday;
  }

  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    return logDate >= startOfYesterday && logDate <= endOfYesterday;
  }

  if (preset === "7days") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return logDate >= sevenDaysAgo && logDate <= now;
  }

  if (preset === "30days") {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    return logDate >= thirtyDaysAgo && logDate <= now;
  }

  if (preset === "this_month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return logDate >= startOfMonth && logDate <= endOfMonth;
  }

  // Custom range with startDate / endDate in "YYYY-MM-DD" format
  if (startDate) {
    const [sYear, sMonth, sDay] = startDate.split("-").map(Number);
    if (sYear && sMonth && sDay) {
      const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
      if (logDate < start) return false;
    }
  }

  if (endDate) {
    const [eYear, eMonth, eDay] = endDate.split("-").map(Number);
    if (eYear && eMonth && eDay) {
      const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
      if (logDate > end) return false;
    }
  }

  return true;
}

export function getPresetDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const formatYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  if (preset === "today") {
    const todayStr = formatYmd(now);
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yestStr = formatYmd(yesterday);
    return { startDate: yestStr, endDate: yestStr };
  }

  if (preset === "7days") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return { startDate: formatYmd(sevenDaysAgo), endDate: formatYmd(now) };
  }

  if (preset === "30days") {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return { startDate: formatYmd(thirtyDaysAgo), endDate: formatYmd(now) };
  }

  if (preset === "this_month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: formatYmd(startOfMonth), endDate: formatYmd(endOfMonth) };
  }

  return { startDate: "", endDate: "" };
}
