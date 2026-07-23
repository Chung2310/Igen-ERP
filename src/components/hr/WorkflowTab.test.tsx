// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowReader } from "./WorkflowTab";

describe("WorkflowReader", () => {
  it("shows ordered instructions without operational controls for regular users", () => {
    render(
      <WorkflowReader
        workflow={{
          name: "Quy trình onboarding",
          description: "Hướng dẫn nhân viên mới",
          steps: [
            { id: "s1", title: "Nhận hồ sơ", description: "Kiểm tra thông tin đầu vào" },
            { id: "s2", title: "Tạo tài khoản", description: "Cấp quyền theo vị trí" },
          ],
        } as any}
        canEdit={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onAddStep={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Quy trình onboarding")).toBeTruthy();
    expect(screen.getByText("Hướng dẫn nhân viên mới")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Nhận hồ sơ")).toBeTruthy();
    expect(screen.getByText("Kiểm tra thông tin đầu vào")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Tạo tài khoản")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sửa|xóa|thêm/i })).toBeNull();
  });
});
