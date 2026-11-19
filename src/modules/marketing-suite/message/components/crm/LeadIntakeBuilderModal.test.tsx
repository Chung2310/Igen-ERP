// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeadIntakeBuilderModal } from "./LeadIntakeBuilderModal";
import { crmService } from "../../services/crmService";

vi.mock("../../services/crmService", () => ({ crmService: {
  getLeadIntakeProfilesForAccount: vi.fn(), saveAndActivateLeadIntakeProfile: vi.fn(),
  saveLeadIntakeDraft: vi.fn(), archiveLeadIntakeProfile: vi.fn(), suggestLeadIntakeProfile: vi.fn(),
} }));

const onSaved = vi.fn();
const onClose = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crmService.getLeadIntakeProfilesForAccount).mockResolvedValue({ profiles: [], fallbackProfiles: [] });
});
afterEach(cleanup);

async function open() {
  render(<LeadIntakeBuilderModal isOpen accounts={[]} hideOcrSettings onSaved={onSaved} onClose={onClose} />);
  await screen.findByDisplayValue("Họ và tên");
}
async function selectTemplate(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Chọn mẫu Lead" }));
  fireEvent.click(await screen.findByRole("option", { name }));
}

describe("Ready-made Lead templates", () => {
  it("previews telecom columns, then saves an editable subscriber profile through the existing activation flow", async () => {
    await open();
    await selectTemplate("Nhà mạng");
    expect(screen.getByText(/Các cột: Mã thuê bao/)).toBeTruthy();
    expect(screen.queryByDisplayValue("Mã thuê bao")).toBeNull();
    expect(crmService.saveAndActivateLeadIntakeProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dùng mẫu" }));
    expect(screen.getByDisplayValue("Mã thuê bao")).toBeTruthy();
    expect(screen.queryByDisplayValue("Nhu cầu")).toBeNull();
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Bắt buộc thu thập cột Mã thuê bao" }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Bắt buộc thu thập cột Số điện thoại" }).checked).toBe(false);
    fireEvent.change(screen.getByDisplayValue("Địa chỉ lắp đặt"), { target: { value: "Địa chỉ thuê bao" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu & áp dụng" }));
    await waitFor(() => expect(crmService.saveAndActivateLeadIntakeProfile).toHaveBeenCalledOnce());
    const input = vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mock.calls[0][0];
    expect(input.fields).toHaveLength(11);
    expect(input.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "account", type: "text", required: true }),
      expect.objectContaining({ key: "dia_chi_lap_dat", label: "Địa chỉ thuê bao" }),
      expect.objectContaining({ key: "tong_tien", type: "currency", required: false }),
      expect.objectContaining({ key: "so_dien_thoai_ky_thuat", type: "phone", required: false }),
    ]));
    expect(input).not.toHaveProperty("platform");
    expect(onSaved).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(["Cơ bản", "Đặt lịch khám", "Tư vấn khóa học", "Bán hàng"])("can use and activate the %s template without AI generation", async name => {
    await open();
    await selectTemplate(name);
    fireEvent.click(screen.getByRole("button", { name: "Dùng mẫu" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu & áp dụng" }));
    await waitFor(() => expect(crmService.saveAndActivateLeadIntakeProfile).toHaveBeenCalledOnce());
    const { fields } = vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mock.calls[0][0];
    expect(fields.some(field => field.type === "phone")).toBe(true);
    if (name === "Đặt lịch khám") {
      expect(fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: "gioi_tinh", type: "single_select", options: ["Nam", "Nữ", "Khác"] })]));
      expect(fields.some(field => /sinh/.test(field.key))).toBe(false);
    }
    expect(crmService.suggestLeadIntakeProfile).not.toHaveBeenCalled();
  });

  it("merges missing columns without duplicating a custom Account or overwriting configured fields and groups", async () => {
    const fields = [
      { key: "subscriber_custom", label: "Account", question: "Mã thuê bao đang dùng", type: "text" as const, required: true },
      { key: "contact", label: "Số điện thoại", question: "Số khách hàng", type: "phone" as const, required: true },
      { key: "khu_vuc", label: "Khu vực", question: "Khu vực", type: "single_select" as const, options: ["Bắc", "Nam"], required: false },
    ];
    const groups = [{ key: "lap_dat", label: "Lắp đặt", fieldKeys: ["subscriber_custom", "khu_vuc"] }];
    vi.mocked(crmService.getLeadIntakeProfilesForAccount).mockResolvedValue({ profiles: [{
      _id: "configured", status: "active", version: 1, fields, goal: "Mục tiêu đã chỉnh", completionMessage: "Cảm ơn bạn", needGroups: groups, sourceDocumentIds: ["document-1"],
    }], fallbackProfiles: [] } as never);
    render(<LeadIntakeBuilderModal isOpen accounts={[]} hideOcrSettings onSaved={onSaved} onClose={onClose} />);
    await screen.findByDisplayValue("Account");
    await selectTemplate("Nhà mạng");
    fireEvent.click(screen.getByRole("button", { name: "Thêm cột từ mẫu" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm cột từ mẫu" }));
    expect(screen.getByRole("status").textContent).toContain("đã có đủ");
    expect(screen.queryByDisplayValue("Mã thuê bao")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lưu & áp dụng" }));
    await waitFor(() => expect(crmService.saveAndActivateLeadIntakeProfile).toHaveBeenCalledOnce());
    const input = vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mock.calls[0][0];
    expect(input).toMatchObject({ goal: "Mục tiêu đã chỉnh", sourceDocumentIds: ["document-1"], needGroups: groups });
    expect(input.fields.slice(0, 3)).toMatchObject(fields);
    expect(input.fields.filter(field => field.type === "phone")).toHaveLength(2);
  });

  it("keeps manual column creation available without choosing a template", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Thêm cột" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên cột 4" }), { target: { value: "Mã nội bộ" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu & áp dụng" }));
    await waitFor(() => expect(crmService.saveAndActivateLeadIntakeProfile).toHaveBeenCalledOnce());
    expect(vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mock.calls[0][0].fields).toHaveLength(4);
    expect(crmService.suggestLeadIntakeProfile).not.toHaveBeenCalled();
  });

  it("does not silently truncate a template when the existing profile is near the column limit", async () => {
    const fields = Array.from({ length: 29 }, (_, index) => ({ key: `cot_${index}`, label: `Cột riêng ${index}`, question: "Thông tin", type: "text", required: false }));
    vi.mocked(crmService.getLeadIntakeProfilesForAccount).mockResolvedValue({ profiles: [{
      status: "active", version: 1, fields,
    }], fallbackProfiles: [] } as never);
    render(<LeadIntakeBuilderModal isOpen accounts={[]} hideOcrSettings onSaved={onSaved} onClose={onClose} />);
    await screen.findByDisplayValue("Cột riêng 0");
    await selectTemplate("Nhà mạng");
    fireEvent.click(screen.getByRole("button", { name: "Thêm cột từ mẫu" }));
    expect(screen.getByRole("alert").textContent).toContain("30 cột");
    expect(screen.queryByDisplayValue("Mã thuê bao")).toBeNull();
    expect(screen.getAllByRole("textbox", { name: /^Tên cột/ })).toHaveLength(29);
    expect(crmService.saveAndActivateLeadIntakeProfile).not.toHaveBeenCalled();
  });

  it("preserves the edited template on save failure so it can be retried", async () => {
    await open();
    await selectTemplate("Nhà mạng");
    fireEvent.click(screen.getByRole("button", { name: "Dùng mẫu" }));
    vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mockRejectedValueOnce(new Error("Không lưu được cấu hình"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu & áp dụng" }));
    await screen.findByText("Không lưu được cấu hình");
    expect(screen.getByDisplayValue("Mã thuê bao")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu & áp dụng" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
