// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AssistantMissingInfoForm, AssistantWorkflowSelectionForm } from "./AssistantMissingInfoForm";
import type { AssistantInputForm, AssistantReferenceSelection } from "../../shared/assistant-workflow";
afterEach(cleanup);

const form: AssistantInputForm = { id: "draft-1", fields: [{ key: "code", label: "Mã dự án", type: "text", required: true }] };
const groups: AssistantReferenceSelection[] = [
  { key: "branch", label: "Chi nhánh", required: true, multiple: false, options: [{ label: "Trụ sở chính", value: "branch-token" }, { label: "Chi nhánh Hà Nội", value: "branch-2" }] },
  { key: "days", label: "Ngày làm", required: true, multiple: true, options: [{ label: "Thứ 2", value: "mon" }, { label: "Thứ 4", value: "wed" }] },
];
function Harness({ value = form, choices = groups, disabled = false, submitting = false, submit = vi.fn() }: { value?: AssistantInputForm; choices?: AssistantReferenceSelection[]; disabled?: boolean; submitting?: boolean; submit?: (values: Record<string, unknown>, selected: Record<string, string[]>) => void }) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [searches, setSearches] = useState<Record<string, string>>({});
  return <AssistantMissingInfoForm form={value} groups={choices} selected={selected} searches={searches}
    onSelect={(key, next, checked, multiple) => setSelected(current => ({ ...current, [key]: multiple ? checked ? [...(current[key] || []), next] : (current[key] || []).filter(value => value !== next) : checked ? [next] : [] }))}
    onSearch={(key, value) => setSearches(current => ({ ...current, [key]: value }))} disabled={disabled} submitting={submitting} onSubmit={values => submit(values, selected)} />;
}
describe("assistant missing information controls", () => {
  it('asks for the module through the shared labeled dropdown, without selecting implicitly', async () => {
    const user = userEvent.setup(); const submit = vi.fn();
    render(<AssistantWorkflowSelectionForm selection={{ id: 'module-choice', kind: 'module', options: [
      { value: 'opaque-hr', label: 'Nhân sự' }, { value: 'opaque-worker', label: 'Quản lý lao động' },
    ] }} disabled={false} onSubmit={submit} />);
    expect(screen.getByRole('heading', { name: 'Chọn phân hệ' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tiếp tục' }) as HTMLButtonElement).disabled).toBe(true);
    screen.getByRole('button', { name: 'Phân hệ cần xử lý' }).focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(submit).toHaveBeenCalledWith('opaque-worker');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('opaque-worker')).toBeNull();
  });
  it("collects a labeled value and single/multiple choices without prose or implicit selection", async () => {
    const user = userEvent.setup(); const submit = vi.fn();
    render(<Harness submit={submit} />);
    expect((screen.getByRole("button", { name: "Tiếp tục" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("textbox", { name: /Mã dự án/ }) as HTMLInputElement).required).toBe(true);
    await user.type(screen.getByRole("textbox", { name: /Mã dự án/ }), "VIN-20");
    await user.click(screen.getByRole("button", { name: "Chi nhánh" }));
    await user.click(screen.getByRole("option", { name: "Trụ sở chính" }));
    await user.click(screen.getByRole("checkbox", { name: "Thứ 2" }));
    await user.click(screen.getByRole("checkbox", { name: "Thứ 4" }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(submit).toHaveBeenCalledWith({ code: "VIN-20" }, { branch: ["branch-token"], days: ["mon", "wed"] });
    expect(screen.queryByText("branch-token")).toBeNull();
  });
  it("preserves false, zero and Vietnam calendar values in the submitted fields", () => {
    const submit = vi.fn();
    const value: AssistantInputForm = { id: "temporal", fields: [
      { key: "active", label: "Hoạt động", type: "boolean", required: true, value: false },
      { key: "amount", label: "Số lượng", type: "number", required: true, value: 0, integer: true, min: 0 },
      { key: "date", label: "Ngày bắt đầu", type: "date", required: true, value: "2026-11-21" },
      { key: "time", label: "Giờ hẹn", type: "datetime", required: true, value: "2026-11-20T18:00:00Z" },
    ] };
    render(<Harness value={value} choices={[]} submit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(submit).toHaveBeenCalledWith({ active: false, amount: 0, date: "2026-11-21", time: "2026-11-21T01:00:00+07:00" }, {});
  });
  it("connects server errors to the field and clears their invalid state after editing", () => {
    const value: AssistantInputForm = { id: "invalid", fields: [{ key: "code", label: "Mã dự án", type: "text", required: true, value: "bad", error: "Mã dự án: đã tồn tại" }] };
    render(<Harness value={value} choices={[]} />);
    const input = screen.getByRole("textbox", { name: /Mã dự án/ });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toContain("đã tồn tại");
    expect((screen.getByRole("button", { name: "Tiếp tục" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "new" } });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect((screen.getByRole("button", { name: "Tiếp tục" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("keeps optional choices skippable and does not make them required", () => {
    const submit = vi.fn();
    render(<Harness value={{ id: "optional", fields: [] }} choices={[{ ...groups[0], required: false }]} submit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(submit).toHaveBeenCalledWith({}, {});
  });
  it("filters public labels with accents and announces empty results", () => {
    const choices = [{ ...groups[1], options: Array.from({ length: 9 }, (_, i) => ({ label: i === 8 ? "Đỗ Thanh Khoa" : `Lao động ${i}`, value: `opaque-${i}` })) }];
    render(<Harness choices={choices} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "do thanh" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "khong-co" } });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText(/Không tìm thấy lựa chọn/)).toBeTruthy();
  });
  it("disables historical or in-flight forms", () => {
    render(<Harness disabled submitting />);
    expect((screen.getByRole("textbox", { name: /Mã dự án/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Tiếp tục" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Đang kiểm tra thông tin…")).toBeTruthy();
  });
  it("uses the existing dropdown keyboard behavior and submits only the opaque choice", async () => {
    const user = userEvent.setup(); const submit = vi.fn();
    render(<AssistantWorkflowSelectionForm selection={{ id: "choice", options: [{ value: "token", label: "Tạo dự án lao động" }] }} disabled={false} onSubmit={submit} />);
    const trigger = screen.getByRole("button", { name: "Thao tác muốn thực hiện" });
    trigger.focus();
    await user.keyboard("{ArrowDown}{Enter}");
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(submit).toHaveBeenCalledWith("token");
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
