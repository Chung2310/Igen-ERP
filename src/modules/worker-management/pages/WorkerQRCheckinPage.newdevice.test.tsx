// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkerQRCheckinPage from "./WorkerQRCheckinPage";

const sessionInfo = {
  projectId: "p1", projectCode: "DA-QA", projectName: "Dự án QA",
  date: "2026-08-22", device: { recognized: false },
};

beforeEach(() => {
  window.history.replaceState({}, "", "/worker/checkin/token-abc");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => String(url).includes("session-info")
      ? { success: true, data: sessionInfo }
      : { success: true, data: { workerName: "Le Van QA", kind: "check-in" } },
  })) as any);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("người mới chấm công trên thiết bị chưa ghi nhớ", () => {
  it("hiện màn hình thành công, không văng lỗi", async () => {
    // Không có navigator.geolocation trong jsdom → đúng tình huống từ chối GPS
    render(<WorkerQRCheckinPage />);
    await waitFor(() => expect(screen.getByText("Chấm công Dự án")).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText("Ví dụ: 0912345678"), { target: { value: "0987654321" } });
    fireEvent.click(screen.getByText(/Chấm công ngay/));

    await waitFor(() => expect(screen.getByText("Chấm công thành công!")).toBeTruthy());
    expect(screen.getByText("Le Van QA")).toBeTruthy();
  });
});

describe("máy chủ trả phản hồi không phải JSON", () => {
  it("hiện mã HTTP thay vì lỗi mạng chung chung", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).includes("session-info")
      ? { ok: true, json: async () => ({ success: true, data: sessionInfo }) }
      : { ok: false, status: 502, json: async () => { throw new SyntaxError("Unexpected token <"); } }) as any);

    render(<WorkerQRCheckinPage />);
    await waitFor(() => expect(screen.getByText("Chấm công Dự án")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: 0912345678"), { target: { value: "0987654321" } });
    fireEvent.click(screen.getByText(/Chấm công ngay/));

    await waitFor(() => expect(screen.getByText(/HTTP 502/)).toBeTruthy());
  });
});
