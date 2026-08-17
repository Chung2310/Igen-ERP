export interface ReceivingSerialLine { sku: string; quantity: number; trackingMode?: string; serialNumbers?: string[] }

export function validateReceivingSerialLines(lines: ReceivingSerialLine[]) {
  for (const line of lines) {
    const serials = line.serialNumbers || [];
    if (line.trackingMode === "serial") {
      if (serials.length !== Number(line.quantity)) throw new Error(`SKU ${line.sku} phải có số IMEI/serial bằng số lượng nhập.`);
      const normalized = serials.map((value) => String(value).trim().toUpperCase());
      if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) throw new Error(`IMEI/serial của SKU ${line.sku} bị trùng hoặc rỗng.`);
    } else if (serials.length) {
      throw new Error(`SKU ${line.sku} không theo dõi IMEI/serial.`);
    }
  }
}
