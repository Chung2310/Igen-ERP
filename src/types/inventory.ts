export type InventorySubTabType = "SẢN PHẨM" | "KHO HÀNG" | "NHẬP HÀNG" | "XUẤT HÀNG" | "GIAO DỊCH KHO" | "DỰ BÁO" | "PHÂN LOẠI SẢN PHẨM" | "DANH MỤC" | "NHẬP / XUẤT KHO" | "DỰ BÁO AI";

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand?: string;
  unit: string;
  stock: number;
  minStockAlert: number;
  price: number;
  costPrice?: number;
  description?: string;
  status: "Active" | "Inactive";
  demandForecast: "Tăng mạnh" | "Ổn định" | "Giảm nhẹ";
  imageUrl: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  colorClass: string;
  status: "Đang dùng" | "Tạm khóa";
}

export interface StockLogItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  unitCost?: number;
  category?: string;
}

export type StockLogPurpose = "bán" | "nội bộ" | "hủy" | "chuyển kho";

export interface StockLog {
  id: string;
  type: "nhập" | "xuất";
  /** Tiêu đề phiếu (ví dụ: "Nhập hàng từ NCC A") */
  title?: string;
  /** Danh sách sản phẩm trong phiếu (multi-item) */
  items?: StockLogItem[];
  /** Undefined only for legacy outbound records that have not been classified. */
  purpose?: StockLogPurpose;
  customerId?: string;
  customerName?: string;
  /** Legacy: SKU đại diện (dùng cho import/export Excel & backward compat) */
  sku: string;
  /** Legacy: tên sản phẩm đại diện */
  productName: string;
  /** Legacy: tổng số lượng */
  quantity: number;
  operatorName: string;
  createdAt: string;
  notes: string;
  status: "Thành công" | "Đang xử lý" | "Đang chờ" | "Hoàn thành";
}

export interface InventoryForecastSeriesPoint {
  isoDate: string;
  label: string;
  actual: number;
  forecast: number;
  period: "history" | "forecast";
}

export interface InventoryForecastItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  averageDailyDemand: number;
  last7DaysDemand: number;
  last30DaysDemand: number;
  forecast30Days: number;
  daysOfCover: number | null;
  suggestedReorderQty: number;
  overstockDays: number | null;
  riskLevel: "high" | "medium" | "low";
  series: InventoryForecastSeriesPoint[];
}

export interface InventoryForecastRecommendation {
  id: string;
  sku: string;
  productName: string;
  tone: "danger" | "warning" | "info";
  title: string;
  body: string;
}

export interface InventoryForecastSummary {
  items: InventoryForecastItem[];
  recommendations: InventoryForecastRecommendation[];
  warningItems: InventoryForecastItem[];
  hasHistoricalDemand: boolean;
}
