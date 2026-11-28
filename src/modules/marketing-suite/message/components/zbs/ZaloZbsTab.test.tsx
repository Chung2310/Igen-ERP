// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ZaloZbsTab from "./ZaloZbsTab";
import { zbsService } from "../../services/zbsService";
import { crmService } from "../../services/crmService";
import type { ZbsBatch, ZbsTemplate } from "../../../../../../shared/marketing-suite/zbs";
vi.mock("../../services/zbsService", () => ({ zbsService: { accounts: vi.fn(), templates: vi.fn(), sync: vi.fn(), draft: vi.fn(), confirm: vi.fn(), batches: vi.fn(), batch: vi.fn(), control: vi.fn(), saveMapping: vi.fn() } }));
vi.mock("../../services/crmService", () => ({ crmService: { getLeadPage: vi.fn() } }));
const template: ZbsTemplate = { templateId: "123", name: "Thông báo báo giá", status: "ENABLE", params: [], buttons: [], previewUrl: "", uidSupported: true, phoneSupported: true, priceUid: 200, pricePhone: 300, mapping: {} };
const batch: ZbsBatch = { id: "preview-1", name: "Đợt gửi", oaId: "123456", templateId: "123", templateName: template.name, method: "uid", status: "draft", test: false, development: false, createdAt: "2026-11-28T03:00:00.000Z", expiresAt: "2026-11-29T03:00:00.000Z", estimatedCost: 200,
  rows: [{ id: "r1", leadId: "lead-1", name: "Khách thử", recipient: "0012345", method: "uid", data: {}, status: "pending", reason: "", trackingId: "track1" }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(zbsService.accounts).mockResolvedValue({ data: [{ oaId: "123456", name: "OA thử" }] });
  vi.mocked(zbsService.templates).mockResolvedValue({ data: [template] });
  vi.mocked(zbsService.sync).mockResolvedValue({ data: [template] });
  vi.mocked(zbsService.draft).mockResolvedValue({ data: batch });
  vi.mocked(zbsService.confirm).mockResolvedValue({ data: { ...batch, status: "queued" } });
  vi.mocked(zbsService.batches).mockResolvedValue({ data: [], hasMore: false });
  vi.mocked(crmService.getLeadPage).mockResolvedValue({ data: [{ id: "lead-1", customerName: "Khách thử", phone: "0912345678", zaloIdentity: { oaId: "123456", uid: "0012345" } } as never], total: 1, page: 1, limit: 50, totalPages: 1 });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("opens from selected Leads, defaults to UID and requires an explicit confirmation after preview", async () => {
  render(<ZaloZbsTab canManage initialLeadIds={["lead-1"]} onBackToLeads={() => {}} />);
  await screen.findByRole("button", { name: "Kiểm tra và xem trước" });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và xem trước" }));
  await screen.findByRole("dialog", { name: "Kiểm tra trước khi gửi" });
  expect(zbsService.draft).toHaveBeenCalledWith(expect.objectContaining({ method: "uid", leadIds: ["lead-1"], test: false, development: false }));
  expect(zbsService.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận gửi 1 tin" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Xác nhận gửi mẫu Zalo" });
  expect(zbsService.confirm).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByRole("button", { name: "Gửi ngay" }));
  await waitFor(() => expect(zbsService.confirm).toHaveBeenCalledExactlyOnceWith("preview-1"));
});
it("keeps sending actions unavailable to read-only users", async () => {
  render(<ZaloZbsTab canManage={false} onBackToLeads={() => {}} />);
  await screen.findByRole("heading", { name: template.name });
  expect(screen.queryByRole("button", { name: "Gửi thử mẫu" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Tạo đợt gửi" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Đồng bộ mẫu" })).toBeNull();
  expect(zbsService.sync).not.toHaveBeenCalled();
});
it("shows a recoverable no-OA state and inline provider errors", async () => {
  vi.mocked(zbsService.accounts).mockResolvedValue({ data: [] });
  const view = render(<ZaloZbsTab canManage onBackToLeads={() => {}} />);
  await screen.findByRole("link", { name: "Mở tích hợp Marketing" });
  view.unmount();
  vi.mocked(zbsService.accounts).mockRejectedValue(new Error("Không thể kết nối"));
  render(<ZaloZbsTab canManage onBackToLeads={() => {}} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Không thể kết nối");
});
it("auto-syncs multiple templates, requires a choice and dispatches the selected template with its own edited mapping", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const param = { name: "ma", required: true, type: "STRING", minLength: 0, maxLength: 50, acceptNull: false };
  const first: ZbsTemplate = { ...template, params: [param], mapping: { ma: { source: "constant", key: "MA-A" } } };
  const second: ZbsTemplate = { ...first, templateId: "456", name: "Nhắc thanh toán", mapping: { ma: { source: "constant", key: "MA-B" } } };
  const pending: ZbsTemplate = { ...first, templateId: "789", name: "Mẫu đang duyệt", status: "PENDING_REVIEW" };
  vi.mocked(zbsService.sync).mockResolvedValueOnce({ data: [first, second, pending] });
  render(<ZaloZbsTab canManage initialLeadIds={["lead-1"]} onBackToLeads={() => {}} />);
  await screen.findByText("Chọn một mẫu trong ô Mẫu tin trước khi gửi thử hoặc tạo đợt gửi.");
  expect(zbsService.sync).toHaveBeenCalledWith("123456", false, expect.any(AbortSignal));
  expect(screen.queryByRole("button", { name: "Kiểm tra và xem trước" })).toBeNull();
  const picker = () => screen.getAllByRole("button", { name: "Mẫu tin" }).find(button => button.getAttribute("aria-haspopup") === "listbox")!;
  fireEvent.click(picker());
  expect(screen.queryByRole("option", { name: /Mẫu đang duyệt/ })).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: /#456/ }));
  const field = screen.getByRole("textbox", { name: "Giá trị cố định cho ma" }) as HTMLInputElement;
  expect(field.value).toBe("MA-B");
  fireEvent.change(field, { target: { value: "MA-B-EDITED" } });
  vi.mocked(zbsService.sync).mockResolvedValue({ data: [second, first, { ...first, templateId: "999", name: "Mẫu vừa được duyệt" }] });
  fireEvent(document, new Event("visibilitychange"));
  await screen.findByText("3 mẫu");
  expect(picker().textContent).toContain("#456");
  expect((screen.getByRole("textbox", { name: "Giá trị cố định cho ma" }) as HTMLInputElement).value).toBe("MA-B-EDITED");
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và xem trước" }));
  await waitFor(() => expect(zbsService.draft).toHaveBeenCalledWith(expect.objectContaining({ templateId: "456", mapping: { ma: { source: "constant", key: "MA-B-EDITED" } } })));
});
it("retains cached templates and shows the provider error if automatic refresh fails", async () => {
  vi.mocked(zbsService.sync).mockRejectedValue(new Error("Zalo tạm thời không phản hồi"));
  render(<ZaloZbsTab canManage onBackToLeads={() => {}} />);
  await screen.findByRole("heading", { name: template.name });
  expect(screen.getByRole("alert").textContent).toContain("Zalo tạm thời không phản hồi");
  expect(zbsService.draft).not.toHaveBeenCalled();
});
