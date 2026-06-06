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
  stock: number;
  price: number;
  imageUrl?: string;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
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
      { header: "Ten san pham", value: (item) => item.name },
      { header: "Phan loai", value: (item) => item.category },
      { header: "Ton kho", value: (item) => item.stock },
      { header: "Nguong canh bao", value: (item) => item.minStockAlert },
      { header: "Gia ban", value: (item) => item.price },
      { header: "Du bao nhu cau", value: (item) => item.demandForecast },
      { header: "Anh URL", value: (item) => item.imageUrl },
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
      { header: "Receipt Key", value: (item) => item.receiptKey },
      { header: "Loai", value: (item) => item.type },
      { header: "Tieu de phieu", value: (item) => item.title },
      { header: "Phu trach", value: (item) => item.operatorName },
      { header: "Ngay tao", value: (item) => item.createdAt },
      { header: "Ghi chu", value: (item) => item.notes },
      { header: "Trang thai", value: (item) => item.status },
    ]),
    "Phieu"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    createWorksheet(itemRows, [
      { header: "Receipt Key", value: (item) => item.receiptKey },
      { header: "SKU", value: (item) => item.sku },
      { header: "Ten san pham", value: (item) => item.productName },
      { header: "So luong", value: (item) => item.quantity },
    ]),
    "SanPhamTrongPhieu"
  );
  XLSX.writeFile(workbook, `inventory-stock-logs-${Date.now()}.xlsx`);
}

export async function importProductsFromExcel(file: File): Promise<ImportedProductRow[]> {
  const workbook = await readWorkbook(file);
  const rows = readSheetRows(workbook, "SanPham");

  const importedRows: Array<ImportedProductRow | null> = rows.map((row) => {
    const mapped = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {});

    const sku = String(mapped["sku"] ?? "").trim().toUpperCase();
    const name = String(mapped["ten san pham"] ?? mapped["san pham"] ?? "").trim();
    const category = String(mapped["phan loai"] ?? "").trim() || "Chua phan loai";

    if (!sku || !name) return null;

    return {
      sku,
      name,
      category,
      stock: toNumber(mapped["ton kho"]),
      price: toNumber(mapped["gia ban"]),
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
  const headerRows = readSheetRows(workbook, "Phieu").map((row) =>
    Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {})
  );
  const itemRows = readSheetRows(workbook, "SanPhamTrongPhieu").map((row) =>
    Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {})
  );

  const headerMap = new Map<string, ExtendedStockLog>();

  headerRows.forEach((mapped, index) => {
    const receiptKey = String(mapped["receipt key"] ?? mapped["receiptkey"] ?? "").trim() || `PHIEU-${index + 1}`;
    const rawType = String(mapped["loai"] ?? "").trim().toLowerCase();
    const type: "nhập" | "xuất" = rawType === "xuat" || rawType === "xuất" ? "xuất" : "nhập";

    headerMap.set(receiptKey, {
      id: `LOG-${Date.now()}-${index}`,
      type,
      title: String(mapped["tieu de phieu"] ?? "").trim() || `${type === "xuất" ? "Phiếu xuất" : "Phiếu nhập"} Excel ${index + 1}`,
      items: [],
      sku: "",
      productName: "",
      quantity: 0,
      operatorName: String(mapped["phu trach"] ?? "Excel Import").trim() || "Excel Import",
      createdAt: String(mapped["ngay tao"] ?? "Import tu Excel").trim() || "Import tu Excel",
      notes: String(mapped["ghi chu"] ?? "").trim(),
      status: normalizeImportedStatus(String(mapped["trang thai"] ?? "").trim()),
    });
  });

  itemRows.forEach((mapped) => {
    const receiptKey = String(mapped["receipt key"] ?? mapped["receiptkey"] ?? "").trim();
    const parentLog = headerMap.get(receiptKey);
    if (!parentLog) return;

    const sku = String(mapped["sku"] ?? "").trim().toUpperCase();
    const productName = String(mapped["ten san pham"] ?? mapped["san pham"] ?? "").trim();
    const quantity = toNumber(mapped["so luong"]);
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
