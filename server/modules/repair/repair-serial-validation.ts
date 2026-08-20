export function assertSoldSerialForRepair(device: { serialNumber?: string; imei?: string }): void {
  if (!String(device.serialNumber || device.imei || "").trim()) {
    throw Object.assign(new Error("IMEI/serial là bắt buộc khi tạo phiếu sửa chữa hoặc bảo hành."), { statusCode: 400, code: "REPAIR_SERIAL_REQUIRED" });
  }
}
