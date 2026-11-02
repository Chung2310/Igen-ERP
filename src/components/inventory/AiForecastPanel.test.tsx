// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { AiForecastPanel } from "./AiForecastPanel";
import { InventoryForecastSummary } from "../../types";

// Mock inventoryReceivingService
vi.mock("../../services/inventoryReceivingService", () => ({
  inventoryReceivingService: {
    listBalances: vi.fn().mockResolvedValue([]),
  },
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

afterEach(() => {
  cleanup();
});

describe("AiForecastPanel Component", () => {
  const mockForecast: InventoryForecastSummary = {
    items: [
      {
        productId: "p-1",
        sku: "SKU-IP15P-128",
        name: "iPhone 15 Pro 128GB",
        category: "Điện thoại",
        currentStock: 0,
        minStockAlert: 5,
        averageDailyDemand: 2.5,
        last7DaysDemand: 20,
        last30DaysDemand: 75,
        forecast30Days: 75,
        daysOfCover: 0,
        suggestedReorderQty: 80,
        overstockDays: null,
        riskLevel: "high",
        series: [
          { isoDate: "2026-03-01", label: "03-01", actual: 3, forecast: 0, period: "history" },
          { isoDate: "2026-03-02", label: "03-02", actual: 2, forecast: 0, period: "history" },
          { isoDate: "2026-03-03", label: "03-03", actual: 0, forecast: 2.5, period: "forecast" },
        ],
      },
      {
        productId: "p-2",
        sku: "SKU-CASE-15P",
        name: "Ốp lưng iPhone 15 Pro",
        category: "Phụ kiện",
        currentStock: 120,
        minStockAlert: 10,
        averageDailyDemand: 0.2,
        last7DaysDemand: 1,
        last30DaysDemand: 6,
        forecast30Days: 6,
        daysOfCover: 600,
        suggestedReorderQty: 0,
        overstockDays: 570,
        riskLevel: "low",
        series: [
          { isoDate: "2026-03-01", label: "03-01", actual: 1, forecast: 0, period: "history" },
          { isoDate: "2026-03-02", label: "03-02", actual: 0, forecast: 0, period: "history" },
          { isoDate: "2026-03-03", label: "03-03", actual: 0, forecast: 0.2, period: "forecast" },
        ],
      },
      {
        productId: "p-3",
        sku: "SKU-CHG-20W",
        name: "Củ sạc nhanh 20W",
        category: "Phụ kiện",
        currentStock: 15,
        minStockAlert: 10,
        averageDailyDemand: 1.0,
        last7DaysDemand: 7,
        last30DaysDemand: 30,
        forecast30Days: 30,
        daysOfCover: 15,
        suggestedReorderQty: 0,
        overstockDays: 0,
        riskLevel: "low",
        series: [
          { isoDate: "2026-03-01", label: "03-01", actual: 1, forecast: 0, period: "history" },
          { isoDate: "2026-03-02", label: "03-02", actual: 1, forecast: 0, period: "history" },
          { isoDate: "2026-03-03", label: "03-03", actual: 0, forecast: 1.0, period: "forecast" },
        ],
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        sku: "SKU-IP15P-128",
        productName: "iPhone 15 Pro 128GB",
        tone: "danger",
        title: "Nên nhập thêm 80 SKU-IP15P-128",
        body: "Tồn hiện tại 0, nhu cầu 30 ngày dự kiến 75 sp, đã hết hàng hoàn toàn.",
      },
    ],
    warningItems: [],
    hasHistoricalDemand: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hiển thị đúng dải MetricBar 4 khoang và số liệu tổng hợp", async () => {
    render(<AiForecastPanel forecast={mockForecast} stockLogs={[]} />);

    // Check MetricBar items
    expect(screen.getByText("Quy mô & Nhu cầu")).toBeTruthy();
    expect(screen.getByText("Hết hàng & Cần nhập")).toBeTruthy();
    expect(screen.getByText("Tồn cao & Đọng vốn")).toBeTruthy();
  });

  it("lọc danh sách SKU trong bảng theo tìm kiếm", async () => {
    render(<AiForecastPanel forecast={mockForecast} stockLogs={[]} />);

    const searchInput = screen.getByPlaceholderText("Tìm theo sản phẩm, mã SKU...");
    fireEvent.change(searchInput, { target: { value: "Ốp lưng" } });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Ốp lưng iPhone 15 Pro")).toBeTruthy();
    expect(within(table).queryByText("iPhone 15 Pro 128GB")).toBeNull();
  });

  it("lọc theo nút phân loại rủi ro (Cần nhập ngay vs Tồn cao)", async () => {
    render(<AiForecastPanel forecast={mockForecast} stockLogs={[]} />);

    // Click "Cần nhập ngay"
    const needOrderButton = screen.getByRole("button", { name: /Cần nhập ngay/i });
    fireEvent.click(needOrderButton);

    const table = screen.getByRole("table");
    expect(within(table).getByText("SKU-IP15P-128")).toBeTruthy();
    expect(within(table).queryByText("SKU-CASE-15P")).toBeNull();
  });

  it("chọn dòng sản phẩm sẽ cập nhật biểu đồ và bảng chi tiết bên phải", async () => {
    render(<AiForecastPanel forecast={mockForecast} stockLogs={[]} />);

    // Click on "Ốp lưng iPhone 15 Pro"
    const caseRow = screen.getByText("Ốp lưng iPhone 15 Pro");
    fireEvent.click(caseRow);

    // Detail panel on the right should display its details
    expect(screen.getByText("Mã: SKU-CASE-15P")).toBeTruthy();
    expect(screen.getByLabelText(/Biểu đồ xu hướng xuất và dự báo cho SKU-CASE-15P/i)).toBeTruthy();
  });

  it("nút 'Tạo phiếu nhập' gọi onNavigateToReceiving khi có prop", async () => {
    const handleNavigate = vi.fn();
    render(<AiForecastPanel forecast={mockForecast} stockLogs={[]} onNavigateToReceiving={handleNavigate} />);

    // iPhone is selected by default (first item, high risk)
    const createBtn = screen.getByRole("button", { name: /Tạo phiếu nhập \(\+80 sp\)/i });
    fireEvent.click(createBtn);

    expect(handleNavigate).toHaveBeenCalledWith("SKU-IP15P-128", 80);
  });
});
