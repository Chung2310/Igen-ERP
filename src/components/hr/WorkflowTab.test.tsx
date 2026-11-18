// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkflowTab, { WorkflowReader } from "./WorkflowTab";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WorkflowReader", () => {
  it("continues rows in alternating directions without pushing the next row to the far edge", () => {
    render(
      <WorkflowReader
        workflow={{
          name: "Long workflow",
          steps: Array.from({ length: 8 }, (_, index) => ({ id: `s${index + 1}`, title: `Stage ${index + 1}` })),
        } as any}
        canEdit={false}
        onBack={vi.fn()}
      />
    );

    const rows = [...document.querySelectorAll<HTMLElement>("[data-flow-row]")];
    expect(rows.map(row => row.dataset.direction)).toEqual(["left-to-right", "right-to-left", "left-to-right"]);
    expect(rows.map(row => [...row.querySelectorAll("ol h2")].map(title => title.textContent))).toEqual([
      ["Stage 1", "Stage 2", "Stage 3"],
      ["Stage 4", "Stage 5", "Stage 6"],
      ["Stage 7", "Stage 8"],
    ]);
    expect(rows[1].querySelector("ol")?.className).toContain("flex-row-reverse");
    expect(rows[1].style.marginLeft).toBe("0px");
    expect(rows[1].querySelector("path[d^='M46 56H0']")).toBeTruthy();
    const turnPaths = [...rows[0].querySelectorAll<SVGPathElement>(":scope > svg > path")];
    expect(turnPaths[0].getAttribute("d")).toMatch(/^M\d+ 112 V\d+$/);
    expect(turnPaths[1].getAttribute("d")).toMatch(/^m\d+ \d+ 5 6 5 -6$/);
  });

  it("turns child-stage branches with a right-to-left row", () => {
    render(
      <WorkflowReader
        workflow={{
          name: "Branched workflow",
          steps: Array.from({ length: 8 }, (_, index) => ({
            id: `s${index + 1}`,
            title: `Stage ${index + 1}`,
            subTasks: index === 3 ? [{ id: "child-1", title: "Check details" }] : [],
          })),
        } as any}
        canEdit={false}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết giai đoạn con" }));
    const reverseRow = document.querySelector<HTMLElement>('[data-flow-row][data-direction="right-to-left"]');
    expect(reverseRow?.textContent).toContain("4.1 Check details");
    expect(reverseRow?.querySelector('svg[style*="scaleX(-1)"]')).toBeTruthy();
  });

  it("renders ordered steps and opens the selected step details", () => {
    render(
      <WorkflowReader
        workflow={{
          name: "Onboarding workflow",
          description: "Guide for new employees",
          steps: [
            { id: "s1", title: "Receive documents", description: "Check submitted information", note: "Keep the original files", subTasks: [{ id: "task-1", title: "Verify identity" }], attachments: [{ id: "file-1", name: "onboarding-guide.pdf", url: "/guide.pdf", type: "file" }] },
            { id: "s2", title: "Create account", description: "Grant access by role" },
          ],
        } as any}
        canEdit={false}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText("Onboarding workflow")).toBeTruthy();
    expect(screen.getByText("Receive documents")).toBeTruthy();
    expect(screen.getByText("Create account")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit|delete|add/i })).toBeNull();
    expect(screen.queryByText(/Dự kiến|ngày/)).toBeNull();
    expect(document.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);
    expect(screen.queryByText("1.1 Verify identity")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết giai đoạn con" }));
    expect(screen.getByText("1.1 Verify identity")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ẩn chi tiết giai đoạn con" }));
    expect(screen.queryByText("1.1 Verify identity")).toBeNull();

    const firstStepCard = screen.getByText("Receive documents").closest("li")!;
    fireEvent.click(firstStepCard);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Keep the original files")).toBeTruthy();
    expect(within(dialog).getByText("Verify identity")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /xem preview/i }));
    expect(screen.getByRole("dialog", { name: /preview/i })).toBeTruthy();
    expect(screen.getByText("onboarding-guide.pdf")).toBeTruthy();
  });
});

describe("WorkflowTab detail", () => {
  it("lets a manager return to the list without offering add, save or delete actions in detail", async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => {
      return { ok: true, json: async () => ({ data: [{ _id: "507f1f77bcf86cd799439011", name: "Quy trình thử", category: "", description: "", steps: [] }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowTab userProfile={{ uid: "admin", role: "admin" } as any} selectedCompanyCode="MAIN" isManager />);
    await screen.findByText("Quy trình thử");
    fireEvent.click(screen.getByTitle("Xem chi tiết quy trình"));
    expect(screen.queryByRole("button", { name: /Thêm bước|Lưu|Xóa quy trình/ })).toBeNull();
    expect(screen.queryByTitle("Xóa quy trình")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Danh sách quy trình" }));
    expect(await screen.findByTitle("Xem chi tiết quy trình")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, options]) => ["POST", "PATCH", "DELETE"].includes(options?.method || ""))).toBe(false);
  });
});

describe("WorkflowTab search", () => {
  it("persists categories through the API and retains the form when the API rejects a name", async () => {
    const old = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function () { this.setAttribute("open", ""); } });
    let reject = true;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.method === "POST"
      ? { ok: !reject, json: async () => reject ? {message: "Nhãn đã tồn tại."} : {data: {name: "Bảo mật"}} }
      : { ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<WorkflowTab userProfile={{ uid: "admin", role: "admin" } as any} selectedCompanyCode="MAIN" isManager />);
      fireEvent.click(await screen.findByRole("button", { name: "Tạo nhãn" }));
      fireEvent.change(screen.getByLabelText("Tên nhãn"), { target: { value: "Bảo mật" } });
      fireEvent.click(screen.getByRole("button", { name: "Thêm nhãn" }));
      expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Nhãn đã tồn tại.");
      expect(screen.getByLabelText("Tên nhãn").getAttribute("aria-invalid")).toBe("true");
      reject = false;
      fireEvent.click(screen.getByRole("button", { name: "Thêm nhãn" }));
      await waitFor(() => expect(screen.queryByRole("dialog", {name: "Tạo nhãn phân loại"})).toBeNull());
      expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)))).toEqual([{name: "Bảo mật", companyCode: "MAIN"}, {name: "Bảo mật", companyCode: "MAIN"}]);
    } finally {
      if (old) Object.defineProperty(HTMLDialogElement.prototype, "showModal", old);
      else delete (HTMLDialogElement.prototype as any).showModal;
    }
  });
  it("filters workflows by name and label, ignoring Vietnamese accents", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [
        { _id: "workflow-1", name: "Quy trình tuyển dụng", category: "Nhân sự", steps: [] },
        { _id: "workflow-2", name: "Kiểm tra thiết bị", category: "Điều hành", steps: [] },
      ] }),
    })));

    render(<WorkflowTab userProfile={{ uid: "admin", role: "admin" } as any} selectedCompanyCode="MAIN" isManager />);
    await screen.findByText("Quy trình tuyển dụng");
    const search = screen.getByRole("searchbox", { name: "Tìm theo tên quy trình hoặc tên nhãn" });

    fireEvent.change(search, { target: { value: "tuyen dung" } });
    expect(screen.getByText("Quy trình tuyển dụng")).toBeTruthy();
    expect(screen.queryByText("Kiểm tra thiết bị")).toBeNull();

    fireEvent.change(search, { target: { value: "dieu hanh" } });
    expect(screen.queryByText("Quy trình tuyển dụng")).toBeNull();
    expect(screen.getByText("Kiểm tra thiết bị")).toBeTruthy();

    fireEvent.change(search, { target: { value: "không khớp" } });
    expect(screen.getByRole("status").textContent).toContain("Không tìm thấy quy trình phù hợp.");
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(screen.getByText("Quy trình tuyển dụng")).toBeTruthy();
    expect(screen.getByText("Kiểm tra thiết bị")).toBeTruthy();
  });
});
