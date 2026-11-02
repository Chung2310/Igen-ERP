export interface ReceivingUnitDetail { internalBarcode?: string; serialNumber?: string; imei1?: string; imei2?: string }
export interface ReceivingSerialLine { sku: string; quantity: number; trackingMode?: string; serialNumbers?: string[]; unitDetails?: ReceivingUnitDetail[] }

export function validateReceivingSerialLines(lines: ReceivingSerialLine[], requireComplete = true) {
  const barcodes = lines.flatMap((line) => (line.unitDetails || []).map((unit) => String(unit.internalBarcode || "").trim().toUpperCase()).filter(Boolean));
  if (new Set(barcodes).size !== barcodes.length) throw new Error("Mã quản lý/barcode trong phiếu nhập bị trùng.");

  for (const line of lines) {
    const serials = line.serialNumbers || [];
    const units = line.unitDetails || [];
    if (["serial", "unit_barcode"].includes(String(line.trackingMode)) && !Number.isInteger(Number(line.quantity))) throw new Error(`SKU ${line.sku} phải nhập số lượng nguyên để quản lý từng máy.`);
    if (line.trackingMode === "serial") {
      if (requireComplete && serials.length !== Number(line.quantity)) throw new Error(`SKU ${line.sku} phải có số IMEI/serial bằng số lượng nhập.`);
      if (serials.length > Number(line.quantity) || (requireComplete && serials.some((value) => !String(value).trim()))) throw new Error(`SKU ${line.sku} có số IMEI/serial không hợp lệ.`);
      const normalized = serials.map((value) => String(value).trim().toUpperCase()).filter(Boolean);
      if (new Set(normalized).size !== normalized.length) throw new Error(`IMEI/serial của SKU ${line.sku} bị trùng.`);
      if (units.length > Number(line.quantity) || (requireComplete && units.length > 0 && units.length !== Number(line.quantity))) throw new Error(`SKU ${line.sku} phải có chi tiết thiết bị khớp số lượng nhập.`);
      if (units.some((unit, index) => unit.serialNumber && serials[index]?.trim() && unit.serialNumber.trim().toUpperCase() !== serials[index].trim().toUpperCase())) throw new Error(`Serial trong chi tiết máy không khớp danh sách của SKU ${line.sku}.`);
    } else if (line.trackingMode === "unit_barcode") {
      if (requireComplete && units.length !== Number(line.quantity)) throw new Error(`SKU ${line.sku} phải có chi tiết thiết bị bằng số lượng nhập.`);
      if (units.length > Number(line.quantity)) throw new Error(`SKU ${line.sku} có nhiều chi tiết thiết bị hơn số lượng nhập.`);
      const serialsForLine = units.map((unit) => String(unit.serialNumber || "").trim().toUpperCase()).filter(Boolean);
      const imeisForLine = units.flatMap((unit) => [unit.imei1, unit.imei2].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean));
      if (new Set(serialsForLine).size !== serialsForLine.length || new Set(imeisForLine).size !== imeisForLine.length) throw new Error(`Serial/IMEI của SKU ${line.sku} bị trùng.`);
    } else if (serials.length || units.length) {
      throw new Error(`SKU ${line.sku} không theo dõi IMEI/serial.`);
    }

    for (const unit of units) {
      const imei1 = String(unit.imei1 || "").trim();
      const imei2 = String(unit.imei2 || "").trim();
      if (imei1 && imei2 && imei1.toUpperCase() === imei2.toUpperCase()) throw new Error(`IMEI 1 và IMEI 2 của SKU ${line.sku} không được trùng nhau.`);
    }
  }
}
