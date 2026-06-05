import { InventorySubTabType, ProductCategory, ProductItem, StockLog } from "../../types";

export const inventoryTabs: InventorySubTabType[] = ["DANH MỤC", "PHÂN LOẠI SẢN PHẨM", "NHẬP / XUẤT KHO", "DỰ BÁO AI"];

export const initialProducts: ProductItem[] = [
  { id: "p1", sku: "PROD-X1", name: "Thiết bị đeo thông minh X1", category: "Thiết bị đeo", stock: 120, minStockAlert: 20, price: 1890000, demandForecast: "Tăng mạnh", imageUrl: "TB" },
  { id: "p2", sku: "CLOUD-ENT-05", name: "Cloud Storage Enterprise", category: "Gói Dịch vụ Cloud", stock: 500, minStockAlert: 50, price: 5500000, demandForecast: "Ổn định", imageUrl: "CL" },
  { id: "p3", sku: "HEADPHONE-MAX", name: "Tai nghe không dây Pro Max", category: "Âm thanh", stock: 15, minStockAlert: 25, price: 2990000, demandForecast: "Tăng mạnh", imageUrl: "AT" },
  { id: "p4", sku: "KEY-WORK-V2", name: "Bàn phím cơ Workspace V2", category: "Phụ kiện", stock: 8, minStockAlert: 15, price: 1650000, demandForecast: "Giảm nhẹ", imageUrl: "PK" },
  { id: "p5", sku: "LAP-DELL-XPS", name: "Laptop Dell XPS 15 Pro", category: "Máy tính xách tay", stock: 3, minStockAlert: 10, price: 45000000, demandForecast: "Tăng mạnh", imageUrl: "LT" },
  { id: "p6", sku: "MONITOR-LG-4K", name: "Màn hình LG 27 inch 4K IPS", category: "Thiết bị hiển thị", stock: 2, minStockAlert: 8, price: 8900000, demandForecast: "Tăng mạnh", imageUrl: "MH" },
];

export const initialCategories: ProductCategory[] = [
  { id: "cat-wear", name: "Thiết bị đeo", code: "WEAR", description: "Đồng hồ, vòng tay, thiết bị thông minh cá nhân.", colorClass: "bg-blue-50 text-blue-700 border-blue-100", status: "Đang dùng" },
  { id: "cat-cloud", name: "Gói Dịch vụ Cloud", code: "CLOUD", description: "Gói dịch vụ số, license và thuê bao cloud.", colorClass: "bg-blue-50 text-blue-700 border-blue-100", status: "Đang dùng" },
  { id: "cat-audio", name: "Âm thanh", code: "AUDIO", description: "Tai nghe, loa và phụ kiện âm thanh.", colorClass: "bg-blue-50 text-blue-700 border-blue-100", status: "Đang dùng" },
  { id: "cat-accessory", name: "Phụ kiện", code: "ACC", description: "Bàn phím, chuột, cáp và phụ kiện văn phòng.", colorClass: "bg-blue-50 text-blue-700 border-blue-100", status: "Đang dùng" },
  { id: "cat-laptop", name: "Máy tính xách tay", code: "LAP", description: "Laptop làm việc, laptop cao cấp và máy trạm.", colorClass: "bg-blue-50 text-blue-700 border-blue-100", status: "Đang dùng" },
  { id: "cat-display", name: "Thiết bị hiển thị", code: "DISPLAY", description: "Màn hình, máy chiếu và thiết bị trình chiếu.", colorClass: "bg-blue-50 text-blue-700 border-blue-100", status: "Đang dùng" },
];

export const initialStockLogs: StockLog[] = [
  { id: "NK-2401", type: "nhập", sku: "LAP-DELL-XPS", productName: "Laptop Dell XPS 15 Pro", quantity: 20, operatorName: "Hoàng Gia Huy", createdAt: "Hôm nay, 08:30", notes: "Lô hàng laptop tháng 10", status: "Thành công" },
  { id: "XK-2405", type: "xuất", sku: "CLOUD-ENT-05", productName: "Cloud Storage Enterprise", quantity: 5, operatorName: "Lê Ngọc Sang", createdAt: "12/10/2026", notes: "Kích hoạt hợp đồng đại lý Hà Nội", status: "Thành công" },
  { id: "XK-2404", type: "xuất", sku: "KEY-WORK-V2", productName: "Bàn phím cơ Workspace V2", quantity: 12, operatorName: "Lê Ngọc Sang", createdAt: "10/10/2026", notes: "Bán lẻ showroom trực tiếp", status: "Thành công" },
  { id: "NK-2400", type: "nhập", sku: "PROD-X1", productName: "Thiết bị đeo thông minh X1", quantity: 50, operatorName: "Hoàng Gia Huy", createdAt: "09/10/2026", notes: "Nhập bổ sung hàng bán lẻ", status: "Thành công" },
];
