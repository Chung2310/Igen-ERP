import { beforeEach, describe, expect, it, vi } from "vitest";

let tickets: any[] = [];
let lastFilter: any = null;
let customers: Array<{ _id: string; name: string; customerCode: string }> = [];
const lookupWarranty = vi.fn();

vi.mock("../../customer-management/models/customer.model", () => ({
  CustomerModel: { find: () => ({ select: () => ({ sort: () => ({ lean: async () => customers }) }) }) },
}));
vi.mock("../repair-ticket.model", () => ({
  RepairTicketModel: {
    find: (filter: any) => { lastFilter = filter; return { select: () => ({ sort: () => ({ lean: async () => tickets }) }) }; },
  },
}));
vi.mock("../../retail/services/warranty-lookup.service", () => ({ lookupWarranty: (...args: any[]) => lookupWarranty(...args) }));

const { lookupDeviceHistory, lookupCustomerHistory, lookupRepairHistory } = await import("./repair-history.service");

describe("lịch sử sửa chữa theo IMEI và số điện thoại", () => {
  beforeEach(() => { tickets = []; customers = []; lastFilter = null; lookupWarranty.mockReset(); lookupWarranty.mockResolvedValue({ found: true, serialNumber: "IMEI1" }); });

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
      { _id: "t3", customerId: "KH-AN", customerName: "Trần An", device: { imei: "A1", normalizedImei: "A1", name: "iPhone 13" }, receivedAt: new Date("2026-08-10") },
      { _id: "t2", customerId: "KH-AN", customerName: "Trần An", device: { imei: "A1", normalizedImei: "A1", name: "iPhone 13" }, receivedAt: new Date("2026-07-01") },
      { _id: "t1", customerId: "KH-AN", customerName: "Trần An", device: { imei: "B2", normalizedImei: "B2", name: "Dell XPS" }, receivedAt: new Date("2026-06-01") },
    ];
    const result = await lookupCustomerHistory({ companyCode: "IGEN" }, "0900 000 001");
    expect(result.phone).toBe("0900000001");
    expect(lastFilter.normalizedCustomerPhone).toEqual({ $in: ["0900000001", "84900000001"] });
    expect(result.ticketCount).toBe(3);
    expect(result.devices).toHaveLength(2);
    expect(result.devices[0]).toMatchObject({ imei: "A1", ticketCount: 2 });
  });

  it("yêu cầu chọn hồ sơ trước khi đọc phiếu của khách dùng chung số", async () => {
    customers = [{ _id: "an", name: "An", customerCode: "KH-AN" }, { _id: "binh", name: "Bình", customerCode: "KH-BINH" }];
    const scope = { companyCode: "IGEN", branchId: "BRANCH" };
    const result = await lookupCustomerHistory(scope, "0900000001");
    expect(result).toMatchObject({ candidates: [{ customerId: "an" }, { customerId: "binh" }], devices: [] });
    expect(lastFilter).toBeNull();
    await lookupCustomerHistory(scope, "0900000001", "binh");
    expect(lastFilter).toEqual({ ...scope, customerId: { $in: ["binh", "KH-BINH"] } });
  });

  it("không truyền gì thì báo lỗi rõ ràng", async () => {
    await expect(lookupRepairHistory({ companyCode: "IGEN" }, {})).rejects.toThrow(/imei hoặc phone/);
  });
});
