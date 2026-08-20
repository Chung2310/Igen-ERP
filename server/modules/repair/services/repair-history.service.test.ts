import { beforeEach, describe, expect, it, vi } from "vitest";

let tickets: any[] = [];
let lastFilter: any = null;
const lookupWarranty = vi.fn();

vi.mock("../repair-ticket.model", () => ({
  RepairTicketModel: {
    find: (filter: any) => { lastFilter = filter; return { select: () => ({ sort: () => ({ lean: async () => tickets }) }) }; },
  },
}));
vi.mock("../../retail/services/warranty-lookup.service", () => ({ lookupWarranty: (...args: any[]) => lookupWarranty(...args) }));

const { lookupDeviceHistory, lookupCustomerHistory, lookupRepairHistory } = await import("./repair-history.service");

describe("lịch sử sửa chữa theo IMEI và số điện thoại", () => {
  beforeEach(() => { tickets = []; lastFilter = null; lookupWarranty.mockReset(); lookupWarranty.mockResolvedValue({ found: true, serialNumber: "IMEI1" }); });

  it("tra IMEI trả cả nguồn gốc máy lẫn các lần đã sửa", async () => {
    tickets = [{ _id: "t2", ticketCode: "SC-002", device: { imei: "IMEI1" } }, { _id: "t1", ticketCode: "SC-001", device: { imei: "IMEI1" } }];
    const result = await lookupDeviceHistory({ companyCode: "IGEN" }, "imei1");
    expect(result.imei).toBe("IMEI1");
    expect(result.ticketCount).toBe(2);
    expect((result.warranty as any).found).toBe(true);
    expect(lastFilter.companyCode).toBe("IGEN");
    expect(lastFilter.$or).toEqual([{ "device.normalizedImei": "IMEI1" }, { "device.normalizedSerialNumber": "IMEI1" }]);
  });

  it("máy mua nơi khác hoặc module bán lẻ tắt vẫn ra lịch sử sửa", async () => {
    lookupWarranty.mockRejectedValue(new Error("RETAIL_OFF"));
    tickets = [{ _id: "t1", ticketCode: "SC-001", device: { imei: "IMEI9" } }];
    const result = await lookupDeviceHistory({ companyCode: "IGEN" }, "IMEI9");
    expect(result.warranty).toEqual({ found: false });
    expect(result.ticketCount).toBe(1);
  });

  it("tra số điện thoại gom phiếu theo từng thiết bị", async () => {
    tickets = [
      { _id: "t3", customerName: "Trần An", device: { imei: "A1", normalizedImei: "A1", name: "iPhone 13" }, receivedAt: new Date("2026-08-10") },
      { _id: "t2", customerName: "Trần An", device: { imei: "A1", normalizedImei: "A1", name: "iPhone 13" }, receivedAt: new Date("2026-07-01") },
      { _id: "t1", customerName: "Trần An", device: { imei: "B2", normalizedImei: "B2", name: "Dell XPS" }, receivedAt: new Date("2026-06-01") },
    ];
    const result = await lookupCustomerHistory({ companyCode: "IGEN" }, "0900 000 001");
    expect(result.phone).toBe("0900000001");
    expect(lastFilter.normalizedCustomerPhone).toBe("0900000001");
    expect(result.ticketCount).toBe(3);
    expect(result.devices).toHaveLength(2);
    expect(result.devices[0]).toMatchObject({ imei: "A1", ticketCount: 2 });
  });

  it("không truyền gì thì báo lỗi rõ ràng", async () => {
    await expect(lookupRepairHistory({ companyCode: "IGEN" }, {})).rejects.toThrow(/imei hoặc phone/);
  });
});
