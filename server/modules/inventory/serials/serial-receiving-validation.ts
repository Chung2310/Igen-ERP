export interface ReceivingUnitDetail { internalBarcode?: string; serialNumber?: string; imei1?: string; imei2?: string }
export interface ReceivingSerialLine { sku: string; quantity: number; trackingMode?: string; serialNumbers?: string[]; unitDetails?: ReceivingUnitDetail[] }

export function validateReceivingSerialLines(lines: ReceivingSerialLine[]) {
  for (const line of lines) {
    const serials = line.serialNumbers || [];
    const units = line.unitDetails || [];
    if (line.trackingMode === "serial") {
      if (serials.length !== Number(line.quantity)) throw new Error(`SKU ${line.sku} phải có số IMEI/serial bằng số lượng nhập.`);
      const normalized = serials.map((value) => String(value).trim().toUpperCase());
      if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) throw new Error(`IMEI/serial của SKU ${line.sku} bị trùng hoặc rỗng.`);
    } else if (line.trackingMode === "unit_barcode") {
      if (units.length !== Number(line.quantity)) throw new Error(`SKU ${line.sku} phải có số mã vạch nội bộ bằng số lượng nhập.`);
      const barcodes = units.map((unit) => String(unit.internalBarcode || "").trim().toUpperCase());
      if (barcodes.some((value) => !value) || new Set(barcodes).size !== barcodes.length) throw new Error(`Mã vạch nội bộ của SKU ${line.sku} bị trùng hoặc rỗng.`);
    } else if (serials.length || units.length) {
      throw new Error(`SKU ${line.sku} không theo dõi IMEI/serial.`);
    }
  }
}
