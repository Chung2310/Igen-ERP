import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_CUSTOMER_NOTES_KEY, savePageCustomer } from "./page-customer.service";
import { getModuleStateForCompany, isServiceSubscriptionBlocked } from "../../../../middleware/require-module";
import { CustomerModel } from "../../../customer-management/models/customer.model";
import { CustomerService } from "../../../customer-management/customer.service";
import { queuePageCustomerSheet } from "./page-customer-sheet.service";

vi.mock("./page-customer-sheet.service", () => ({ queuePageCustomerSheet: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../../middleware/require-module", () => ({
  getModuleStateForCompany: vi.fn(), isServiceSubscriptionBlocked: vi.fn(() => false),
}));
vi.mock("../../../customer-management/models/customer.model", () => ({ CustomerModel: { findOne: vi.fn(), exists: vi.fn() } }));
vi.mock("../../../customer-management/customer.service", () => ({ CustomerService: { create: vi.fn(), appendNotes: vi.fn() } }));
const input = { companyCode: "ACME", pageId: "PAGE", conversationId: "CONV",
  message: "Tên tôi là An, số 0901234567", fields: [{ key: "name", label: "Họ tên" }, { key: "phone", label: "Số điện thoại" }],
  values: { name: "An", phone: "0901234567" } };
describe("Page customer bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getModuleStateForCompany).mockResolvedValue({ exists: true, modules: ["customer"] } as any);
    vi.mocked(isServiceSubscriptionBlocked).mockReturnValue(false);
    vi.mocked(CustomerModel.findOne).mockReturnValue({ select: () => ({ lean: async () => null }) } as any);
    vi.mocked(CustomerModel.exists).mockResolvedValue(null);
    vi.mocked(CustomerService.create).mockResolvedValue({ _id: "CUSTOMER" } as any);
  });
  it("creates a tenant-scoped Page customer once from an explicit phone", async () => {
    expect(await savePageCustomer(input)).toBe("CUSTOMER");
    expect(CustomerService.create).toHaveBeenCalledWith({ companyCode: "ACME" },
      expect.objectContaining({ name: "An", phone: "0901234567", source: "page" }), expect.anything());
    expect(queuePageCustomerSheet).toHaveBeenCalledWith("ACME", "PAGE", "CUSTOMER");
  });
  it("keeps the ERP customer when scheduling Sheet synchronization fails", async () => {
    vi.mocked(queuePageCustomerSheet).mockRejectedValueOnce(new Error("Queue unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try { expect(await savePageCustomer(input)).toBe("CUSTOMER"); }
    finally { log.mockRestore(); }
  });
  it("does not persist an inferred phone or when Customer module is disabled", async () => {
    expect(await savePageCustomer({ ...input, message: "Tên tôi là An" })).toBeUndefined();
    vi.mocked(getModuleStateForCompany).mockResolvedValue({ exists: true, modules: ["inventory"] } as any);
    expect(await savePageCustomer(input)).toBeUndefined();
    expect(CustomerService.create).not.toHaveBeenCalled();
  });
  it("does not link an unconfirmed customer by phone alone", async () => {
    vi.mocked(CustomerModel.exists).mockResolvedValue({ _id: "EXISTING" } as any);
    expect(await savePageCustomer(input)).toBeUndefined();
    expect(CustomerService.create).not.toHaveBeenCalled();
    expect(CustomerService.appendNotes).not.toHaveBeenCalled();
  });
  it("maps standard contact fields and puts all other intake fields in customer notes", async () => {
    await savePageCustomer({ ...input,
      fields: [...input.fields, { key: "email", label: "Email" }, { key: "address", label: "Địa chỉ" },
        { key: "budget", label: "Ngân sách" }, { key: "contact_time", label: "Giờ liên hệ" }],
      values: { ...input.values, email: "an@example.com", address: "1 Nguyễn Huệ", budget: "50 triệu", contact_time: "Buổi chiều",
        [PAGE_CUSTOMER_NOTES_KEY]: "Thích màu trắng\nCần giao tận nhà" },
    });
    expect(CustomerService.create).toHaveBeenCalledWith({ companyCode: "ACME" }, expect.objectContaining({
      email: "an@example.com", address: "1 Nguyễn Huệ",
      notes: "Facebook Page PAGE; hội thoại CONV\nNgân sách: 50 triệu\nGiờ liên hệ: Buổi chiều\nThích màu trắng\nCần giao tận nhà",
    }), expect.anything());
  });
  it("appends intake facts to an existing customer's notes instead of overwriting the profile", async () => {
    vi.mocked(CustomerModel.findOne).mockReturnValue({ select: () => ({ lean: async () => ({ _id: "EXISTING", email: "old@example.com" }) }) } as any);
    await savePageCustomer({ ...input, customerId: "EXISTING", fields: [...input.fields, { key: "budget", label: "Ngân sách" }, { key: "email", label: "Email" }],
      values: { ...input.values, budget: "50 triệu", email: "new@example.com" } });
    expect(CustomerService.appendNotes).toHaveBeenCalledWith({ companyCode: "ACME" }, "EXISTING",
      ["Facebook Page PAGE; hội thoại CONV", "Ngân sách: 50 triệu", "Email: new@example.com"]);
    expect(CustomerService.create).not.toHaveBeenCalled();
  });
  it("saves later answers for the customer already linked to this conversation without asking for the phone again", async () => {
    vi.mocked(CustomerModel.findOne).mockReturnValue({ select: () => ({ lean: async () => ({ _id: "EXISTING" }) }) } as any);
    expect(await savePageCustomer({ ...input, customerId: "EXISTING", message: "Chỉ gọi buổi chiều",
      values: { ...input.values, [PAGE_CUSTOMER_NOTES_KEY]: "Chỉ gọi buổi chiều" } })).toBe("EXISTING");
    expect(CustomerModel.findOne).toHaveBeenCalledWith({ companyCode: "ACME", _id: "EXISTING" });
    expect(CustomerService.appendNotes).toHaveBeenCalledWith({ companyCode: "ACME" }, "EXISTING",
      ["Facebook Page PAGE; hội thoại CONV", "Chỉ gọi buổi chiều"]);
  });
  it("does not link an unknown customer after a concurrent phone conflict", async () => {
    vi.mocked(CustomerService.create).mockRejectedValue({ code: "CUSTOMER_PHONE_EXISTS" });
    expect(await savePageCustomer(input)).toBeUndefined();
    expect(CustomerService.appendNotes).not.toHaveBeenCalled();
  });
  it("does not write when a linked customer is outside the company or the module is disabled", async () => {
    expect(await savePageCustomer({ ...input, customerId: "FOREIGN", message: "Ngân sách 50 triệu" })).toBeUndefined();
    vi.mocked(getModuleStateForCompany).mockResolvedValue({ exists: true, modules: [] } as any);
    expect(await savePageCustomer({ ...input, customerId: "EXISTING" })).toBeUndefined();
    expect(CustomerService.appendNotes).not.toHaveBeenCalled();
    expect(CustomerService.create).not.toHaveBeenCalled();
  });
});
