import * as XLSX from "xlsx";
import { ProductItem, StockLog, StockLogItem } from "../types";

type SheetColumn<T> = {
  header: string;
  value: (item: T) => string | number;
};

type ExtendedStockLog = StockLog & {
  title?: string;
  items?: Array<{ sku: string; productName: string; quantity: number }>;
};

type StockLogHeaderRow = {
  receiptKey: string;
  type: "nhập" | "xuất";
  title: string;
  operatorName: string;
  createdAt: string;
  notes: string;
  status: "Thành công" | "Đang xử lý" | "Đang chờ" | "Hoàn thành";
};

type StockLogItemRow = {
  receiptKey: string;
  sku: string;
  productName: string;
  quantity: number;
};

export type ImportedProductRow = {
  sku: string;
  name: string;
  category: string;
  brand?: string;
  unit: string;
  stock: number;
  price: number;
  description?: string;
  status: "Active" | "Inactive";
  imageUrl?: string;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createWorksheet<T>(items: T[], columns: SheetColumn<T>[]) {
  const rows = items.map((item) =>
    columns.reduce<Record<string, string | number>>((acc, column) => {
      acc[column.header] = column.value(item);
      return acc;
    }, {})
  );

  return XLSX.utils.json_to_sheet(rows);
}

function createWorkbookWithSingleSheet<T>(sheetName: string, items: T[], columns: SheetColumn<T>[], fileName: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, createWorksheet(items, columns), sheetName);
  XLSX.writeFile(workbook, fileName);
}

async function readWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`File Excel thieu sheet ${sheetName}.`);
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
}

export function exportProductsToExcel(products: ProductItem[]) {
  createWorkbookWithSingleSheet(
    "SanPham",
    products,
    [
      { header: "SKU", value: (item) => item.sku },
      { header: "Tên sản phẩm", value: (item) => item.name },
      { header: "Danh mục", value: (item) => item.category },
      { header: "Thương hiệu", value: (item) => item.brand || "" },
      { header: "Đơn vị tính", value: (item) => item.unit || "Cái" },
      { header: "Giá bán", value: (item) => item.price },
      { header: "Tồn kho", value: (item) => item.stock },
      { header: "Mô tả", value: (item) => item.description || "" },
      { header: "Trạng thái", value: (item) => item.status || "Active" },
    ],
    `inventory-products-${Date.now()}.xlsx`
  );
}

export function exportStockLogsToExcel(stockLogs: StockLog[]) {
  const normalizedLogs = stockLogs as ExtendedStockLog[];

  const headerRows: StockLogHeaderRow[] = normalizedLogs.map((log, index) => ({
    receiptKey: `PHIEU-${index + 1}`,
    type: log.type,
    title: log.title || "",
    operatorName: log.operatorName,
    createdAt: log.createdAt,
    notes: log.notes,
    status: log.status,
  }));

  const itemRows: StockLogItemRow[] = normalizedLogs.flatMap((log, index) => {
    const items = log.items?.length
      ? log.items
      : [{ sku: log.sku, productName: log.productName, quantity: log.quantity }];

    return items.map((item) => ({
      receiptKey: `PHIEU-${index + 1}`,
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity,
    }));
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createWorksheet(headerRows, [
      { header: "Mã phiếu", value: (item) => item.receiptKey },
      { header: "Loại phiếu", value: (item) => item.type },
      { header: "Tiêu đề phiếu", value: (item) => item.title },
      { header: "Người phụ trách", value: (item) => item.operatorName },
      { header: "Ngày tạo", value: (item) => item.createdAt },
      { header: "Ghi chú", value: (item) => item.notes },
      { header: "Trạng thái", value: (item) => item.status },
    ]),
    "Phiếu"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    createWorksheet(itemRows, [
      { header: "Mã phiếu", value: (item) => item.receiptKey },
      { header: "SKU", value: (item) => item.sku },
      { header: "Tên sản phẩm", value: (item) => item.productName },
      { header: "Số lượng", value: (item) => item.quantity },
    ]),
    "Sản phẩm trong phiếu"
  );
  XLSX.writeFile(workbook, `inventory-stock-logs-${Date.now()}.xlsx`);
}

function getSheetByNameOrIndex(workbook: XLSX.WorkBook, names: string[], index: number) {
  for (const name of names) {
    if (workbook.Sheets[name]) return workbook.Sheets[name];
  }
  if (workbook.SheetNames.length > index) {
    return workbook.Sheets[workbook.SheetNames[index]];
  }
  return null;
}

export async function importProductsFromExcel(file: File): Promise<ImportedProductRow[]> {
  const workbook = await readWorkbook(file);
  const worksheet = getSheetByNameOrIndex(workbook, ["SanPham", "Sản phẩm", "Products"], 0);
  if (!worksheet) {
    throw new Error("File Excel không chứa bất kỳ trang tính nào có dữ liệu.");
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

  const importedRows: Array<ImportedProductRow | null> = rows.map((row) => {
    const mapped = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {});

    const sku = String(mapped["sku"] ?? "").trim().toUpperCase();
    const name = String(mapped["ten san pham"] ?? mapped["san pham"] ?? "").trim();
    const category = String(mapped["danh muc"] ?? mapped["phan loai"] ?? "").trim() || "Chưa phân loại";
    const brand = String(mapped["thuong hieu"] ?? "").trim();
    const unit = String(mapped["don vi tinh"] ?? mapped["don vi"] ?? "").trim() || "Cái";
    const price = toNumber(mapped["gia ban"] ?? mapped["gia"] ?? 0);
    const stock = toNumber(mapped["ton kho"] ?? 0);
    const description = String(mapped["mo ta"] ?? "").trim();
    const rawStatus = String(mapped["trang thai"] ?? "").trim().toLowerCase();
    const status: "Active" | "Inactive" = (rawStatus === "inactive" || rawStatus === "ngừng hoạt động" || rawStatus === "ngung hoat dong") ? "Inactive" : "Active";

    if (!sku || !name) return null;

    return {
      sku,
      name,
      category,
      brand,
      unit,
      stock,
      price,
      description,
      status,
      imageUrl: String(mapped["anh url"] ?? "").trim(),
    };
  });

  return importedRows.filter((item): item is ImportedProductRow => item !== null);
}

function normalizeImportedStatus(rawStatus: string): StockLog["status"] {
  if (rawStatus === "Đang chờ" || rawStatus === "Đang xử lý" || rawStatus === "Hoàn thành" || rawStatus === "Thành công") {
    return rawStatus;
  }
  return "Đang chờ";
}

export async function importStockLogsFromExcel(file: File): Promise<StockLog[]> {
  const workbook = await readWorkbook(file);
  
  const headerSheet = getSheetByNameOrIndex(workbook, ["Phieu", "Phiếu", "Logs"], 0);
  if (!headerSheet) {
    throw new Error("Không tìm thấy trang tính danh sách phiếu.");
  }
  const headerRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(headerSheet).map((row) =>
    Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {})
  );

  const itemsSheet = getSheetByNameOrIndex(workbook, ["SanPhamTrongPhieu", "Sản phẩm trong phiếu", "Items"], 1);
  if (!itemsSheet) {
    throw new Error("Không tìm thấy trang tính sản phẩm trong phiếu.");
  }
  const itemRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(itemsSheet).map((row) =>
    Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {})
  );

  const headerMap = new Map<string, ExtendedStockLog>();

  headerRows.forEach((mapped, index) => {
    const receiptKey = String(mapped["ma phieu"] ?? mapped["receipt key"] ?? mapped["receiptkey"] ?? "").trim() || `PHIEU-${index + 1}`;
    const rawType = String(mapped["loai phieu"] ?? mapped["loai"] ?? "").trim().toLowerCase();
    const type: "nhập" | "xuất" = (rawType.includes("xuat") || rawType.includes("xuất")) ? "xuất" : "nhập";

    headerMap.set(receiptKey, {
      id: `LOG-${Date.now()}-${index}`,
      type,
      title: String(mapped["tieu de phieu"] ?? "").trim() || `${type === "xuất" ? "Phiếu xuất" : "Phiếu nhập"} Excel ${index + 1}`,
      items: [],
      sku: "",
      productName: "",
      quantity: 0,
      operatorName: String(mapped["nguoi phu trach"] ?? mapped["phu trach"] ?? "Excel Import").trim() || "Excel Import",
      createdAt: String(mapped["ngay tao"] ?? "Import tu Excel").trim() || "Import tu Excel",
      notes: String(mapped["ghi chu"] ?? "").trim(),
      status: normalizeImportedStatus(String(mapped["trang thai"] ?? "").trim()),
    });
  });

  itemRows.forEach((mapped) => {
    const receiptKey = String(mapped["ma phieu"] ?? mapped["receipt key"] ?? mapped["receiptkey"] ?? "").trim();
    const parentLog = headerMap.get(receiptKey);
    if (!parentLog) return;

    const sku = String(mapped["sku"] ?? "").trim().toUpperCase();
    const productName = String(mapped["ten san pham"] ?? mapped["san pham"] ?? "").trim();
    const quantity = toNumber(mapped["so luong"] ?? mapped["quantity"] ?? 0);
    if (!sku || !productName || quantity <= 0) return;

    const nextItem: StockLogItem = {
      productId: "",
      sku,
      productName,
      quantity,
    };

    parentLog.items = parentLog.items || [];
    parentLog.items.push(nextItem);
    parentLog.quantity += quantity;

    if (!parentLog.sku) parentLog.sku = sku;
    if (!parentLog.productName) parentLog.productName = productName;
  });

  return Array.from(headerMap.values()).filter((log) => (log.items?.length || 0) > 0);
}
