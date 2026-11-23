// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Dropdown } from "./GymDropdown";
import { Field } from "./ui";
import { MuscleGroupDialog } from "./MuscleGroupDialog";
import type { GymApi } from "./api";

afterEach(cleanup);

test("Gym dropdown uses the shared menu and keeps the selected filter value", () => {
  const onChange = vi.fn();
  render(<Dropdown aria-label="Lọc trạng thái" value="" onChange={onChange} options={[{ value: "", label: "Tất cả trạng thái" }, { value: "ACTIVE", label: "Đang hoạt động" }]} />);

  fireEvent.click(screen.getByRole("button", { name: "Lọc trạng thái" }));
  fireEvent.click(within(screen.getByRole("listbox", { name: "Lọc trạng thái" })).getByRole("option", { name: "Đang hoạt động" }));
  expect(onChange).toHaveBeenCalledWith("ACTIVE");
});

test("Gym date field displays the Vietnamese calendar and preserves ISO values", () => {
  const onChange = vi.fn();
  render(<Field label="Ngày tập" type="date" value="2026-10-16" onChange={onChange} required />);

  fireEvent.click(screen.getByRole("button", { name: "Ngày tập" }));
  const calendar = screen.getByRole("dialog", { name: "Chọn ngày tập" });
  fireEvent.click(within(calendar).getByRole("button", { name: "Chọn ngày 18/10/2026" }));
  expect(onChange).toHaveBeenCalledWith("2026-10-18");
});

test("muscle manager adds a group and blocks deletion when exercises use it", async () => {
  const request = vi.fn().mockResolvedValue({});
  const onUpdated = vi.fn();
  render(<MuscleGroupDialog
    api={{ request } as unknown as GymApi}
    groups={[{ _id: "system", name: "Ngực", isDefault: true, exerciseCount: 2 }, { _id: "custom", name: "Cẳng tay", isDefault: false, exerciseCount: 1 }]}
    loading={false} error="" onClose={() => {}} onUpdated={onUpdated}
  />);
  expect(screen.getByRole("button", { name: "Xóa nhóm cơ Cẳng tay" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Tên nhóm cơ mới" }), { target: { value: "Cơ cổ" } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm nhóm cơ" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/muscle-groups", "POST", { name: "Cơ cổ" }));
  expect(onUpdated).toHaveBeenCalled();
});
