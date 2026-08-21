import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationRows: any[] = [];
const createNotification = vi.fn(async (row: any) => {
  if (notificationRows.some((item) => item.idempotencyKey === row.idempotencyKey)) throw Object.assign(new Error("dup"), { code: 11000 });
  notificationRows.push(row);
  return row;
});

vi.mock("../repair-notification.model", () => ({
  RepairNotificationModel: {
    create: (row: any) => createNotification(row),
    exists: async ({ idempotencyKey }: any) => (notificationRows.some((item) => item.idempotencyKey === idempotencyKey) ? { _id: "1" } : null),
  },
}));
vi.mock("../repair-settings.model", async () => {
  const actual: any = await vi.importActual("../repair-settings.model");
  return { ...actual, RepairSettingsModel: { findOne: () => ({ select: () => ({ lean: async () => null }), lean: async () => null }) } };
});
vi.mock("../../../model/company.model", () => ({ CompanyModel: { findOne: () => ({ select: () => ({ lean: async () => ({ name: "Igen Tech" }) }) }) } }));
vi.mock("../../../model/branch.model", () => ({ BranchModel: { findOne: () => ({ select: () => ({ lean: async () => ({ name: "Chi nhánh 1" }) }) }) } }));
vi.mock("../../customer-management/contracts", () => ({ getCustomerContact: async () => ({ email: "khach@example.com", phone: "0900000001" }) }));

const { sendRepairNotification, renderRepairTemplate, buildRepairVariables } = await import("./repair-notify.service");

const ticket = () => ({
  _id: "ticket-1", companyCode: "IGEN", branchId: "branch-1", ticketCode: "SC-001",
  customerId: "cus-1", customerName: "Trần An", customerPhone: "0900000001",
  device: { name: "iPhone 13" }, symptom: "Không lên nguồn", receivedAt: new Date("2026-08-01T03:00:00Z"),
  totalAmount: 450000, feedbackToken: "token-1",
});

const emailAdapter = (send: any) => ({ channel: "email", label: "Email", implemented: true, supportsAttachments: true, isConfigured: async () => true, recipientOf: (customer: any) => String(customer.email || ""), send }) as any;

describe("gửi thông báo phiếu sửa chữa", () => {
  beforeEach(() => { notificationRows.length = 0; createNotification.mockClear(); });

  it("gửi qua kênh khả dụng và ghi nhật ký", async () => {
    const send = vi.fn(async (_company: string, _message: any) => ({ messageId: "msg-1" }));
    const result = await sendRepairNotification(ticket(), "received", { resolveChannel: async () => emailAdapter(send) });
    expect(result.status).toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0] as any[])[1].to).toBe("khach@example.com");
    expect(notificationRows[0]).toMatchObject({ status: "sent", channel: "email", ticketCode: "SC-001" });
  });

  it("bỏ qua khi chưa có kênh nào nối được API", async () => {
    const result = await sendRepairNotification(ticket(), "done", { resolveChannel: async () => undefined });
    expect(result).toEqual({ status: "skipped", reason: "NO_CHANNEL" });
    expect(notificationRows[0]).toMatchObject({ status: "skipped", reason: "NO_CHANNEL" });
  });

  it("không gửi lại cùng một phiếu và cùng một sự kiện", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    await sendRepairNotification(ticket(), "received", { resolveChannel: async () => emailAdapter(send) });
    const again = await sendRepairNotification(ticket(), "received", { resolveChannel: async () => emailAdapter(send) });
    expect(again).toEqual({ status: "skipped", reason: "ALREADY_SENT" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("includes the feedback link and a QR image in the completed-repair email", async () => {
    const send = vi.fn(async (_company: string, _message: any) => ({ messageId: "msg-done" }));

    await sendRepairNotification(ticket(), "done", { resolveChannel: async () => emailAdapter(send) });

    const message = (send.mock.calls[0] as any[])[1];
    expect(message.html).toContain("/repair/feedback/token-1");
    expect(message.html).toMatch(/<img[^>]+src="data:image\/png;base64,/);
  });

  it("adapter lỗi thì trả failed chứ không ném ra ngoài", async () => {
    const send = vi.fn(async () => { throw new Error("SMTP_DOWN"); });
    const result = await sendRepairNotification(ticket(), "done", { resolveChannel: async () => emailAdapter(send) });
    expect(result).toEqual({ status: "failed", reason: "SMTP_DOWN" });
    expect(notificationRows[0]).toMatchObject({ status: "failed", reason: "SMTP_DOWN" });
  });

  it("thiếu địa chỉ nhận của kênh thì bỏ qua", async () => {
    const adapter = { ...emailAdapter(vi.fn()), recipientOf: () => "" };
    const result = await sendRepairNotification(ticket(), "received", { resolveChannel: async () => adapter });
    expect(result).toEqual({ status: "skipped", reason: "NO_RECIPIENT" });
  });

  it("chặn biến lạ trong mẫu tin và escape nội dung khách nhập", () => {
    const variables = buildRepairVariables({ ...ticket(), customerName: "<script>x</script>" }, { companyName: "Igen", branchName: "CN1", feedbackUrl: "https://x/y" });
    expect(renderRepairTemplate("Chào {{customerName}}", variables)).toBe("Chào &lt;script&gt;x&lt;/script&gt;");
    expect(() => renderRepairTemplate("{{khongTonTai}}", variables)).toThrow(/REPAIR_UNKNOWN_VARIABLE/);
  });
});
