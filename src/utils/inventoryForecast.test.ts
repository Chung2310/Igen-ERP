import { describe, expect, it } from "vitest";
import { buildInventoryForecast } from "./inventoryForecast";
import type { ProductItem, StockLog } from "../types";

const now = new Date(2026, 9, 21, 12);
const product = { id: "p1", sku: "SKU1", name: "Máy", category: "", unit: "", stock: 100, minStockAlert: 5, price: 0, status: "Active", demandForecast: "Ổn định", imageUrl: "" } as ProductItem;
const saleLog = (daysAgo: number, purpose: StockLog["purpose"] = "bán", quantity = 2) => {
  const date = new Date(now); date.setDate(now.getDate() - daysAgo);
  return { id: `log-${daysAgo}-${purpose}`, type: "xuất", status: "Hoàn thành", purpose, createdAt: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`, sku: "SKU1", productName: "Máy", quantity, operatorName: "test", notes: "" } as StockLog;
};

describe("kiểm định dự báo tồn kho", () => {
  it("accepts a stable sales pattern after comparing the held-out 14 days", () => {
    const logs = Array.from({ length: 44 }, (_, index) => saleLog(index + 1));
    const forecast = buildInventoryForecast([product], logs, now);
    expect(forecast.validatedSkuCount).toBe(1);
    expect(forecast.items[0].validation).toMatchObject({ evaluated: true, accepted: true, actual14Days: 28, predicted14Days: 28, errorPercent: 0 });
  });
  it("excludes warehouse transfers from demand and suppresses unvalidated recommendations", () => {
    const logs = Array.from({ length: 44 }, (_, index) => saleLog(index + 1, "chuyển kho", 50));
    const forecast = buildInventoryForecast([product], logs, now);
    expect(forecast.items[0].last30DaysDemand).toBe(0);
    expect(forecast.validatedSkuCount).toBe(0);
    expect(forecast.recommendations).toHaveLength(0);
  });
  it("keeps the configured minimum stock alert even without forecast quality", () => {
    const forecast = buildInventoryForecast([{ ...product, stock: 3 }], [], now);
    expect(forecast.warningItems).toHaveLength(1);
    expect(forecast.validatedSkuCount).toBe(0);
  });
});
