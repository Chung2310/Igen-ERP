// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { PageChatFlowEditor } from "./PageChatFlowEditor";
vi.mock("../../../../../services/authService", () => ({ getAccessToken: () => "token" }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Page chat flow editor", () => {
  it("reviews a suggested flow before saving and activating it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { goal: "Tư vấn sơn", fields: [{ key: "surface", label: "Bề mặt", question: "Sơn gì?" }], completionMessage: "Đã nhận." } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { version: 1, status: "draft", goal: "Tư vấn sơn", fields: [{ key: "surface", label: "Bề mặt", question: "Sơn gì?" }], completionMessage: "Đã nhận." } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<PageChatFlowEditor pageId="PAGE" />);
    fireEvent.change(screen.getByLabelText("Mục tiêu tư vấn"), { target: { value: "Tư vấn sơn" } });
    fireEvent.click(screen.getByText("Đề xuất từ tri thức và rule"));
    await screen.findByDisplayValue("Sơn gì?");
    expect(screen.queryByText("Kích hoạt")).toBeNull();
    fireEvent.click(screen.getByText("Lưu bản nháp"));
    await screen.findByText("Kích hoạt");
    fireEvent.click(screen.getByText("Kích hoạt"));
    await waitFor(() => expect(screen.getByText("Đang dùng phiên bản 1")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
