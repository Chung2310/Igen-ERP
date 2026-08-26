// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Worker } from "../types";
import { WorkerSearchSelect } from "./WorkerSearchSelect";

const workers: Worker[] = [
  { _id: "worker-a", fullName: "Nguyễn Văn An", phone: "0911 111 111", status: "active" },
  { _id: "worker-b", fullName: "Trần Thị Bình", phone: "0902 222 222", status: "active" },
  { _id: "worker-c", fullName: "Lê Minh Châu", status: "active" },
];

afterEach(cleanup);

describe("WorkerSearchSelect", () => {
  it("finds workers by phone and emits the selected worker id", async () => {
    const onChange = vi.fn();
    render(<WorkerSearchSelect workers={workers} value="" onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Người lao động" }), "0902");
    await userEvent.click(screen.getByRole("option", { name: /Trần Thị Bình.*0902 222 222/ }));

    expect(onChange).toHaveBeenCalledWith("worker-b");
  });

  it("finds workers by name without case sensitivity", async () => {
    render(<WorkerSearchSelect workers={workers} value="" onChange={vi.fn()} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Người lao động" }), "NGUYỄN");

    expect(screen.getByRole("option", { name: /Nguyễn Văn An/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Trần Thị Bình/ })).toBeNull();
  });

  it("shows at most ten matching suggestions", async () => {
    const manyWorkers = Array.from({ length: 12 }, (_, index): Worker => ({
      _id: `worker-${index}`,
      fullName: `Người lao động ${index + 1}`,
      phone: `0900${String(index).padStart(2, "0")}`,
      status: "active",
    }));
    render(<WorkerSearchSelect workers={manyWorkers} value="" onChange={vi.fn()} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Người lao động" }), "Người lao động");

    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(10);
  });

  it("clears a selected worker", async () => {
    const onChange = vi.fn();
    render(<WorkerSearchSelect workers={workers} value="worker-a" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Xóa người lao động đã chọn" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows no-result feedback and respects disabled mode", async () => {
    const { rerender } = render(<WorkerSearchSelect workers={workers} value="" onChange={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Người lao động" });
    await userEvent.type(input, "không tồn tại");
    expect(screen.getByText("Không tìm thấy người lao động phù hợp.")).toBeTruthy();

    rerender(<WorkerSearchSelect workers={workers} value="worker-a" disabled onChange={vi.fn()} />);
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Người lao động" }).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Xóa người lao động đã chọn" })).toBeNull();
  });
});
