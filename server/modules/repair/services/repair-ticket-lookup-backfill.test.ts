import { describe, expect, it } from "vitest";
import { buildRepairTicketLookupBackfill } from "./repair-ticket-lookup-backfill";

describe("buildRepairTicketLookupBackfill", () => {
  it("chuẩn hoá IMEI và số điện thoại cho phiếu cũ", () => {
    expect(buildRepairTicketLookupBackfill({
      customerPhone: "0900 000 001",
      device: { imei: "  abc-123  ", serialNumber: "serial-1" },
    })).toEqual({
      "device.normalizedImei": "ABC-123",
      "device.normalizedSerialNumber": "SERIAL-1",
      normalizedCustomerPhone: "0900000001",
    });
  });

  it("không ghi đè khoá tra cứu đã chuẩn hoá", () => {
    expect(buildRepairTicketLookupBackfill({
      customerPhone: "0900 000 001",
      normalizedCustomerPhone: "0987654321",
      device: { imei: "abc", normalizedImei: "KEEP-IMEI", serialNumber: "serial-1", normalizedSerialNumber: "KEEP-SERIAL" },
    })).toEqual({});
  });

  it("dùng serial làm IMEI dự phòng và không tạo giá trị rỗng", () => {
    expect(buildRepairTicketLookupBackfill({ customerPhone: "", device: { serialNumber: "serial-1" } })).toEqual({
      "device.normalizedImei": "SERIAL-1",
      "device.normalizedSerialNumber": "SERIAL-1",
    });
  });
});
