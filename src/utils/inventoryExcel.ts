import * as XLSX from "xlsx";
import { ProductItem, StockLog } from "../types";

type SheetColumn<T> = {
  header: string;
  value: (item: T) => string | number;
};

type ExtendedStockLog = StockLog & {
  title?: string;
  items?: Array<{ sku: string; productName: string; quantity: number }>;
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

function downloadWorkbook<T>(sheetName: string, items: T[], columns: SheetColumn<T>[], fileName: string) {
  const rows = items.map((item) =>
    columns.reduce<Record<string, string | number>>((acc, column) => {
      acc[column.header] = column.value(item);
      return acc;
    }, {})
  );

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

async function readWorksheet(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("File Excel khong co sheet hop le.");
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
}

export function exportProductsToExcel(products: ProductItem[]) {
  downloadWorkbook(
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
  downloadWorkbook(
    "NhapXuatKho",
    stockLogs as ExtendedStockLog[],
    [
      { header: "Ma phieu", value: (item) => item.id },
      { header: "Loai", value: (item) => item.type },
      { header: "Tieu de phieu", value: (item) => item.title || "" },
      { header: "SKU", value: (item) => item.sku },
      { header: "Ten san pham", value: (item) => item.productName },
      { header: "So luong", value: (item) => item.quantity },
      { header: "Phu trach", value: (item) => item.operatorName },
      { header: "Ngay tao", value: (item) => item.createdAt },
      { header: "Ghi chu", value: (item) => item.notes },
      { header: "Trang thai", value: (item) => item.status },
    ],
    `inventory-stock-logs-${Date.now()}.xlsx`
  );
}

export async function importProductsFromExcel(file: File): Promise<ImportedProductRow[]> {
  const rows = await readWorksheet(file);

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

export async function importStockLogsFromExcel(file: File): Promise<StockLog[]> {
  const rows = await readWorksheet(file);

  const importedLogs: Array<ExtendedStockLog | null> = rows.map((row, index) => {
    const mapped = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {});

    const id = String(mapped["ma phieu"] ?? "").trim() || `LOG-${Date.now()}-${index}`;
    const typeValue = String(mapped["loai"] ?? "").trim().toLowerCase();
    const type = typeValue === "xuat" || typeValue === "xuất" ? "xuất" : "nhập";
    const title = String(mapped["tieu de phieu"] ?? "").trim();
    const productName = String(mapped["ten san pham"] ?? mapped["san pham"] ?? "").trim();
    const sku = String(mapped["sku"] ?? "").trim().toUpperCase();
    const quantity = toNumber(mapped["so luong"]);

    if (!productName || !sku) return null;

    return {
      id,
      type,
      title,
      items: [{ sku, productName, quantity }],
      sku,
      productName,
      quantity,
      operatorName: String(mapped["phu trach"] ?? "Excel Import").trim() || "Excel Import",
      createdAt: String(mapped["ngay tao"] ?? "Import tu Excel").trim() || "Import tu Excel",
      notes: String(mapped["ghi chu"] ?? "").trim(),
      status: String(mapped["trang thai"] ?? "Thành công").trim() === "Đang xử lý" ? "Đang xử lý" : "Thành công",
    } as ExtendedStockLog;
  });

  return importedLogs.filter((item): item is ExtendedStockLog => item !== null);
}
