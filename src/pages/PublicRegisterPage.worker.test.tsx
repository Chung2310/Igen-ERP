// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import PublicRegisterPage from "./PublicRegisterPage";

vi.mock("./Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const fields = [
  { key: "fullName", label: "Họ và tên", isRequired: true, isVisible: true },
  { key: "phone", label: "Số điện thoại", isRequired: true, isVisible: true },
  { key: "email", label: "Email", isRequired: true, isVisible: true },
  { key: "referral", label: "Nguồn giới thiệu", isRequired: false, isVisible: true },
];

function mockConfig(entityPreset: string) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, data: { fields, entityPreset } }),
  })) as any);
}

function setUrl(preset: string) {
  window.history.replaceState({}, "", `/public/dang-ky?entityPreset=${preset}&teacherId=6a890135119c1c3189d63849`);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("form đăng ký công khai", () => {
  it("preset lao động: có ô mã đối tác, ẩn nguồn giới thiệu, hiển thị hồ sơ ảnh", async () => {
    setUrl("worker");
    mockConfig("worker");
    render(<PublicRegisterPage />);

    await waitFor(() => expect(screen.getByText("Mã đối tác giới thiệu")).toBeTruthy());
    expect(screen.queryByText("Nguồn giới thiệu")).toBeNull();
    expect(screen.getByText("Họ và tên")).toBeTruthy();
    expect(screen.getByText("Hồ sơ ảnh")).toBeTruthy();
  });

  it("preset học viên: giữ nguồn giới thiệu, không có ô mã đối tác, không hiển thị hồ sơ ảnh, có 3 chế độ giới thiệu", async () => {
    setUrl("student");
    mockConfig("student");
    render(<PublicRegisterPage />);

    await waitFor(() => expect(screen.getByText("Nguồn giới thiệu")).toBeTruthy());
    expect(screen.queryByText("Mã đối tác giới thiệu")).toBeNull();
    expect(screen.queryByText("Hồ sơ ảnh")).toBeNull();

    const fullNameInput = screen.getByPlaceholderText("Nhập họ và tên...");
    expect(fullNameInput).toBeTruthy();

    expect(screen.getByText("Không có giới thiệu")).toBeTruthy();
    expect(screen.getByText("Đối tác / CTV hệ thống")).toBeTruthy();
    expect(screen.getByText("Nhập người giới thiệu khác")).toBeTruthy();
  });
});
