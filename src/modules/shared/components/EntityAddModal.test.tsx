// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntityAddModal } from "./EntityAddModal";

afterEach(() => cleanup());

describe("EntityAddModal", () => {
  it("renders nothing while closed", () => {
    render(
      <EntityAddModal isOpen={false} title="Thêm lao động mới" onClose={vi.fn()}>
        <div>nội dung</div>
      </EntityAddModal>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("nội dung")).toBeNull();
  });

  it("renders the shared form shell and closes from the header", () => {
    const onClose = vi.fn();

    render(
      <EntityAddModal isOpen title="Thêm lao động mới" onClose={onClose}>
        <label htmlFor="name">Họ và tên</label>
        <input id="name" />
      </EntityAddModal>,
    );

    expect(screen.getByRole("heading", { name: "Thêm lao động mới" })).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByLabelText("Họ và tên")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the footer cancel button", () => {
    const onClose = vi.fn();

    render(
      <EntityAddModal isOpen title="Thêm lao động mới" onClose={onClose}>
        <div />
      </EntityAddModal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits the form and uses the custom submit label", () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <EntityAddModal isOpen title="Thêm lao động mới" onClose={vi.fn()} onSubmit={onSubmit} submitLabel="Tạo hồ sơ">
        <div />
      </EntityAddModal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tạo hồ sơ" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows an error panel and disables every control while submitting", () => {
    render(
      <EntityAddModal
        isOpen
        title="Thêm lao động mới"
        onClose={vi.fn()}
        error="Số điện thoại đã tồn tại"
        submitting
      >
        <div />
      </EntityAddModal>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Số điện thoại đã tồn tại");
    expect(screen.getByRole("button", { name: "Đóng" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Hủy" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Đang lưu..." })).toHaveProperty("disabled", true);
  });
});
