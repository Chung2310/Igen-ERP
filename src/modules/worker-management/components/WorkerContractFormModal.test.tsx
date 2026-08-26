// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Worker } from "../types";
import { WorkerContractFormModal } from "./WorkerContractFormModal";

const workers: Worker[] = [
  { _id: "worker-a", fullName: "Nguyễn Văn An", phone: "0911 111 111", status: "active" },
  { _id: "worker-b", fullName: "Trần Thị Bình", phone: "0902 222 222", status: "active" },
];

afterEach(cleanup);

describe("WorkerContractFormModal", () => {
  it("searches by phone and submits the selected worker id", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkerContractFormModal
        mode="create"
        isOpen
        workers={workers}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const workerSearch = screen.getByRole("combobox", { name: "Người lao động" });
    expect(workerSearch.tagName).toBe("INPUT");
    await userEvent.type(workerSearch, "0902");
    await userEvent.click(screen.getByRole("option", { name: /Trần Thị Bình.*0902 222 222/ }));
    await userEvent.type(screen.getByLabelText("Mã hợp đồng"), "hd-02");
    await userEvent.type(screen.getByLabelText(/Khách hàng \/ đơn vị sử dụng lao động/i), "Công ty B");
    fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Ngày kết thúc"), { target: { value: "2027-09-01" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      workerId: "worker-b",
      code: "HD-02",
    }));
  });

  it("omits workerId from the edit payload because the PATCH schema forbids it", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkerContractFormModal
        mode="edit"
        isOpen
        workers={workers}
        contract={{
          _id: "contract-a",
          workerId: "worker-a",
          code: "HD-01",
          clientName: "Công ty A",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          rootContractId: "contract-a",
          sequence: 1,
        }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("workerId");
  });
});
